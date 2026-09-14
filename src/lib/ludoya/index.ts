// ---------------------------------------------------------------------------
// Ludoya API — fetch upcoming events for Darkstone Catalunya
// ---------------------------------------------------------------------------
// Public entry point. Consumers import from "@/lib/ludoya" and only see the
// types in ./types; endpoint paths live in ./config, HTTP concerns in
// ./client and raw-shape knowledge in ./normalize.

import { ludoyaConfig, ludoyaEndpoints } from "./config";
import { describeError, fetchGroupEventsRaw, isTimeoutError, ludoyaGet } from "./client";
import { parseBoardgameResponse, parseChildrenResponse, parseEventsResponse } from "./normalize";
import type { LudoyaEvent, LudoyaEventsResult } from "./types";

export type { LudoyaEvent, LudoyaEventsResult, LudoyaFetchError, LudoyaPlannedPlay } from "./types";
export { LudoyaApiError } from "./client";
export { LudoyaShapeError } from "./normalize";
export { ludoyaConfig };

/**
 * Look up the BoardGameGeek id of each game slug through Ludoya's game detail.
 * Slugs that fail or have no BGG link are absent from the result, so callers
 * can fall back to name matching. Results are cached for 30 days.
 */
export async function resolveBggIds(slugs: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  const result = new Map<string, string>();

  for (let i = 0; i < unique.length; i += ludoyaConfig.gameLookupConcurrency) {
    const batch = unique.slice(i, i + ludoyaConfig.gameLookupConcurrency);
    await Promise.all(
      batch.map(async (slug) => {
        try {
          const raw = await ludoyaGet(ludoyaEndpoints.boardgame(slug), {
            revalidate: ludoyaConfig.gameRevalidateSeconds,
          });
          const bggId = parseBoardgameResponse(raw, slug);
          if (bggId) result.set(slug, bggId);
        } catch (error) {
          console.warn(`[Ludoya] BGG id unavailable for "${slug}": ${describeError(error)}`);
        }
      })
    );
  }
  return result;
}

export async function fetchUpcomingEvents(): Promise<LudoyaEventsResult> {
  try {
    const events = parseEventsResponse(await fetchGroupEventsRaw());

    // Planned plays live in child events; fetch them only where the count says so.
    const withPlays = events.filter((e) => e.plannedPlayCount > 0);
    const plays = await Promise.all(
      withPlays.map((event) =>
        ludoyaGet(ludoyaEndpoints.eventChildren(event.id))
          .then((raw) => parseChildrenResponse(raw, event.id))
          .catch((error: unknown) => {
            // A single event's games failing should not take the page down.
            console.warn(`[Ludoya] Planned plays unavailable for ${event.id}: ${describeError(error)}`);
            return [];
          })
      )
    );
    withPlays.forEach((event, i) => {
      event.plannedPlays = plays[i];
    });

    const byDate = (a: LudoyaEvent, b: LudoyaEvent) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

    return {
      regularEvents: events.filter((e) => e.type === "regular").sort(byDate),
      specialEvents: events.filter((e) => e.type === "special").sort(byDate),
    };
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch events: ${describeError(error)}`);
    return {
      regularEvents: [],
      specialEvents: [],
      error: isTimeoutError(error) ? "timeout" : "api_error",
    };
  }
}

