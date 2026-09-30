// ---------------------------------------------------------------------------
// Member area — sessions data for "La meva zona"
// ---------------------------------------------------------------------------
// Composes the Ludoya adapter with BGG covers. Seat counts change while people
// sign up, so this data is cached for 60 seconds (the public /events page keeps
// its 24 hours). If Ludoya is down, the fetch data cache keeps serving the last
// good response; only a cold cache surfaces the error state.

import "server-only";
import { fetchBggCollection, type BggGame } from "./bgg";
import { resolvePlayCovers } from "./game-matching";
import { ludoyaConfig, MEMBER_AREA_LIMITS } from "./ludoya/config";
import { describeError, isTimeoutError } from "./ludoya/client";
import {
  fetchSessions,
  sessionsInMonth,
  sessionsInNextDays,
} from "./ludoya/sessions";
import type { LudoyaFetchError, LudoyaSession, LudoyaSessionPlay } from "./ludoya/types";

/** The home shows at most this many plays per session, so only those get BGG covers. */
export const MAX_PLAYS_SHOWN = 5;

export interface MemberSessionPlay extends LudoyaSessionPlay {
  /** BGG cover when the game resolves by name and year, else Ludoya's. */
  coverUrl: string | null;
}

export interface MemberSession extends Omit<LudoyaSession, "plannedPlays"> {
  plannedPlays: MemberSessionPlay[];
}

export interface MemberSessionsResult {
  sessions: MemberSession[];
  error?: LudoyaFetchError;
}

export interface MonthEventsResult {
  events: LudoyaSession[];
  error?: LudoyaFetchError;
}

const errorKind = (error: unknown): LudoyaFetchError => (isTimeoutError(error) ? "timeout" : "api_error");

async function loadCollection(): Promise<BggGame[]> {
  try {
    return (await fetchBggCollection()).games;
  } catch (error) {
    console.warn(`[Covers] Club collection unavailable: ${describeError(error)}`);
    return [];
  }
}

async function withCovers(sessions: LudoyaSession[]): Promise<MemberSession[]> {
  const shown = sessions.flatMap((s) => s.plannedPlays.slice(0, MAX_PLAYS_SHOWN));
  const covers =
    shown.length > 0 ? await resolvePlayCovers(shown, await loadCollection()) : new Map<string, string | null>();

  return sessions.map((session) => ({
    ...session,
    plannedPlays: session.plannedPlays.map((play) => ({
      ...play,
      coverUrl: covers.get(play.id) ?? play.imageUrl,
    })),
  }));
}

/**
 * Sessions of the next seven Madrid calendar days (today included, in-progress
 * ones too) with their plays, seat counts, place and covers.
 */
export async function fetchMemberWeekSessions(now: Date = new Date()): Promise<MemberSessionsResult> {
  try {
    const sessions = await fetchSessions({ revalidate: ludoyaConfig.memberAreaRevalidateSeconds, limits: MEMBER_AREA_LIMITS });
    return { sessions: await withCovers(sessionsInNextDays(sessions, now)) };
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch member sessions: ${describeError(error)}`);
    return { sessions: [], error: errorKind(error) };
  }
}

/**
 * Sessions starting in a Madrid calendar month (`month` is 1–12) for the home
 * calendar. Earlier days of the current month and past months come from
 * Ludoya's recent past events; the calendar pills need no covers.
 */
export async function fetchMonthEvents(year: number, month: number, now: Date = new Date()): Promise<MonthEventsResult> {
  const needsPast = new Date(Date.UTC(year, month - 1, 1)) < now;
  try {
    const sessions = await fetchSessions({
      revalidate: ludoyaConfig.memberAreaRevalidateSeconds,
      includePast: needsPast,
      limits: MEMBER_AREA_LIMITS,
    });
    return { events: sessionsInMonth(sessions, year, month) };
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch month events: ${describeError(error)}`);
    return { events: [], error: errorKind(error) };
  }
}
