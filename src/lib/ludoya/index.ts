// ---------------------------------------------------------------------------
// Ludoya public API — entry point for the rest of the site
// ---------------------------------------------------------------------------
// Consumers import from "@/lib/ludoya" and only see the types in ./types.
// Endpoint paths live in ./config, HTTP concerns in ./client and raw-shape
// knowledge in ./normalize. Member-area data (seats, places, covers) lives in
// `@/lib/member-sessions`.

import "server-only";
import { describeError, isTimeoutError } from "./client";
import { ludoyaConfig } from "./config";
import { fetchSessions } from "./sessions";
import type { LudoyaEvent, LudoyaEventsResult, LudoyaSession } from "./types";

export type {
  LudoyaEvent,
  LudoyaEventsResult,
  LudoyaFetchError,
  LudoyaLocation,
  LudoyaPlace,
  LudoyaPlannedPlay,
  LudoyaSession,
  LudoyaSessionPlay,
  LudoyaUser,
} from "./types";
export { LudoyaApiError } from "./client";
export { LudoyaShapeError } from "./normalize";
export { ludoyaConfig };

/**
 * The public pages only need what the old feed carried. Seat counts, places
 * and organizer names stay out of props that are serialised to the browser.
 */
function toPublicEvent(session: LudoyaSession): LudoyaEvent {
  const publicPlays = session.plannedPlays.filter((play) => play.visibility === "PUBLIC");
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    timeZone: session.timeZone,
    imageUrl: session.imageUrl,
    thumbnailUrl: session.thumbnailUrl,
    plannedPlayCount: publicPlays.length,
    ludoyaUrl: session.ludoyaUrl,
    type: session.type,
    // Group-only plays never reach the public pages or the shareable images.
    plannedPlays: publicPlays.map((play) => ({
      gameName: play.gameName,
      imageUrl: play.imageUrl,
      yearPublished: play.yearPublished,
      slug: play.slug,
    })),
  };
}

/**
 * Upcoming public events (regular sessions and special events) for `/events`
 * and the event images. Keeps the long cache: those pages do not show seat
 * counts, so 24 hours is fine.
 */
export async function fetchUpcomingEvents(): Promise<LudoyaEventsResult> {
  try {
    const sessions = await fetchSessions({ revalidate: ludoyaConfig.eventsRevalidateSeconds });
    const events = sessions.filter((s) => s.visibility === "PUBLIC").map(toPublicEvent);

    return {
      regularEvents: events.filter((e) => e.type === "regular"),
      specialEvents: events.filter((e) => e.type === "special"),
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
