// ---------------------------------------------------------------------------
// Events agenda — data for the public /events page
// ---------------------------------------------------------------------------
// Reads the same 60 s Ludoya request as the member area (seat counts change
// while people sign up), keeps the sessions the page shows, adds BGG covers
// within their time budget and returns the client-safe view model.

import "server-only";
import { describeError, isTimeoutError } from "@/lib/ludoya/client";
import type { LudoyaFetchError } from "@/lib/ludoya/types";
import { fetchMemberAreaSessions, withCovers } from "@/lib/member-sessions";
import { selectAgendaSessions, toAgenda, type Agenda } from "./agenda-view";

export interface EventsAgendaResult {
  agenda: Agenda;
  error?: LudoyaFetchError;
}

/** Every shown play gets a BGG lookup (still bounded by the cover budget). */
const ALL_PLAYS = Number.POSITIVE_INFINITY;

export async function fetchEventsAgenda(now: Date = new Date()): Promise<EventsAgendaResult> {
  try {
    const sessions = selectAgendaSessions(await fetchMemberAreaSessions(), now);
    return { agenda: toAgenda(await withCovers(sessions, ALL_PLAYS), now) };
  } catch (error) {
    console.error(`[Ludoya] Failed to fetch the events agenda: ${describeError(error)}`);
    return { agenda: { weeks: [], specials: [] }, error: isTimeoutError(error) ? "timeout" : "api_error" };
  }
}
