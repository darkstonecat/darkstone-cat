// ---------------------------------------------------------------------------
// Ludoya sessions with BGG covers — the data behind the /events agenda
// ---------------------------------------------------------------------------
// Seat counts change while people sign up, so the sessions request is cached
// for 60 seconds (the admin event images keep `fetchUpcomingEvents` and its 24
// hours). If Ludoya is down, the fetch data cache keeps serving the last good
// response; only a cold cache surfaces the error state.

import "server-only";
import { fetchBggCollection, type BggGame } from "./bgg";
import { resolvePlayCovers } from "./game-matching";
import { ludoyaConfig, MEMBER_AREA_LIMITS } from "./ludoya/config";
import { describeError } from "./ludoya/client";
import { fetchSessions } from "./ludoya/sessions";
import type { LudoyaSession, LudoyaSessionPlay } from "./ludoya/types";

/**
 * The agenda and every calendar month share ONE events request: the same URL
 * (`includeSubEvents` + `pastLimit` 200, the default of `fetchSessions`), so
 * one page load costs one events fetch (plus locations) under the 60 s data
 * cache instead of one per view. The past events also keep a multi-day event
 * that already started (and is still running) from being lost; the agenda
 * drops whatever already ended. `/api/cron/refresh` warms this request.
 */
export const fetchMemberAreaSessions = () =>
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

/**
 * Adds a cover to every play; only the first `playsPerSession` plays of each
 * session are looked up on BGG, the rest keep Ludoya's image.
 */
export async function withCovers(sessions: LudoyaSession[], playsPerSession: number): Promise<MemberSession[]> {
  const shown = sessions.flatMap((s) => s.plannedPlays.slice(0, playsPerSession));
  const covers = shown.length > 0 ? await resolveCoversWithin(shown, COVER_BUDGET_MS) : new Map<string, string | null>();

  return sessions.map((session) => ({
    ...session,
    plannedPlays: session.plannedPlays.map((play) => ({
      ...play,
      coverUrl: covers.get(play.id) ?? play.imageUrl,
    })),
  }));
}
