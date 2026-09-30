// ---------------------------------------------------------------------------
// Ludoya integration — public API response normalisation
// ---------------------------------------------------------------------------
// This is the only file that knows the raw shapes of the public v1 API. Every
// field we depend on goes through a guard from ./shape, so a change on
// Ludoya's side fails with the exact field path instead of yielding undefined.

import { ludoyaUrls, REGULAR_SCHEDULES } from "./config";
import {
  getPath,
  isObject,
  LudoyaShapeError,
  optionalBoolean,
  optionalNumber,
  optionalString,
  requireArray,
  requireIsoDate,
  requireString,
} from "./shape";
import type {
  LudoyaLocation,
  LudoyaPlace,
  LudoyaSession,
  LudoyaSessionPlay,
  LudoyaUser,
} from "./types";

export { LudoyaShapeError };

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

/** Event kinds that are sessions of their own; plays hang off them as children. */
const SESSION_TYPES = new Set(["MEETUP", "TOURNAMENT", "PLAY_BOOTH", "ROTATIVE_PLAYTEST"]);

function isRegularSession(startsAt: string, endsAt: string, timeZone: string): boolean {
  const part = (date: string, opts: Intl.DateTimeFormatOptions) =>
    parseInt(new Intl.DateTimeFormat("en-US", { timeZone, ...opts }).format(new Date(date)));

  const dayOfWeek = new Date(new Date(startsAt).toLocaleString("en-US", { timeZone })).getDay();
  const startHour = part(startsAt, { hour: "numeric", hour12: false });
  const startMinute = part(startsAt, { minute: "numeric" });
  const endHour = part(endsAt, { hour: "numeric", hour12: false });
  const endMinute = part(endsAt, { minute: "numeric" });

  return REGULAR_SCHEDULES.some(
    (s) =>
      s.day === dayOfWeek &&
      s.startHour === startHour &&
      s.startMinute === startMinute &&
      s.endHour === endHour &&
      s.endMinute === endMinute
  );
}

function isWithin12Months(dateStr: string, now: Date): boolean {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() + 12);
  return new Date(dateStr) <= limit;
}

/**
 * Events the site may show. `ONLY_FRIENDS` and `PRIVATE` are known and skipped
 * silently; a missing or unrecognised value is skipped too, with a warning,
 * because guessing "public" could leak a private event.
 */
type Visibility = "PUBLIC" | "ONLY_GROUP";

function readVisibility(item: unknown, ctx: string): Visibility | null {
  const value = optionalString(item, "visibility", ctx);
  if (value === "PUBLIC" || value === "ONLY_GROUP") return value;
  if (value !== "ONLY_FRIENDS" && value !== "PRIVATE") {
    console.warn(`[Ludoya] Skipping ${ctx}: visibility is ${value === null ? "missing" : `unknown (${value})`}`);
  }
  return null;
}

/**
 * Start and end are nullable in the API. `null` means "this item has no usable
 * date" (skip it); a missing key or a wrong type is a real shape change and
 * still throws.
 */
