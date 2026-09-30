// ---------------------------------------------------------------------------
// The public card verify page (`/verify/<card_token>`) carries a bearer-like token in its path.
// Third-party analytics must never receive it, so URLs are rewritten before they are sent.
// ---------------------------------------------------------------------------

const VERIFY_SEGMENT = /(\/verify\/)[^/?#]+/;

/** Matches a pathname of the verify page, with or without a locale prefix. */
export const VERIFY_PATH_PATTERN = /^\/(?:(?:ca|es|en)\/)?verify(?:\/|$)/;

export function isVerifyPath(pathname: string): boolean {
  return VERIFY_PATH_PATTERN.test(pathname);
}

/**
 * Replaces the token of `/verify/<token>` with the literal `[token]`, keeping the locale prefix.
 * Works on absolute URLs and on paths; anything else is returned untouched.
 */
export function scrubVerifyUrl(url: string): string {
  return url.replace(VERIFY_SEGMENT, "$1[token]");
}

/** `beforeSend` for Vercel Analytics / Speed Insights: scrubs `event.url` (and `route` when present). */
export function scrubAnalyticsEvent<T extends { url: string }>(event: T): T {
  const scrubbed = { ...event, url: scrubVerifyUrl(event.url) };
  if ("route" in scrubbed && typeof scrubbed.route === "string") {
    (scrubbed as { route: string }).route = scrubVerifyUrl(scrubbed.route);
  }
  return scrubbed;
}
