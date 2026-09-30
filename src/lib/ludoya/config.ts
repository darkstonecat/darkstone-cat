// ---------------------------------------------------------------------------
// Ludoya integration — configuration (public v1 API)
// ---------------------------------------------------------------------------
// Everything Ludoya may change on their side lives here: hosts and endpoint
// paths. The organisation is implied by the API key, so there is no group id.
// See docs/ludoya-api-reference.md.

function env(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
}

export const ludoyaConfig = {
  /**
   * API host (no trailing slash). Override with LUDOYA_API_URL to point at the
   * sandbox (https://api.dev.ludoya.com), which needs a sandbox key.
   */
  get apiUrl(): string {
    return env("LUDOYA_API_URL", "https://api.ludoya.com").replace(/\/+$/, "");
  },
  /** Public web app base URL, used to build links to events. */
  get appUrl(): string {
    return env("LUDOYA_APP_URL", "https://app.ludoya.com").replace(/\/+$/, "");
  },
  /** Server-side credential. Never log it and never send it from a browser. */
  get apiKey(): string | null {
    return process.env.LUDOYA_API_KEY?.trim() || null;
  },
  /** Serve fixtures from public/mock/ludoya/v1 instead of calling the API. */
  get mock(): boolean {
    return process.env.LUDOYA_MOCK === "1";
  },
  requestTimeoutMs: 10_000,
  retryAttempts: 3,
  retryBaseDelayMs: 1_000,
  /** Longest `Retry-After` the client waits for; a longer one is surfaced as `rate_limited`. */
  maxRetryAfterSeconds: 5,
  /** Cache lifetime for the public /events pages (matches their page-level revalidate). */
  eventsRevalidateSeconds: 86_400,
  /** Cache lifetime for member-area data (upcoming sessions, month calendar). */
  memberAreaRevalidateSeconds: 60,
  /** Locations change rarely and only feed the "usual venue" flag. */
  locationsRevalidateSeconds: 3_600,
} as const;

/**
 * Time limits for calls made while a person waits (member area, sign-up
 * checks), tighter than the defaults the cached public pages can afford.
 */
export const MEMBER_AREA_LIMITS = { timeoutMs: 4_000, attempts: 2, budgetMs: 8_000 } as const;
export const USERNAME_CHECK_LIMITS = { timeoutMs: 3_000, attempts: 2, budgetMs: 5_000 } as const;

/** API version prefix, shared by every endpoint. */
export const LUDOYA_API_PREFIX = "/public/v1";

/** API paths, relative to `${apiUrl}${LUDOYA_API_PREFIX}`. */
export const ludoyaEndpoints = {
  /**
   * Future events. With sub-events the planned plays of every meetup come in
   * the same list (`parentId`), so no per-event request is needed.
   */
  events: ({ includeSubEvents = true, pastLimit }: { includeSubEvents?: boolean; pastLimit?: number } = {}) => {
    const params = new URLSearchParams({ includeSubEvents: String(includeSubEvents) });
    if (pastLimit !== undefined) params.set("pastLimit", String(pastLimit));
    return `/events?${params}`;
  },
  locations: () => "/locations",
  /** `intent=PLAY` narrows to people who can be put on an event. */
  searchUsers: (query: string, { size = 5 }: { size?: number } = {}) => {
    const params = new URLSearchParams({ query, intent: "PLAY", pagination: `${size},0` });
    return `/search/users?${params}`;
  },
} as const;

/** Public URLs derived from Ludoya identifiers. */
export const ludoyaUrls = {
  eventPage: (eventId: string) => `${ludoyaConfig.appUrl}/events/${eventId}`,
} as const;

/** Regular session schedules (Europe/Madrid local time). */
export const REGULAR_SCHEDULES = [
  { day: 5, startHour: 16, startMinute: 0, endHour: 20, endMinute: 30 }, // Friday
  { day: 6, startHour: 10, startMinute: 0, endHour: 13, endMinute: 30 }, // Saturday
] as const;
