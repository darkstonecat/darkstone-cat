// ---------------------------------------------------------------------------
// Events agenda — date texts, formatted on the server
// ---------------------------------------------------------------------------
// Node and browser ICU can differ (apostrophes, abbreviations), so every date
// text of the agenda is formatted here, on the server, and the client
// components only print it. Pure: no React, no server-only imports.

import type { Agenda, AgendaEvent, AgendaPlay, AgendaWeek } from "./agenda-view";

const TIME_ZONE = "Europe/Madrid";
const INTL_LOCALES: Record<string, string> = { ca: "ca-ES", es: "es-ES", en: "en-GB" };

export interface PlayView extends AgendaPlay {
  /** "16:15" */
  time: string;
}

export interface EventView extends Omit<AgendaEvent, "plays"> {
  /** Date tile: "DV" / "13", or "DS–DG" / "28" for a multi-day event. */
  tile: { weekday: string; day: string };
  /** "Divendres 13 de novembre", or a range for a multi-day event. */
  dates: string;
  /** "16:00 – 20:30" */
  time: string;
  /** `dates · time` */
  when: string;
  plays: PlayView[];
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

export interface AgendaViewModel {
  weeks: WeekView[];
  specials: EventView[];
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** ICU puts thin and narrow no-break spaces around range dashes; print plain spaces. */
const plainSpaces = (text: string) => text.replace(/[\u2009\u202f]/g, " ");

/** Noon UTC of a `YYYY-MM-DD` day: the same calendar day in Madrid. */
const dayInstant = (day: string) => new Date(`${day}T12:00:00Z`);

const elided = (dayOfMonth: string): "yes" | "no" => (dayOfMonth === "1" || dayOfMonth === "11" ? "yes" : "no");

export function formatAgenda(agenda: Agenda, locale: string): AgendaViewModel {
  const intl = INTL_LOCALES[locale] ?? locale;
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intl, { timeZone: TIME_ZONE, ...options });

  const dayNumber = fmt({ day: "numeric" });
  const dayMonth = fmt({ day: "numeric", month: "long" });
  const longDate = fmt({ weekday: "long", day: "numeric", month: "long" });
  const shortRange = fmt({ weekday: "short", day: "numeric", month: "long" });
  const weekday = fmt({ weekday: "short" });
  const clock = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const calendarDay = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });

  const tileWeekday = (instant: Date) => weekday.format(instant).replace(/\./g, "").toLocaleUpperCase();

  function formatEvent(event: AgendaEvent): EventView {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const multiDay = calendarDay.format(start) !== calendarDay.format(end);
    const dates = multiDay
      ? capitalize(plainSpaces(shortRange.formatRange(start, end)))
      : capitalize(longDate.format(start).replace(",", ""));
    const time = `${clock.format(start)} – ${clock.format(end)}`;
    return {
      ...event,
      tile: {
        weekday: multiDay ? `${tileWeekday(start)}–${tileWeekday(end)}` : tileWeekday(start),
        day: dayNumber.format(start),
      },
      dates,
      time,
      when: `${dates} · ${time}`,
      plays: event.plays.map((play) => ({ ...play, time: clock.format(new Date(play.startsAt)) })),
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

  const weeks = agenda.weeks.map(formatWeek);
  const byId = new Map(weeks.flatMap((w) => w.events).map((e) => [e.id, e]));
  return { weeks, specials: agenda.specials.map((s) => byId.get(s.id) ?? formatEvent(s)) };
}
