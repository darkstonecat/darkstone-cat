export const DEFAULT_REDIRECT = "/profile";
/** Short-lived cookie carrying the post-magic-link destination (set by LoginForm). */
export const MAGIC_REDIRECT_COOKIE = "magic_redirect";
export const MAGIC_REDIRECT_PATH = "/auth";
/** Matches Supabase's default OTP expiry (1 hour). */
export const MAGIC_REDIRECT_MAX_AGE = 3600;

/**
 * Accepts only same-origin relative paths ("/profile", "/es/about?x=1").
 * Rejects absolute URLs, protocol-relative ("//host"), backslashes, schemes
 * and control characters. Anything else falls back to `fallback`.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  origin: string,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const parsed = new URL(raw, origin);
    // Validate AFTER parsing: dot segments ("/.//evil.com") normalize to "//evil.com".
    if (parsed.origin !== origin) return fallback;
    if (parsed.pathname.startsWith("//") || parsed.pathname.startsWith("/\\")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
