// ---------------------------------------------------------------------------
// Ludoya integration — response normalisation
// ---------------------------------------------------------------------------
// This is the only file that knows Ludoya's raw response shapes. Every field
// we depend on is read through a guard that fails with a precise message
// ("shape changed at futureEvents.elements[0].startsAt: expected string,
// received undefined") instead of silently producing undefined.

import { ludoyaUrls, REGULAR_SCHEDULES } from "./legacy-config";
import type { LudoyaEvent, LudoyaPlannedPlay } from "./types";
import {
  fail,
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

export { LudoyaShapeError };

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function isRegularEvent(startsAt: string, endsAt: string, timeZone: string): boolean {
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

function isWithin12Months(dateStr: string): boolean {
  const limit = new Date();
  limit.setMonth(limit.getMonth() + 12);
  return new Date(dateStr) <= limit;
}

/**
 * The list only carries a reduced image (`…-preview.jfif`, `…-thumbnail.jpg`,
 * `…_preview.jpg`). The original lives at the same path without that suffix.
 */
const IMAGE_SIZE_SUFFIX = /[-_](?:preview|thumbnail)(\.[a-z0-9]+)$/i;

function eventImageUrls(previewUrl: string | null): Pick<LudoyaEvent, "imageUrl" | "thumbnailUrl"> {
  if (!previewUrl) return { imageUrl: null, thumbnailUrl: null };
  return {
    imageUrl: previewUrl.replace(IMAGE_SIZE_SUFFIX, "$1"),
    thumbnailUrl: previewUrl,
  };
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * `GET /users/{groupId}/events` → upcoming, non-cancelled events, classified
 * as regular sessions or special events. Special events further than 12
 * months away are dropped. `plannedPlays` is left empty for the caller to fill.
 */
export function parseEventsResponse(raw: unknown): LudoyaEvent[] {
  const elements = requireArray(raw, "futureEvents.elements", "events");
  const events: LudoyaEvent[] = [];

  elements.forEach((item, index) => {
    const ctx = `events.futureEvents.elements[${index}]`;
    if (optionalBoolean(item, "canceled", ctx)) return;

    const id = requireString(item, "id", ctx);
    const startsAt = requireIsoDate(item, "startsAt", ctx);
    const endsAt = requireIsoDate(item, "endsAt", ctx);
    const timeZone = optionalString(item, "timeZone", ctx) ?? "Europe/Madrid";
    const regular = isRegularEvent(startsAt, endsAt, timeZone);
    if (!regular && !isWithin12Months(startsAt)) return;

    events.push({
      id,
      title: requireString(item, "title", ctx),
      // The list endpoint carries no description; consumers fall back to the title.
      description: optionalString(item, "description", ctx) ?? "",
      startsAt,
      endsAt,
      timeZone,
      ...eventImageUrls(optionalString(item, "imageUrl", ctx)),
      plannedPlayCount: optionalNumber(item, "childEventCounts.games", ctx) ?? 0,
      ludoyaUrl: ludoyaUrls.eventPage(id),
      type: regular ? "regular" : "special",
      plannedPlays: [],
    });
  });

  return events;
}

/**
 * `GET /events/{eventId}/children` → planned plays. Children carrying a
 * `game` object are planned plays; other children (days of a multi-day
 * event) and cancelled plays are ignored.
 */
export function parseChildrenResponse(raw: unknown, eventId: string): LudoyaPlannedPlay[] {
  const base = `children(${eventId})`;
  const list = requireArray(raw, "list", base);

  const plays = list.flatMap((item, index) => {
    const ctx = `${base}.list[${index}]`;
    const game = getPath(item, "game");
    if (!isObject(game)) return [];
    if (optionalBoolean(item, "canceled", ctx)) return [];

    const gameName = optionalString(game, "name", `${ctx}.game`) ?? optionalString(item, "title", ctx);
    if (!gameName) return [];
    const imageId = optionalString(game, "imageId", `${ctx}.game`);
    const gameType = optionalString(game, "type", `${ctx}.game`);

    return [
      {
        startsAt: optionalString(item, "startsAt", ctx) ?? "",
        play: {
          gameName,
          yearPublished: optionalNumber(game, "yearPublished", `${ctx}.game`) ?? 0,
          imageUrl: imageId ? ludoyaUrls.gameImage(imageId) : null,
          slug: optionalString(game, "slug", `${ctx}.game`),
          isRpg: gameType === "RPG_BOOK",
        } satisfies LudoyaPlannedPlay,
      },
    ];
  });

  // The API returns children in no stable order; sort by start time.
  return plays
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((p) => p.play);
}

const BGG_URL = /^https?:\/\/(?:www\.)?boardgamegeek\.com\/[a-z]+\/(\d+)/i;

/**
 * `GET /boardgames/{slug}` → BoardGameGeek id, or null when the game has no
 * BGG link. A link in an unexpected format is reported as a shape change.
 */
export function parseBoardgameResponse(raw: unknown, slug: string): string | null {
  const ctx = `boardgame(${slug})`;
  if (!isObject(raw)) throw new LudoyaShapeError(ctx, "object", raw);
  const bggUrl = optionalString(raw, "bggUrl", ctx);
  if (!bggUrl) return null;
  const match = bggUrl.match(BGG_URL);
  return match ? match[1] : fail(raw, "bggUrl", "boardgamegeek.com/<type>/<id> URL", ctx);
}
