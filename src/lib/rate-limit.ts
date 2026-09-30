// ---------------------------------------------------------------------------
// Tiny in-memory sliding-window rate limiter
// ---------------------------------------------------------------------------
// Best effort only: state lives in one server instance, so on serverless it
// slows a single client hammering one instance rather than enforcing a global
// quota. It exists to keep unauthenticated lookups from burning a shared
// upstream quota (Ludoya allows 100 requests/minute for the whole site).

import "server-only";

const hits = new Map<string, number[]>();
const MAX_KEYS = 5_000;

/** Returns true when the call is allowed, and records it. */
export function allowRequest(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** Test helper. */
export function resetRateLimits(): void {
  hits.clear();
}
