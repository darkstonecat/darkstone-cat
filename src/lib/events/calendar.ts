// ---------------------------------------------------------------------------
// Events — month calendar data (server)
// ---------------------------------------------------------------------------
// Same 60 s Ludoya request as the agenda, so the first render costs no extra
// fetch and month navigation is served from the data cache.

import "server-only";
import { describeError, isTimeoutError } from "@/lib/ludoya/client";
import { fetchMemberAreaSessions } from "@/lib/member-sessions";
import { toEventsCalendar, type EventsCalendarMonth } from "./calendar-view";
import type { YearMonth } from "./month-grid";

/** One calendar month; on a Ludoya failure the grid comes without events and with `error`. */
export async function fetchEventsCalendar(month: YearMonth, locale: string, now: Date = new Date()): Promise<EventsCalendarMonth> {
  try {
    return toEventsCalendar(month, await fetchMemberAreaSessions(), now, locale);
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch the events calendar: ${describeError(error)}`);
    return { ...toEventsCalendar(month, [], now, locale), error: isTimeoutError(error) ? "timeout" : "api_error" };
  }
}
