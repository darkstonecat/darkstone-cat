// ---------------------------------------------------------------------------
// Scheduled cache refresh — registry and runner
// ---------------------------------------------------------------------------
// Fetch data-cache entries are only refreshed by the request that reads them,
// so with no traffic they can stay old for days. A scheduled call to
// `/api/cron/refresh` marks each job's tag stale (`"max"`: stale data keeps
// being served while it refreshes, so an outage never empties the cache) and
// re-reads the same requests the pages use. Add a job here to cover another
// cache.

import "server-only";
import { revalidateTag } from "next/cache";
import { LUDOYA_CACHE_TAG } from "./ludoya/config";
import { fetchPublicSessions } from "./ludoya";
import { BGG_CACHE_TAG, fetchBggCollectionOrThrow } from "./bgg";
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
  /** Wall time of the job (revalidate + warm-up), whole milliseconds. */
  durationMs: number;
  /** Error message only, never credentials. Not stored and not shown in the panel. */
  error?: string;
  /** Short code (`refreshErrorCode`), safe to store and show: ops_job_runs, the V-6 screen. */
  errorCode?: string;
}

export const REFRESH_JOBS: RefreshJob[] = [
  {
    name: "ludoya",
    tag: LUDOYA_CACHE_TAG,
    // Member area (60 s, with past events) and the public /events pages (24 h).
    warm: () => Promise.all([fetchMemberAreaSessions(), fetchPublicSessions()]),
  },
  {
    name: "bgg",
    tag: BGG_CACHE_TAG,
    // Club collection page (24 h). The throwing variant makes a failed BGG
    // call fail the job; in mock mode it just re-reads the local fixtures.
    warm: () => fetchBggCollectionOrThrow(),
  },
];

const SHORT_CODE = /^[a-z0-9_]{1,40}$/;

/**
 * A short, storable code for a failed job (`^[a-z0-9_]{1,40}$`, the ops_job_runs CHECK): the
 * Ludoya client's own code (`timeout`, `rate_limited`, …), `shape_changed`, `timeout`,
 * `http_<status>`, `missing_api_key`, otherwise `error`. Never derived from free text beyond
 * those fixed patterns, so no upstream message or URL can reach the database or the screen.
 */
export function refreshErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "error";
  const code = (error as { code?: unknown }).code;
  if (error.name === "LudoyaApiError") return typeof code === "string" && SHORT_CODE.test(code) ? code : "error";
  if (error.name === "LudoyaShapeError") return "shape_changed";
  if (error.name === "TimeoutError" || /\btimeout\b/i.test(error.message)) return "timeout";
  if (/BGG_API_KEY not set/.test(error.message)) return "missing_api_key";
  const status = /\bHTTP (\d{3})\b/.exec(error.message);
  if (status) return `http_${status[1]}`;
  return "error";
}

/** Run every job in order; a failing job is reported and does not stop the rest. */
export async function runRefreshJobs(jobs: RefreshJob[] = REFRESH_JOBS): Promise<RefreshJobResult[]> {
  const results: RefreshJobResult[] = [];
  for (const job of jobs) {
    const started = Date.now();
    const elapsed = () => Math.max(0, Math.round(Date.now() - started));
    try {
      revalidateTag(job.tag, "max");
      await job.warm();
      results.push({ name: job.name, ok: true, durationMs: elapsed() });
    } catch (error) {
      results.push({
        name: job.name,
        ok: false,
        durationMs: elapsed(),
        error: error instanceof Error ? error.message : "unknown error",
        errorCode: refreshErrorCode(error),
      });
    }
  }
  return results;
}
