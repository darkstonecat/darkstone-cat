// ---------------------------------------------------------------------------
// Member home — presentation rules for "Properes sessions"
// ---------------------------------------------------------------------------
// Pure helpers shared by the server panel and the client list: which sessions
// and plays may be shown, seat status, counts and date formatting. No React and
// no server-only imports, so components and tests can use them freely.

import type { MemberSession, MemberSessionPlay } from "@/lib/member-sessions";

/** The home shows at most this many plays per session (and only those get BGG covers). */
export const MAX_PLAYS_SHOWN = 5;
/** Seat dots are drawn only when a play has at most this many seats. */
export const SEAT_DOTS_MAX = 8;
/** Covers in the collapsed session header. */
export const MAX_STACK_COVERS = 4;

const TIME_ZONE = "Europe/Madrid";

const INTL_LOCALES: Record<string, string> = { ca: "ca-ES", es: "es-ES", en: "en-GB" };
const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? locale;

/**
 * The organisation's key returns events of every visibility. Web sign-up is open
 * and every account gets `role = 'member'`, so the member home shows `PUBLIC`
 * sessions and plays only, like `/events`. `ONLY_GROUP` stays hidden until a
 * board-approved (paid) member state exists.
 */
export function toPublicSessions<T extends { visibility: string; plannedPlays: { visibility: string }[] }>(
  sessions: T[]
): T[] {
  return sessions
    .filter((s) => s.visibility === "PUBLIC")
    .map((s) => ({ ...s, plannedPlays: s.plannedPlays.filter((p) => p.visibility === "PUBLIC") }));
}

export type SeatKind = "unlimited" | "free" | "last" | "full";

export interface PlaySeats {
  kind: SeatKind;
  taken: number;
  capacity: number | null;
  /** Free seats; null when the play has no limit. */
  free: number | null;
}

/**
 * Seat status of a play. The public API does not expose the waiting list, so a
 * full play carries no queue number.
 */
export function playSeats(play: Pick<MemberSessionPlay, "participantCount" | "capacity">): PlaySeats {
  const taken = play.participantCount;
  if (play.capacity === null) return { kind: "unlimited", taken, capacity: null, free: null };
  const free = Math.max(play.capacity - taken, 0);
  const kind: SeatKind = free === 0 ? "full" : free === 1 ? "last" : "free";
  return { kind, taken, capacity: play.capacity, free };
}

export type SessionAvailability =
  | { kind: "none" }
  | { kind: "seats"; free: number }
  | { kind: "unlimited" }
  | { kind: "all_full" };

export interface SessionSummary {
  playCount: number;
  availability: SessionAvailability;
}

/** Counts line of a session, over all its plays (not only the ones shown). */
export function summarizeSession(session: Pick<MemberSession, "plannedPlays">): SessionSummary {
  const seats = session.plannedPlays.map(playSeats);
  const free = seats.reduce((sum, s) => sum + (s.free ?? 0), 0);
  let availability: SessionAvailability;
  if (seats.length === 0) availability = { kind: "none" };
  else if (free > 0) availability = { kind: "seats", free };
  else if (seats.some((s) => s.kind === "unlimited")) availability = { kind: "unlimited" };
  else availability = { kind: "all_full" };
  return { playCount: seats.length, availability };
}

const formatParts = (instant: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TIME_ZONE, ...options }).format(new Date(instant));

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Weekday abbreviation and day of the month for the date tile ("DJ", "1"). */
export function formatTile(startsAt: string, locale: string): { weekday: string; day: string } {
  return {
    weekday: formatParts(startsAt, locale, { weekday: "short" }).replace(/\./g, "").toLocaleUpperCase(),
    day: formatParts(startsAt, locale, { day: "numeric" }),
  };
}

/** "Dijous 1 d'octubre · 19:00 – 22:30"; a session that ends another day names that day. */
export function formatSessionWhen(session: Pick<MemberSession, "startsAt" | "endsAt">, locale: string): string {
  const date = capitalize(
    formatParts(session.startsAt, locale, { weekday: "long", day: "numeric", month: "long" }).replace(",", "")
  );
  const time = (iso: string) => formatParts(iso, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const sameDay =
    formatParts(session.startsAt, locale, { dateStyle: "short" }) === formatParts(session.endsAt, locale, { dateStyle: "short" });
  const end = sameDay
    ? time(session.endsAt)
    : `${formatParts(session.endsAt, locale, { day: "numeric", month: "short" })} ${time(session.endsAt)}`;
  return `${date} · ${time(session.startsAt)} – ${end}`;
}

/** A session with its date text already formatted, ready for the client list. */
export type SessionRow = MemberSession & {
  tile: { weekday: string; day: string };
  when: string;
};

/**
 * Formats the date text on the server: Node and browser ICU can differ
 * (apostrophes, abbreviations), so a client component that formats dates
 * risks a hydration mismatch.
 */
export function toSessionRow(session: MemberSession, locale: string): SessionRow {
  return { ...session, tile: formatTile(session.startsAt, locale), when: formatSessionWhen(session, locale) };
}
