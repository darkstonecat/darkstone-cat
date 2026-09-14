// ---------------------------------------------------------------------------
// Ludoya integration — configuration
// ---------------------------------------------------------------------------
// Everything Ludoya may change on their side lives here: hosts, group
// identity and endpoint paths. Hosts and group identity can be overridden
// through environment variables so a change can be absorbed from the Vercel
// dashboard without a code change. See docs/ludoya-api-reference.md.

function env(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
}

export const ludoyaConfig = {
  /** REST API base URL (no trailing slash). */
  apiUrl: env("LUDOYA_API_URL", "https://api.ludoya.com"),
  /** Public web app base URL, used to build links to events. */
  appUrl: env("LUDOYA_APP_URL", "https://app.ludoya.com"),
  /** Object storage that serves game and event images. */
  imageBaseUrl: env(
    "LUDOYA_IMAGE_BASE_URL",
    "https://ludoya-images.s3.eu-west-par.io.cloud.ovh.net"
  ),
  /** Darkstone Catalunya group id. Rediscovered by username if it stops resolving. */
  groupId: env("LUDOYA_GROUP_ID", "b28a80d31be24cffa35d9176c3f1ac50"),
  /** Group username, the stable handle used to recognise the group in search results. */
  groupUsername: env("LUDOYA_GROUP_USERNAME", "darkstonecat"),
  /** Search text for the public group search (matches the group name, not the username). */
  groupSearchQuery: env("LUDOYA_GROUP_SEARCH_QUERY", "darkstone"),
  /** Serve fixtures from public/mock/ludoya instead of calling the API. */
  mock: process.env.LUDOYA_MOCK === "1",
  requestTimeoutMs: 15_000,
  retryAttempts: 3,
  retryBaseDelayMs: 1_000,
  /** Next.js data-cache lifetime for Ludoya requests (matches the page ISR). */
  revalidateSeconds: 86_400,
  /** Game → BGG id links never change; cache them for 30 days. */
  gameRevalidateSeconds: 2_592_000,
  /** Parallel requests when looking up game details. */
  gameLookupConcurrency: 6,
} as const;

/** API paths, relative to `ludoyaConfig.apiUrl`. */
export const ludoyaEndpoints = {
  /** Future + past events organised by a group. Groups share the users namespace. */
  groupEvents: (groupId: string) =>
    `/users/${groupId}/events?displayAllRecurring=true`,
  /** Child events of an event: planned plays and, for multi-day events, days. */
  eventChildren: (eventId: string) => `/events/${eventId}/children`,
  /** Game detail by slug; carries the BoardGameGeek URL. */
  boardgame: (slug: string) => `/boardgames/${encodeURIComponent(slug)}`,
  /** Public group search; used to rediscover the group id by username. */
  groupSearch: (name: string) =>
    `/groups/search?nameFilter=${encodeURIComponent(name)}`,
} as const;

/** Public URLs derived from Ludoya identifiers. */
export const ludoyaUrls = {
  eventPage: (eventId: string) => `${ludoyaConfig.appUrl}/events/${eventId}`,
  gameImage: (imageId: string) => `${ludoyaConfig.imageBaseUrl}/${imageId}.jpg`,
} as const;

/** Regular session schedules (Europe/Madrid local time). */
export const REGULAR_SCHEDULES = [
  { day: 5, startHour: 16, startMinute: 0, endHour: 20, endMinute: 30 }, // Friday
  { day: 6, startHour: 10, startMinute: 0, endHour: 13, endMinute: 30 }, // Saturday
] as const;
