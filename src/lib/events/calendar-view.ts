// ---------------------------------------------------------------------------
// Events — the month calendar of /events (pure)
// ---------------------------------------------------------------------------
// One month as plain, pre-formatted data for the sidebar calendar: built on the
// server for the first render and by `/api/events/calendar` for the other
// months, so the client never formats a date. Only PUBLIC events are placed and
// only the fields below leave the server.

import type { LudoyaFetchError, LudoyaSession } from "@/lib/ludoya/types";
import {
  EVENTS_MONTHS_BACK,
  buildMonthGrid,
  formatDayLong,
  formatMonthKey,
  formatMonthTitle,
  isInRange,
  madridDayKey,
  shiftMonth,
  weekdayLabels,
  type CalendarEvent,
  type CalendarNeighbour,
  type YearMonth,
} from "./month-grid";

/** The session fields the calendar reads. */
export type CalendarSession = Pick<LudoyaSession, "id" | "title" | "startsAt" | "type" | "visibility" | "ludoyaUrl">;

export interface EventsCalendarDay {
  /** `YYYY-MM-DD` */
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  /** "special" when any event of the day is special. */
  kind: "none" | "session" | "special";
  /** "Divendres 13 de novembre" */
  label: string;
  titles: string[];
  /** Event a click opens: the day's special, else its first event. */
  eventId: string | null;
  ludoyaUrl: string | null;
}

export interface EventsCalendarMonth {
  monthKey: string;
  title: string;
  prev: CalendarNeighbour | null;
  next: CalendarNeighbour | null;
  weekdays: { short: string; long: string }[];
  weeks: EventsCalendarDay[][];
  /** Ludoya could not be read: the grid comes without events. */
  error?: LudoyaFetchError;
}

/** The current month up to six months ahead. */
export const isEventsMonth = (target: YearMonth, now: Date) => isInRange(target, now, EVENTS_MONTHS_BACK);

/** `YYYY-MM` → month, or null when malformed. */
export function parseMonthKey(value: string | null): YearMonth | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? "");
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

function neighbour(target: YearMonth, now: Date, locale: string): CalendarNeighbour | null {
  return isEventsMonth(target, now) ? { key: formatMonthKey(target), title: formatMonthTitle(target, locale) } : null;
}

export function toEventsCalendar(
  month: YearMonth,
  sessions: CalendarSession[],
  now: Date,
  locale: string
): EventsCalendarMonth {
  const today = madridDayKey(now);
  const events: CalendarEvent[] = sessions
    .filter((s) => s.visibility === "PUBLIC")
    .map((s) => ({
      id: s.id,
      title: s.title,
      startsAt: s.startsAt,
      special: s.type === "special",
      placeName: null,
      ludoyaUrl: s.ludoyaUrl,
    }));

  const weeks = buildMonthGrid(month, events, today).map((week) =>
    week.map((day): EventsCalendarDay => {
      const target = day.events.find((e) => e.special) ?? day.events[0] ?? null;
      return {
        date: day.date,
        day: day.day,
        inMonth: day.inMonth,
        isToday: day.isToday,
        isPast: day.date < today,
        kind: target === null ? "none" : target.special ? "special" : "session",
        label: formatDayLong(day.date, locale),
        titles: day.events.map((e) => e.title),
        eventId: target?.id ?? null,
        ludoyaUrl: target?.ludoyaUrl ?? null,
      };
    })
  );

  return {
    monthKey: formatMonthKey(month),
    title: formatMonthTitle(month, locale),
    prev: neighbour(shiftMonth(month, -1), now, locale),
    next: neighbour(shiftMonth(month, 1), now, locale),
    weekdays: weekdayLabels(locale),
    weeks,
  };
}