function readDates(item: unknown, ctx: string): { startsAt: string; endsAt: string } | null {
  if (getPath(item, "startsAt") === null || getPath(item, "endsAt") === null) {
    console.warn(`[Ludoya] Skipping ${ctx}: no start or end date`);
    return null;
  }
  return { startsAt: requireIsoDate(item, "startsAt", ctx), endsAt: requireIsoDate(item, "endsAt", ctx) };
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function parsePlace(item: unknown, ctx: string): LudoyaPlace | null {
  const location = getPath(item, "location");
  if (location === undefined || location === null) return null;
  const at = `${ctx}.location`;
  return {
    id: requireString(location, "id", at),
    name: requireString(location, "name", at),
    address: optionalString(location, "address", at),
    // The location embedded in an event never carries the default flag;
    // `withUsualVenue` sets it from GET /locations.
    isUsual: false,
  };
}

/** Name of the person running the event, when the API names one. */
function parseOrganizerName(item: unknown, ctx: string): string | null {
  return (
    optionalString(item, "master.name", ctx) ?? optionalString(item, "teacher.name", ctx)
  );
}

function parsePlay(item: unknown, ctx: string): LudoyaSessionPlay | null {
  const game = getPath(item, "game");
  if (!isObject(game)) return null;
  if (optionalBoolean(item, "canceled", ctx) || optionalBoolean(item, "draft", ctx)) return null;

  const gameName = optionalString(game, "name", `${ctx}.game`) ?? optionalString(item, "title", ctx);
  if (!gameName) return null;
  // A play carries its own visibility; a private play must not ride in under a public session.
  const visibility = readVisibility(item, ctx);
  if (!visibility) return null;
  if (getPath(item, "startsAt") === null) {
    console.warn(`[Ludoya] Skipping ${ctx}: no start date`);
    return null;
  }
  const id = requireString(item, "id", ctx);

  return {
    id,
    gameName,
    yearPublished: optionalNumber(game, "yearPublished", `${ctx}.game`) ?? 0,
    imageUrl: optionalString(game, "imageUrl", `${ctx}.game`),
    slug: optionalString(game, "slug", `${ctx}.game`),
    startsAt: requireIsoDate(item, "startsAt", ctx),
    endsAt: optionalString(item, "endsAt", ctx),
    place: parsePlace(item, ctx),
    participantCount: optionalNumber(item, "participantCount", ctx) ?? 0,
    capacity: optionalNumber(item, "capacity", ctx),
    minParticipants: optionalNumber(item, "minParticipants", ctx),
    ludoyaUrl: ludoyaUrls.eventPage(id),
    visibility,
  };
}

// The API returns plays in no stable order; sort by start time.
const byStart = (a: { startsAt: string }, b: { startsAt: string }) =>
  new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * `GET /events?includeSubEvents=true` → upcoming sessions with their planned
 * plays, classified as regular or special. With `includePast`, the events
 * requested through `pastLimit` are included too.
 *
 * Drafts, cancelled events and friends-only or private ones are skipped, as
 * are items with a null start or end date (a warning is logged); special
 * events further than 12 months away are dropped. Plays are the `PLANNED_PLAY` children that carry a
 * game; a play with no parent session (a standalone table) has no session to
 * show under and is ignored.
 */
export function parseSessionsResponse(
  raw: unknown,
  { includePast = false, now = new Date() }: { includePast?: boolean; now?: Date } = {}
): LudoyaSession[] {
  const future = requireArray(raw, "futureEvents.elements", "events");
  const past = includePast ? requireArray(raw, "pastEvents.elements", "events") : [];
  const elements = [
    ...future.map((item, i) => ({ item, ctx: `events.futureEvents.elements[${i}]` })),
    ...past.map((item, i) => ({ item, ctx: `events.pastEvents.elements[${i}]` })),
  ];
  const sessions: LudoyaSession[] = [];
  const playsByParent = new Map<string, LudoyaSessionPlay[]>();

  elements.forEach(({ item, ctx }) => {
    if (!isObject(item)) throw new LudoyaShapeError(ctx, "object", item);
    if (optionalBoolean(item, "canceled", ctx) || optionalBoolean(item, "draft", ctx)) return;

    const type = requireString(item, "type", ctx);
    const parentId = optionalString(item, "parentId", ctx);

    if (parentId) {
      const play = type === "PLANNED_PLAY" ? parsePlay(item, ctx) : null;
      if (!play) return;
      playsByParent.set(parentId, [...(playsByParent.get(parentId) ?? []), play]);
      return;
    }
    if (!SESSION_TYPES.has(type)) return;
    // Friends-only and private events are not the club's programme.
    const visibility = readVisibility(item, ctx);
    if (!visibility) return;

    const id = requireString(item, "id", ctx);
    const dates = readDates(item, ctx);
    if (!dates) return;
    const { startsAt, endsAt } = dates;
    const timeZone = optionalString(item, "timeZone", ctx) ?? "Europe/Madrid";
    const regular = isRegularSession(startsAt, endsAt, timeZone);
    if (!regular && !isWithin12Months(startsAt, now)) return;

    const imageUrl = optionalString(item, "imageUrl", ctx);
    sessions.push({
      id,
      title: requireString(item, "title", ctx),
      // Fall back to the title in consumers when there is no description.
      description: optionalString(item, "description", ctx) ?? "",
      startsAt,
      endsAt,
      timeZone,
      // The public API returns the full-size image only.
      imageUrl,
      thumbnailUrl: imageUrl,
      plannedPlayCount: 0,
      ludoyaUrl: ludoyaUrls.eventPage(id),
      type: regular ? "regular" : "special",
      visibility,
      place: parsePlace(item, ctx),
      participantCount: optionalNumber(item, "participantCount", ctx) ?? 0,
      capacity: optionalNumber(item, "capacity", ctx),
      minParticipants: optionalNumber(item, "minParticipants", ctx),
      // Not exposed by the public API today; picked up if Ludoya adds it.
      queuedParticipantCount: optionalNumber(item, "queuedParticipantCount", ctx),
      organizerName: parseOrganizerName(item, ctx),
      plannedPlays: [],
    });
  });

  for (const session of sessions) {
    session.plannedPlays = (playsByParent.get(session.id) ?? []).sort(byStart);
    session.plannedPlayCount = session.plannedPlays.length;
  }
  return sessions;
}

/** `GET /locations` → the organisation's locations. */
export function parseLocationsResponse(raw: unknown): LudoyaLocation[] {
  const list = requireArray(raw, "locations", "locations");
  return list.map((item, index) => {
    const ctx = `locations.locations[${index}]`;
    return {
      id: requireString(item, "id", ctx),
      name: requireString(item, "name", ctx),
      address: optionalString(item, "address", ctx),
      isDefault: optionalBoolean(item, "isDefault", ctx) ?? false,
    };
  });
}

/** `GET /search/users` → matching accounts. No match is an empty list, not an error. */
export function parseUserSearchResponse(raw: unknown): LudoyaUser[] {
  const list = requireArray(raw, "users.elements", "search/users");
  return list.map((item, index) => {
    const ctx = `search/users.users.elements[${index}]`;
    return {
      id: requireString(item, "id", ctx),
      username: requireString(item, "username", ctx),
      name: optionalString(item, "name", ctx) ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

/**
 * Mark the usual venue: the place whose id matches the organisation's default
 * location. The name is left exactly as Ludoya sent it.
 */
export function withUsualVenue(
  sessions: LudoyaSession[],
  locations: LudoyaLocation[]
): LudoyaSession[] {
  const usualId = locations.find((l) => l.isDefault)?.id;
  if (!usualId) return sessions;
  const mark = (place: LudoyaPlace | null): LudoyaPlace | null =>
    place ? { ...place, isUsual: place.id === usualId } : null;
  return sessions.map((session) => ({
    ...session,
    place: mark(session.place),
    plannedPlays: session.plannedPlays.map((play) => ({ ...play, place: mark(play.place) })),
  }));
}
