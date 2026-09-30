// ---------------------------------------------------------------------------
// Member home — month calendar helpers
// ---------------------------------------------------------------------------
// Pure functions (no React, no server-only imports): month parameter parsing,
// the navigation range, the Monday-first week grid and its labels. Days are
// plain `YYYY-MM-DD` strings on the Madrid calendar and all date arithmetic is
// done in UTC on those strings, so DST changes cannot shift a day.

const TIME_ZONE = "Europe/Madrid";
const INTL_LOCALES: Record<string, string> = { ca: "ca-ES", es: "es-ES", en: "en-GB" };
const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? locale;

/** How many months before and after the current one the calendar lets you browse. */
export const MONTHS_BACK = 3;
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
  special: boolean;
  placeName: string | null;
  ludoyaUrl: string;
}

/** An event with its locale-dependent text already formatted (on the server). */
export interface CalendarEventView extends CalendarEvent {
  /** "16:00" on the Madrid clock. */
  time: string;
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

/** First and last month the member can browse, relative to `now`. */
export function monthRange(now: Date): { first: YearMonth; last: YearMonth } {
  const current = currentYearMonth(now);
  return { first: shiftMonth(current, -MONTHS_BACK), last: shiftMonth(current, MONTHS_FORWARD) };
}

export function isInRange(target: YearMonth, now: Date): boolean {
  const { first, last } = monthRange(now);
  return monthIndex(target) >= monthIndex(first) && monthIndex(target) <= monthIndex(last);
}

/**
 * Month from the `?month=YYYY-MM` search param. Anything missing, malformed or
 * outside the browsable range falls back to the current month.
 */
export function parseMonthParam(value: string | string[] | undefined, now: Date): YearMonth {
  const current = currentYearMonth(now);
  if (typeof value !== "string") return current;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return current;
  const parsed = { year: Number(match[1]), month: Number(match[2]) };
  return isInRange(parsed, now) ? parsed : current;
}

const utcDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Monday-first weeks covering the month, padded with the neighbouring months'
 * days so every week has seven cells. Events are placed on the Madrid day they
 * start.
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
    const key = madridDayKey(event.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
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

/** The day the mobile panel opens on: the first event from today on, else the first of the month. */
export function defaultSelectedDay(weeks: CalendarDay[][], today: string): string | null {
  const withEvents = weeks.flat().filter((d) => d.events.length > 0);
  return (withEvents.find((d) => d.date >= today) ?? withEvents[0])?.date ?? null;
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

/** "16:00" on the Madrid clock. */
export function formatEventTime(instant: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

export interface CalendarDayView extends Omit<CalendarDay, "events"> {
  /** "Divendres 2 d'octubre" */
  label: string;
  events: CalendarEventView[];
}

/**
 * Everything the client calendar needs as plain strings. Dates are formatted
 * on the server only: Node and browser ICU can differ (apostrophes,
 * abbreviations), which would trigger a hydration mismatch if a client
 * component formatted them.
 */
export interface CalendarView {
  title: string;
  weekdays: { short: string; long: string }[];
  weeks: CalendarDayView[][];
  /** Day the mobile panel opens on. */
  defaultSelected: string | null;
}

export function buildCalendarView(
  month: YearMonth,
  events: CalendarEvent[],
  today: string,
  locale: string
): CalendarView {
  const weeks = buildMonthGrid(month, events, today);
  return {
    title: formatMonthTitle(month, locale),
    weekdays: weekdayLabels(locale),
    defaultSelected: defaultSelectedDay(weeks, today),
    weeks: weeks.map((week) =>
      week.map((day) => ({
        ...day,
        label: formatDayLong(day.date, locale),
        events: day.events.map((event) => ({ ...event, time: formatEventTime(event.startsAt, locale) })),
      }))
    ),
  };
}

/** A month reachable from the current one (its key and formatted title), or null at the range limit. */
export interface CalendarNeighbour {
  key: string;
  title: string;
}

/**
 * One month of the member calendar as plain data: header, neighbours for the
 * navigation and either the grid or the reason Ludoya could not be read. The
 * server builds it (for the first render and for `/api/profile/calendar`) so the
 * client never formats dates.
 */
export interface CalendarPayload {
  monthKey: string;
  title: string;
  prev: CalendarNeighbour | null;
  next: CalendarNeighbour | null;
  view: CalendarView | null;
  error?: "api_error" | "timeout";
}
