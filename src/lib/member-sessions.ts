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
import { MAX_PLAYS_SHOWN } from "./member-home/sessions-view";
import { describeError, isTimeoutError } from "./ludoya/client";
import {
  fetchSessions,
  sessionsInMonth,
  sessionsInNextDays,
} from "./ludoya/sessions";
import type { LudoyaFetchError, LudoyaSession, LudoyaSessionPlay } from "./ludoya/types";

/**
 * The week and every calendar month share ONE events request: the same URL
 * (`includeSubEvents` + `pastLimit` 200, the default of `fetchSessions`), so
 * one page load costs one events fetch (plus locations) under the 60 s data
 * cache instead of one per variant. The past events also keep a multi-day
 * event that already started (and is still running) from being lost;
 * `sessionsInNextDays` drops whatever already ended.
 */
const fetchAll = () =>
  fetchSessions({
    revalidate: ludoyaConfig.memberAreaRevalidateSeconds,
    includePast: true,
    limits: MEMBER_AREA_LIMITS,
  });

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

/**
 * Cover matching goes through BGG (collection, search, things), whose calls can
 * take 30 s or poll on 202, so it is raced against this budget: plays that do
 * not resolve in time keep Ludoya's own image and the page never waits on BGG.
 * The lookups keep running and warm the fetch cache for the next render.
 */
export const COVER_BUDGET_MS = 2_500;

async function resolveCoversWithin(shown: LudoyaSessionPlay[], budgetMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Map<string, string | null>>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[Covers] BGG lookup exceeded ${budgetMs} ms; using Ludoya covers`);
      resolve(new Map());
    }, budgetMs);
  });
  const lookup = (async () => resolvePlayCovers(shown, await loadCollection()))().catch((error) => {
    console.warn(`[Covers] BGG lookup failed: ${describeError(error)}`);
    return new Map<string, string | null>();
  });
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function withCovers(sessions: LudoyaSession[]): Promise<MemberSession[]> {
  const shown = sessions.flatMap((s) => s.plannedPlays.slice(0, MAX_PLAYS_SHOWN));
  const covers = shown.length > 0 ? await resolveCoversWithin(shown, COVER_BUDGET_MS) : new Map<string, string | null>();

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
    const sessions = await fetchAll();
    return { sessions: await withCovers(sessionsInNextDays(sessions, now)) };
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch member sessions: ${describeError(error)}`);
    return { sessions: [], error: errorKind(error) };
  }
}

/**
 * Sessions starting in a Madrid calendar month (`month` is 1–12) for the home
 * calendar, from the same request as the week. Earlier days and past months come
 * from Ludoya's recent past events; the calendar pills need no covers.
 */
export async function fetchMonthEvents(year: number, month: number): Promise<MonthEventsResult> {
  try {
    const sessions = await fetchAll();
    return { events: sessionsInMonth(sessions, year, month) };
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch month events: ${describeError(error)}`);
    return { events: [], error: errorKind(error) };
  }
}
