/**
 * Best-effort client IP for throttling. The platform sets `x-real-ip` itself, so it
 * wins; only then fall back to the first hop of `x-forwarded-for`. Returns "unknown"
 * when neither is present (local tooling), which all share one bucket.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
