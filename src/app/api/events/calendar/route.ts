import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { fetchEventsCalendar } from "@/lib/events/calendar";
import { isEventsMonth, parseMonthKey } from "@/lib/events/calendar-view";

const noStore = { "Cache-Control": "no-store" } as const;
/** The month is public data and its Ludoya request is cached 60 s anyway. */
const cacheable = { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" } as const;

/**
 * GET ?month=YYYY-MM&locale=ca — one pre-formatted month of the /events
 * calendar (current month up to six ahead), so month navigation never
 * re-renders the page. Public: PUBLIC events only, no session needed.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const month = parseMonthKey(params.get("month"));
  if (!month || !isEventsMonth(month, now)) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400, headers: noStore });
  }
  const locale = routing.locales.find((l) => l === params.get("locale")) ?? routing.defaultLocale;

  const payload = await fetchEventsCalendar(month, locale, now);
  return NextResponse.json(payload, { headers: payload.error ? noStore : cacheable });
}
