import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { buildCalendarPayload } from "@/lib/member-home/calendar-payload";
import { isInRange } from "@/lib/member-home/month-grid";

const noStore = { "Cache-Control": "no-store" } as const;

/**
 * GET ?month=YYYY-MM&locale=ca — one pre-formatted calendar month for the member
 * home, so month navigation does not re-render the whole page. Members only.
 * The response is never cached by the browser; the Ludoya request behind it is
 * (60 s, the same one the week list uses).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401, headers: noStore });

  // Former members (left_on set) are not members any more, even with a still-valid access token.
  const { data: member } = await supabase.from("members").select("id, left_on").eq("id", user.id).maybeSingle();
  if (!member || member.left_on !== null) return new NextResponse("Member not found", { status: 404, headers: noStore });

  const params = new URL(request.url).searchParams;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(params.get("month") ?? "");
  const month = match ? { year: Number(match[1]), month: Number(match[2]) } : null;
  if (!month || !isInRange(month, new Date())) {
    return new NextResponse("Invalid month", { status: 400, headers: noStore });
  }
  const locale = routing.locales.find((l) => l === params.get("locale")) ?? routing.defaultLocale;

  return NextResponse.json(await buildCalendarPayload(month, locale), { headers: noStore });
}
