// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
// `allowRequest` is a tiny in-memory sliding window. It is best effort only: state
// lives in one server instance, so on serverless it slows a single client hammering
// one instance rather than enforcing a global quota.
//
// `allowRequestShared` enforces the quota across instances through the
// `rate_limit_hit` Postgres function (service role only) and falls back to the
// in-memory limiter whenever Supabase is unavailable, so an outage never takes the
// protected endpoint down. Use it for public endpoints that cost real money or a
// shared upstream quota (contact email, Ludoya lookups).

import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Longest wait for the shared limiter before falling back to the in-memory one. */
const SHARED_TIMEOUT_MS = 3_000;

/**
 * Bucket name for the shared table. Identities (IPs) are stored only as an HMAC keyed
 * from ENCRYPTION_KEY, so the table never holds a raw IP. Returns null when an identity
 * is given but the key is missing.
 */
function sharedBucket(scope: string, identity: string | null): string | null {
  if (identity === null) return scope;
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return null;
  const key = createHmac("sha256", secret).update("rate-limit-bucket-v1").digest();
  return `${scope}:${createHmac("sha256", key).update(identity).digest("hex")}`;
}

/**
 * Sliding-window limit shared by every server instance. Returns true when the call is
 * allowed, and records it.
 *
 * `scope` names the limit (e.g. "contact"); `identity` (usually the client IP) is
 * optional and, when given, is hashed into the bucket. Pass null for a global bucket.
 * On any Supabase error, timeout or missing configuration it fails open to the
 * in-memory limiter and logs one warning without the identity.
 */
export async function allowRequestShared(
  scope: string,
  identity: string | null,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const fallback = () => allowRequest(identity === null ? scope : `${scope}:${identity}`, limit, windowMs);
  const bucket = sharedBucket(scope, identity);
  const warn = (reason: unknown) =>
    console.warn(`[rate-limit] shared limiter unavailable for "${scope}", using in-memory fallback`, { reason });

  if (bucket === null) {
    warn("missing_secret");
    return fallback();
  }
  try {
    const { data, error } = await createAdminClient()
      .rpc("rate_limit_hit", {
        p_bucket: bucket,
        p_max: limit,
        p_window_seconds: Math.ceil(windowMs / 1000),
      })
      .abortSignal(AbortSignal.timeout(SHARED_TIMEOUT_MS));
    if (!error && typeof data === "boolean") return data;
    warn(error?.code ?? error?.message ?? "unexpected_response");
  } catch (e) {
    warn(e instanceof Error ? e.name : "unknown");
  }
  return fallback();
}

/** Test helper. */
export function resetRateLimits(): void {
  hits.clear();
}
