// ---------------------------------------------------------------------------
// Ludoya integration — username lookup
// ---------------------------------------------------------------------------

import "server-only";
import { describeError, ludoyaGet } from "./client";
import { ludoyaEndpoints, USERNAME_CHECK_LIMITS } from "./config";
import { parseUserSearchResponse } from "./normalize";

export type UsernameCheckStatus = "found" | "not_found" | "failed";

/**
 * Does a Ludoya account with exactly this username exist? Uses the play-intent
 * user search, which can miss people who opted out of being tagged in plays, so
 * `not_found` is a soft signal, never proof. Never throws; any failure is
 * `failed`. Not cached beyond the 30 s the API itself allows.
 */
export async function lookupLudoyaUsername(username: string): Promise<UsernameCheckStatus> {
  try {
    const raw = await ludoyaGet(ludoyaEndpoints.searchUsers(username, { size: 10 }), { revalidate: 0, ...USERNAME_CHECK_LIMITS });
    const wanted = username.toLowerCase();
    return parseUserSearchResponse(raw).some((u) => u.username.toLowerCase() === wanted)
      ? "found"
      : "not_found";
  } catch (error) {
    console.warn(`[Ludoya] Username check failed: ${describeError(error)}`);
    return "failed";
  }
}
