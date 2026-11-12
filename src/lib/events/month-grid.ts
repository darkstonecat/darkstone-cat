// ---------------------------------------------------------------------------
// Month calendar helpers of the /events calendar
// ---------------------------------------------------------------------------
// Pure functions (no React, no server-only imports): the navigation range, the
// Monday-first week grid and its labels. Days are
// plain `YYYY-MM-DD` strings on the Madrid calendar and all date arithmetic is
// done in UTC on those strings, so DST changes cannot shift a day.

import { madridLastDay } from "./madrid-day";

const TIME_ZONE = "Europe/Madrid";
const INTL_LOCALES: Record<string, string> = { ca: "ca-ES", es: "es-ES", en: "en-GB" };
const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? locale;

/** The calendar browses from the current month up to this many months ahead. */
export const MONTHS_FORWARD = 6;

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

/** A calendar entry, stripped to what the calendar shows. */
export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  special: boolean;
  ludoyaUrl: string;
}

export interface CalendarDay {
  /** `YYYY-MM-DD` */
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` of an instant on the Madrid calendar. */
export function madridDayKey(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

export const formatMonthKey = ({ year, month }: YearMonth) => `${year}-${pad(month)}`;

export function currentYearMonth(now: Date): YearMonth {
  const [year, month] = madridDayKey(now).split("-").map(Number);
  return { year, month };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const monthIndex = ({ year, month }: YearMonth) => year * 12 + month - 1;

/** First and last month that can be browsed, relative to `now`. */
export function monthRange(now: Date): { first: YearMonth; last: YearMonth } {
  const current = currentYearMonth(now);
  return { first: current, last: shiftMonth(current, MONTHS_FORWARD) };
}

export function isInRange(target: YearMonth, now: Date): boolean {
  const { first, last } = monthRange(now);
  return monthIndex(target) >= monthIndex(first) && monthIndex(target) <= monthIndex(last);
}

const utcDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Monday-first weeks covering the month, padded with the neighbouring months'
 * days so every week has seven cells. Events are placed on every Madrid day from
 * the one they start to their last day (`madridLastDay`: an evening ending before
 * 06:00 stays on its own day).
 */
export function buildMonthGrid(
  { year, month }: YearMonth,
  events: CalendarEvent[],
  today: string
): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const last = madridLastDay(event.startsAt, event.endsAt);
    for (let key = madridDayKey(event.startsAt); key <= last; key = dayKey(new Date(utcDate(key).getTime() + 86_400_000))) {
      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const start = Date.UTC(year, month - 1, 1 - lead);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start + (w * 7 + d) * 86_400_000);
      const key = dayKey(date);
      const inMonth = date.getUTCMonth() === month - 1;
      return {
        date: key,
        day: date.getUTCDate(),
        inMonth,
        isToday: key === today,
        events: inMonth ? (byDay.get(key) ?? []) : [],
      };
    })
  );
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** "Octubre 2026" */
export function formatMonthTitle({ year, month }: YearMonth, locale: string): string {
  const name = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", month: "long" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
  return `${capitalize(name)} ${year}`;
}

/** Monday-first weekday labels: short ("Dl") and long ("Dilluns"). */
export function weekdayLabels(locale: string): { short: string; long: string }[] {
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "short" });
  const long = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "long" });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i));
    return { short: capitalize(short.format(date).replace(/\./g, "")), long: capitalize(long.format(date)) };
  });
}

/** "Divendres 2 d'octubre" for a `YYYY-MM-DD` day. */
export function formatDayLong(day: string, locale: string): string {
  return capitalize(
    new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
      .format(utcDate(day))
      .replace(",", "")
  );
}

/** A month reachable from the current one (its key and formatted title), or null at the range limit. */
export interface CalendarNeighbour {
  key: string;
  title: string;
}
