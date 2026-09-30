// ---------------------------------------------------------------------------
// Tiny in-memory sliding-window rate limiter
// ---------------------------------------------------------------------------
// Best effort only: state lives in one server instance, so on serverless it
// slows a single client hammering one instance rather than enforcing a global
// quota. It exists to keep unauthenticated lookups from burning a shared
// upstream quota (Ludoya allows 100 requests/minute for the whole site).

import "server-only";

const hits = new Map<string, number[]>();
export const MAX_KEYS = 5_000;

/**
 * Returns true when the call is allowed, and records it.
 *
 * The map is bounded: a key is re-inserted on every hit, so iteration order is
 * least-recently-used first, and going over MAX_KEYS evicts from the front.
 * That costs O(evicted), not a scan of every key.
 */
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const allowed = recent.length < limit;
  if (allowed) recent.push(now);

  hits.delete(key);
  hits.set(key, recent);

  while (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  return allowed;
}

/** Test helper. */
export function resetRateLimits(): void {
  hits.clear();
}
