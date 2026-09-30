import "server-only";
import { fetchMonthEvents } from "@/lib/member-sessions";
import { toMemberSessions } from "./sessions-view";
import {
  buildCalendarView,
  formatMonthKey,
  formatMonthTitle,
  isInRange,
  madridDayKey,
  shiftMonth,
  type CalendarEvent,
  type CalendarNeighbour,
  type CalendarPayload,
  type YearMonth,
} from "./month-grid";

function neighbour(target: YearMonth, now: Date, locale: string): CalendarNeighbour | null {
  return isInRange(target, now) ? { key: formatMonthKey(target), title: formatMonthTitle(target, locale) } : null;
}

/** Loads a month from Ludoya (cached 60 s upstream) and formats it for the calendar. `month` must be in range. */
export async function buildCalendarPayload(month: YearMonth, locale: string, now: Date = new Date()): Promise<CalendarPayload> {
  const header = {
    monthKey: formatMonthKey(month),
    title: formatMonthTitle(month, locale),
    prev: neighbour(shiftMonth(month, -1), now, locale),
    next: neighbour(shiftMonth(month, 1), now, locale),
  };

  const { events, error } = await fetchMonthEvents(month.year, month.month);
  if (error) return { ...header, view: null, error };

  const items: CalendarEvent[] = toMemberSessions(events).map((s) => ({
    id: s.id,
    title: s.title,
    startsAt: s.startsAt,
    special: s.type === "special",
    placeName: s.place?.name ?? null,
    ludoyaUrl: s.ludoyaUrl,
  }));
  return { ...header, view: buildCalendarView(month, items, madridDayKey(now), locale) };
}
