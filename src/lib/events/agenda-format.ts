// ---------------------------------------------------------------------------
// Events agenda — date texts, formatted on the server
// ---------------------------------------------------------------------------
// Node and browser ICU can differ (apostrophes, abbreviations), so every date
// text of the agenda is formatted here, on the server, and the client
// components only print it. Pure: no React, no server-only imports.

import type { Agenda, AgendaEvent, AgendaWeek } from "./agenda-view";
import { madridLastDay } from "./madrid-day";
import type { AlwaysOpenGroup, ProgramDay, ProgramGroup, ProgramItem, ProgramLayout } from "./program";

const TIME_ZONE = "Europe/Madrid";
const INTL_LOCALES: Record<string, string> = { ca: "ca-ES", es: "es-ES", en: "en-GB" };

/** A program item with its hours: "10:00 – 14:00", "16:15" without an end, null when undated. */
export type ItemView = ProgramItem & { time: string | null };

export interface GroupView extends ProgramGroup<ItemView> {
  /** "10:00" in slots mode; null for a day's single grid. */
  time: string | null;
}

export interface DayView extends Omit<ProgramDay<ItemView>, "groups"> {
  /** "Dissabte 28 de novembre" */
  title: string;
  groups: GroupView[];
}

export interface ProgramView extends Omit<ProgramLayout<ItemView>, "days" | "alwaysOpen"> {
  days: DayView[];
  alwaysOpen: AlwaysOpenGroup<ItemView>[];
}

/**
 * Date tile of the timeline: one day ("DV" / "13"), or the first and last day of a
 * multi-day event ("DS" / "28", "DG" / "29"). `gap` is true when days lie between them.
 */
export interface EventTile {
  days: { weekday: string; day: string }[];
  gap: boolean;
}

export interface EventView extends Omit<AgendaEvent, "program"> {
  tile: EventTile;
  /** "Divendres 13 de novembre", or a range for a multi-day event. */
  dates: string;
  /** "16:00 – 20:30" */
  time: string;
  /** `dates · time` */
  when: string;
  program: ProgramView;
}

/** Values of the week title message ("Setmana del 16 al 22 de novembre"). */
export type WeekTitle = {
  start: string;
  end: string;
  /** Catalan elision before 1 and 11 ("de l'1", "a l'11"), as an ICU select value. */
  startElided: "yes" | "no";
  endElided: "yes" | "no";
};

export interface WeekView extends Omit<AgendaWeek, "events"> {
  /** "9–15 de novembre" */
  range: string;
  title: WeekTitle;
  events: EventView[];
}

/** One day of the mobile "Properes dates" strip. */
export interface StripDay {
  /** `YYYY-MM-DD` on the Madrid calendar. */
  date: string;
  /** "DV" */
  weekday: string;
  /** "13" */
  day: string;
  /** "Divendres 13 de novembre" */
  label: string;
  /** Any event of the day is special. */
  special: boolean;
  titles: string[];
  /** Card a tap opens: the day's special, else its first event. */
  eventId: string;
}

export interface StripWeek {
  /** Monday, `YYYY-MM-DD`. */
  start: string;
  current: boolean;
  /** "16–22 de nov." */
  label: string;
  days: StripDay[];
}

export interface AgendaViewModel {
  weeks: WeekView[];
  specials: EventView[];
  /** Upcoming days with events, by week, for the mobile strip. */
  strip: StripWeek[];
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** ICU puts thin and narrow no-break spaces around range dashes; print plain spaces. */
const plainSpaces = (text: string) => text.replace(/[\u2009\u202f]/g, " ");

/** Noon UTC of a `YYYY-MM-DD` day: the same calendar day in Madrid. */
const dayInstant = (day: string) => new Date(`${day}T12:00:00Z`);

const elided = (dayOfMonth: string): "yes" | "no" => (dayOfMonth === "1" || dayOfMonth === "11" ? "yes" : "no");

const nextDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** "9 – 15 Nov" → "9–15 Nov": tight dash between two day numbers. */
const tightDash = (text: string) => text.replace(/(\d)\s*–\s*(\d)/, "$1–$2");

export function formatAgenda(agenda: Agenda, locale: string, now: Date = new Date()): AgendaViewModel {
  const intl = INTL_LOCALES[locale] ?? locale;
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { timeZone: TIME_ZONE, ...options });

