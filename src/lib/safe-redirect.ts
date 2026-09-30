export const DEFAULT_REDIRECT = "/profile";

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
    if (parsed.origin !== origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
