import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { fetchEventsCalendar } from "@/lib/events/calendar";
import { calendarCacheControl, isEventsMonth, parseMonthKey } from "@/lib/events/calendar-view";
import { agendaNow } from "@/lib/events/clock";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * GET ?month=YYYY-MM&locale=ca — one pre-formatted month of the /events
 * calendar (current month up to six ahead), so month navigation never
 * re-renders the page. Public: PUBLIC events only, no session needed.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const now = agendaNow();
  const month = parseMonthKey(params.get("month"));
  if (!month || !isEventsMonth(month, now)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400, headers: noStore });
  }
  const locale = routing.locales.find((l) => l === params.get("locale")) ?? routing.defaultLocale;

  const payload = await fetchEventsCalendar(month, locale, now);
  // Public data, its Ludoya request is cached 60 s anyway; never cached past Madrid midnight.
  return NextResponse.json(payload, { headers: payload.error ? noStore : { "Cache-Control": calendarCacheControl(now) } });
}
