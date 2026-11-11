// ---------------------------------------------------------------------------
// Events agenda — pure rules for the public /events page
// ---------------------------------------------------------------------------
// Turns the member-area sessions (60 s cache, with covers) into the view model
// the page sends to the browser: PUBLIC only, grouped by Madrid week, this week
// plus the next three, and every special event of the next 12 months. The view
// model never carries organizer names, visibility or the usual venue's place.
// No React and no server-only imports, so components and tests can use it.

import type { MemberSession } from "@/lib/member-sessions";
import type { LudoyaPlace, LudoyaSession } from "@/lib/ludoya/types";
import { madridDay } from "./madrid-day";
import { classifyProgram, layoutProgram, seatedItems, type ProgramLayout } from "./program";

export { programItems } from "./program";

/** This week plus the three following ones. */
export const AGENDA_WEEKS = 4;
/** Special events shown as banners above the timeline. */
export const MAX_BANNERS = 3;
/** Special events are listed when they start within this many months. */
const SPECIAL_MONTHS_AHEAD = 12;

/** A place worth naming: only set when it is not the association's usual venue. */
export interface AgendaPlace {
  name: string;
  address: string | null;
}

export type Countdown =
  | { kind: "days"; days: number }
  | { kind: "tomorrow"; days: 1 }
  | { kind: "today"; days: 0 }
  /** A multi-day event that started on an earlier day and is still running. */
  | { kind: "running"; days: 0 };

export interface AgendaEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  type: "regular" | "special";
  imageUrl: string | null;
  ludoyaUrl: string;
  place: AgendaPlace | null;
  participantCount: number;
  capacity: number | null;
  /** Days left, for special events only. */
  countdown: Countdown | null;
  /** Plays, tournaments, activities and demos, laid out by day (PUBLIC only, no organizers). */
  program: ProgramLayout;
}

export interface AgendaWeek {
  /** Monday, `YYYY-MM-DD` (Madrid). */
  start: string;
  /** Sunday, `YYYY-MM-DD` (Madrid). */
  end: string;
  isCurrent: boolean;
  events: AgendaEvent[];
}

export interface Agenda {
  weeks: AgendaWeek[];
  /** Upcoming special events for the banners, soonest first. */
  specials: AgendaEvent[];
}

const dayToUtc = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

function addDays(day: string, days: number): string {
  return new Date(dayToUtc(day) + days * 86_400_000).toISOString().slice(0, 10);
}

function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) => Math.round((dayToUtc(to) - dayToUtc(from)) / 86_400_000);

/** Monday of the Madrid week that contains `day` (`YYYY-MM-DD`). */
export function madridWeekStart(day: string): string {
  const weekday = new Date(dayToUtc(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Days left until an event, counted in Madrid calendar days. */
export function countdown(event: { startsAt: string; endsAt: string }, now: Date): Countdown {
  const today = madridDay(now);
  const days = daysBetween(today, madridDay(event.startsAt));
  if (days < 0) return { kind: "running", days: 0 };
  if (days === 0) return { kind: "today", days: 0 };
  if (days === 1) return { kind: "tomorrow", days: 1 };
  return { kind: "days", days };
}

const toPlace = (place: LudoyaPlace | null): AgendaPlace | null =>
  place && !place.isUsual ? { name: place.name, address: place.address } : null;

function toEvent(session: MemberSession, now: Date): AgendaEvent {
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    type: session.type,
    imageUrl: session.imageUrl,
    ludoyaUrl: session.ludoyaUrl,
    place: toPlace(session.place),
    participantCount: session.participantCount,
    capacity: session.capacity,
    countdown: session.type === "special" ? countdown(session, now) : null,
    program: layoutProgram(classifyProgram(session.subEvents, session), session),
  };
}

type SelectableSession = Pick<LudoyaSession, "visibility" | "startsAt" | "endsAt" | "type"> & {
  plannedPlays: { visibility: string }[];
};

/**
 * Sessions the page shows, sorted by start, with their PUBLIC plays only:
 * PUBLIC sessions not yet ended that start this week or in the next three, or
 * special events starting within 12 months. Runs before the cover lookup so
 * BGG is asked only about plays that will be shown.
 */
export function selectAgendaSessions<T extends SelectableSession>(sessions: T[], now: Date): T[] {
  const thisWeek = madridWeekStart(madridDay(now));
  const lastRegularDay = addDays(thisWeek, AGENDA_WEEKS * 7 - 1);
  const lastSpecialDay = addMonths(madridDay(now), SPECIAL_MONTHS_AHEAD);

  return sessions
    .filter((s) => s.visibility === "PUBLIC" && new Date(s.endsAt) > now)
    .filter((s) => madridDay(s.startsAt) <= (s.type === "special" ? lastSpecialDay : lastRegularDay))
    .map((s) => ({ ...s, plannedPlays: s.plannedPlays.filter((p) => p.visibility === "PUBLIC") }))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/**
 * The agenda of the public page. Sessions that already ended are dropped; a
 * multi-day event that started earlier and is still running goes in this week.
 */
export function toAgenda(sessions: MemberSession[], now: Date): Agenda {
  const thisWeek = madridWeekStart(madridDay(now));
  const shown = selectAgendaSessions(sessions, now);

  const byWeek = new Map<string, AgendaEvent[]>();
  for (const session of shown) {
    const start = madridWeekStart(madridDay(session.startsAt));
    const week = start < thisWeek ? thisWeek : start;
    byWeek.set(week, [...(byWeek.get(week) ?? []), toEvent(session, now)]);
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, events]) => ({ start, end: addDays(start, 6), isCurrent: start === thisWeek, events }));

  const specials = weeks
    .flatMap((w) => w.events)
    .filter((e) => e.type === "special")
    .slice(0, MAX_BANNERS);

  return { weeks, specials };
}

type SeatsOnly = { participantCount: number; capacity: number | null };

export type EventAvailability =
  | { kind: "none" }
  | { kind: "seats"; free: number }
  | { kind: "unlimited" }
  | { kind: "all_full" };

function summarizeSeats(items: SeatsOnly[]): { playCount: number; availability: EventAvailability } {
  const free = items.reduce((sum, p) => sum + (p.capacity === null ? 0 : Math.max(p.capacity - p.participantCount, 0)), 0);
  let availability: EventAvailability;
  if (items.length === 0) availability = { kind: "none" };
  else if (free > 0) availability = { kind: "seats", free };
  else if (items.some((p) => p.capacity === null)) availability = { kind: "unlimited" };
  else availability = { kind: "all_full" };
  return { playCount: items.length, availability };
}

/** Summary of a collapsed card: how many plays and tournaments, and what room is left. */
export function summarizeEvent(event: { program: ProgramLayout }): { playCount: number; availability: EventAvailability } {
  return summarizeSeats(seatedItems(event.program));
}

/** Counts shown under a week title. */
export function weekSummary(events: { type: AgendaEvent["type"]; program: ProgramLayout }[]) {
  const summaries = events.map(summarizeEvent);
  return {
    sessions: events.filter((e) => e.type === "regular").length,
    specials: events.filter((e) => e.type === "special").length,
    plays: summaries.reduce((sum, s) => sum + s.playCount, 0),
    free: summaries.reduce((sum, s) => sum + (s.availability.kind === "seats" ? s.availability.free : 0), 0),
  };
}
