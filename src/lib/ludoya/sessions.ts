// ---------------------------------------------------------------------------
// Ludoya integration — sessions (events with their planned plays)
// ---------------------------------------------------------------------------
// One request returns every session with its plays (`includeSubEvents`), and a
// second, long-cached one names the usual venue. Callers pick the cache
// lifetime: seat counts need a short one, the public /events page a long one.

import "server-only";
import { describeError, ludoyaGet } from "./client";
import { ludoyaConfig, ludoyaEndpoints } from "./config";
import { parseLocationsResponse, parseSessionsResponse, withUsualVenue } from "./normalize";
import type { LudoyaLocation, LudoyaSession } from "./types";

/** How many past events to request when a caller needs earlier days. */
const PAST_EVENTS_LIMIT = 60;

export const SESSIONS_TIME_ZONE = "Europe/Madrid";

export interface FetchSessionsOptions {
  /** Next.js data-cache lifetime for the events request. */
  revalidate: number;
  /** Also fetch recent past events (calendar months that already happened). */
  includePast?: boolean;
}

async function fetchLocations(): Promise<LudoyaLocation[]> {
  try {
    const raw = await ludoyaGet(ludoyaEndpoints.locations(), {
      revalidate: ludoyaConfig.locationsRevalidateSeconds,
    });
    return parseLocationsResponse(raw);
  } catch (error) {
    // Only the "usual venue" flag depends on it; sessions still render.
    console.warn(`[Ludoya] Locations unavailable, usual venue not flagged: ${describeError(error)}`);
    return [];
  }
}

/** All upcoming (and optionally recent past) sessions with plays and the usual-venue flag. */
export async function fetchSessions({ revalidate, includePast = false }: FetchSessionsOptions): Promise<LudoyaSession[]> {
  const [raw, locations] = await Promise.all([
    ludoyaGet(
      ludoyaEndpoints.events({ includeSubEvents: true, pastLimit: includePast ? PAST_EVENTS_LIMIT : undefined }),
      { revalidate }
    ),
    fetchLocations(),
  ]);
  const sessions = parseSessionsResponse(raw, { includePast });
  return withUsualVenue(sessions, locations).sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// Time windows (pure, Europe/Madrid calendar days)
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` of an instant on the Madrid calendar. */
export function madridDay(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SESSIONS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Sessions still to come (or in progress) within the next `days` Madrid
 * calendar days, today included.
 */
export function sessionsInNextDays(sessions: LudoyaSession[], now: Date, days = 7): LudoyaSession[] {
  const first = madridDay(now);
  const last = addDays(first, days - 1);
  return sessions.filter((s) => {
    const day = madridDay(s.startsAt);
    return new Date(s.endsAt) > now && day >= first && day <= last;
  });
}

/** Sessions that start in the given Madrid calendar month (`month` is 1–12). */
export function sessionsInMonth(sessions: LudoyaSession[], year: number, month: number): LudoyaSession[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return sessions.filter((s) => madridDay(s.startsAt).startsWith(prefix));
}