  const dayNumber = fmt({ day: "numeric" });
  const dayMonth = fmt({ day: "numeric", month: "long" });
  const longDate = fmt({ weekday: "long", day: "numeric", month: "long" });
  const shortRange = fmt({ weekday: "short", day: "numeric", month: "long" });
  const weekday = fmt({ weekday: "short" });
  const clock = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const shortMonth = fmt({ day: "numeric", month: "short" });
  /** `YYYY-MM-DD` of an instant in Madrid (en-CA prints ISO order). */
  const isoDay = (instant: Date | string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(instant)
    );

  const tileWeekday = (instant: Date) => weekday.format(instant).replace(/\./g, "").toLocaleUpperCase();

  /** `last` is the event's last Madrid day (madridLastDay): an evening ending at 00:00 is one day. */
  function formatTile(start: Date, last: string): EventTile {
    const tileDay = (instant: Date) => ({ weekday: tileWeekday(instant), day: dayNumber.format(instant) });
    const first = isoDay(start);
    if (first === last) return { days: [tileDay(start)], gap: false };
    return { days: [tileDay(start), tileDay(dayInstant(last))], gap: nextDay(first) !== last };
  }

  const dayTitle = (instant: Date) => capitalize(longDate.format(instant).replace(",", ""));

  function itemTime(item: ProgramItem): string | null {
    if (item.startsAt === null) return null;
    const start = clock.format(new Date(item.startsAt));
    return item.endsAt === null ? start : `${start} – ${clock.format(new Date(item.endsAt))}`;
  }

  function formatProgram(program: ProgramLayout): ProgramView {
    const item = (i: ProgramItem): ItemView => ({ ...i, time: itemTime(i) });
    return {
      ...program,
      days: program.days.map((day) => ({
        ...day,
        title: dayTitle(dayInstant(day.day)),
        groups: day.groups.map((group) => ({
          startsAt: group.startsAt,
          time: group.startsAt === null ? null : clock.format(new Date(group.startsAt)),
          items: group.items.map(item),
        })),
      })),
      alwaysOpen: program.alwaysOpen.map((group) => ({ zone: group.zone, items: group.items.map(item) })),
    };
  }

  function formatEvent(event: AgendaEvent): EventView {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const last = madridLastDay(start, end);
    const multiDay = isoDay(start) !== last;
    const dates = multiDay
      ? capitalize(plainSpaces(shortRange.formatRange(start, dayInstant(last))))
      : dayTitle(start);
    const time = `${clock.format(start)} – ${clock.format(end)}`;
    return {
      ...event,
      tile: formatTile(start, last),
      dates,
      time,
      when: `${dates} · ${time}`,
      program: formatProgram(event.program),
    };
  }

  function formatWeek(week: AgendaWeek): WeekView {
    const monday = dayInstant(week.start);
    const sunday = dayInstant(week.end);
    const sameMonth = week.start.slice(0, 7) === week.end.slice(0, 7);
    const startDay = dayNumber.format(monday);
    return {
      ...week,
      range: plainSpaces(dayMonth.formatRange(monday, sunday)),
      title: {
        start: sameMonth ? startDay : dayMonth.format(monday),
        end: dayMonth.format(sunday),
        startElided: elided(startDay),
        endElided: elided(dayNumber.format(sunday)),
      },
      events: week.events.map(formatEvent),
    };
  }

  function stripWeek(week: AgendaWeek): StripWeek {
    const today = isoDay(now);
    const byDay = new Map<string, AgendaEvent[]>();
    for (const event of week.events) {
      // A multi-day event shows on each of its days still to come.
      const last = madridLastDay(event.startsAt, event.endsAt);
      for (let day = isoDay(event.startsAt); day <= last; day = nextDay(day)) {
        if (day >= today) byDay.set(day, [...(byDay.get(day) ?? []), event]);
      }
    }
    const days = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, events]): StripDay => {
        const instant = dayInstant(date);
        const target = events.find((e) => e.type === "special") ?? events[0];
        return {
          date,
          weekday: tileWeekday(instant),
          day: dayNumber.format(instant),
          label: capitalize(longDate.format(instant).replace(",", "")),
          special: target.type === "special",
          titles: events.map((e) => e.title),
          eventId: target.id,
        };
      });
    return {
      start: week.start,
      current: week.isCurrent,
      label: tightDash(plainSpaces(shortMonth.formatRange(dayInstant(week.start), dayInstant(week.end)))),
      days,
    };
  }

  const weeks = agenda.weeks.map(formatWeek);
  const byId = new Map(weeks.flatMap((w) => w.events).map((e) => [e.id, e]));
  return {
    weeks,
    specials: agenda.specials.map((s) => byId.get(s.id) ?? formatEvent(s)),
    strip: agenda.weeks.map(stripWeek).filter((w) => w.days.length > 0),
  };
}
