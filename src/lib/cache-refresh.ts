// ---------------------------------------------------------------------------
// Scheduled cache refresh — registry and runner
// ---------------------------------------------------------------------------
// Fetch data-cache entries are only refreshed by the request that reads them,
// so with no traffic they can stay old for days. A scheduled call to
// `/api/cron/refresh` marks each job's tag stale (`"max"`: stale data keeps
// being served while it refreshes, so an outage never empties the cache) and
// re-reads the same requests the pages use. Add a job here to cover another
// cache (e.g. BGG once its fetches are tagged).

import "server-only";
import { revalidateTag } from "next/cache";
import { LUDOYA_CACHE_TAG } from "./ludoya/config";
import { fetchPublicSessions } from "./ludoya";
import { fetchMemberAreaSessions } from "./member-sessions";

export interface RefreshJob {
  name: string;
  /** Data-cache tag marked stale before the warm-up. */
  tag: string;
  /**
   * Re-reads the requests the pages make. They must be the very same calls
   * (the fetch cache key is URL + headers), so reuse the pages' functions.
   */
  warm: () => Promise<unknown>;
}

export interface RefreshJobResult {
  name: string;
  ok: boolean;
  /** Error message only, never credentials. */
  error?: string;
}

export const REFRESH_JOBS: RefreshJob[] = [
  {
    name: "ludoya",
    tag: LUDOYA_CACHE_TAG,
    // Member area (60 s, with past events) and the public /events pages (24 h).
    warm: () => Promise.all([fetchMemberAreaSessions(), fetchPublicSessions()]),
  },
];

/** Run every job in order; a failing job is reported and does not stop the rest. */
export async function runRefreshJobs(jobs: RefreshJob[] = REFRESH_JOBS): Promise<RefreshJobResult[]> {
  const results: RefreshJobResult[] = [];
  for (const job of jobs) {
    try {
      revalidateTag(job.tag, "max");
      await job.warm();
      results.push({ name: job.name, ok: true });
    } catch (error) {
      results.push({ name: job.name, ok: false, error: error instanceof Error ? error.message : "unknown error" });
    }
  }
  return results;
}
