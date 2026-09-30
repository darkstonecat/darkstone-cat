import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LudoyaShapeError,
  parseChildrenResponse,
  parseLocationsResponse,
  parseSessionsResponse,
  parseUserSearchResponse,
  withUsualVenue,
} from "@/lib/ludoya/normalize";

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/mock/ludoya/v1", name), "utf-8"));

const FRIDAY_ID = "da653bb7f37f4af1911a962a61630b6d";
const SATURDAY_ID = "a851a75f8cae4530adc8f33750f1e2ed";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("parseSessionsResponse", () => {
  const sessions = parseSessionsResponse(fixture("events.json"));
  const byId = (id: string) => sessions.find((s) => s.id === id)!;

  it("keeps sessions, skips drafts and plays without a parent session", () => {
    expect(sessions).toHaveLength(6);
    expect(sessions.map((s) => s.title)).not.toContain("el principio del fuego y la ceniza");
    // Two draft "Juguem a El Cartón Peleón!" / "Dissabtes de jocs!" entries are in the fixture.
    expect(sessions.filter((s) => s.title === "Dissabtes de jocs!")).toHaveLength(1);
    expect(sessions.filter((s) => s.title.startsWith("Juguem"))).toHaveLength(1);
  });

  it("classifies regular sessions by Madrid-local schedule and the rest as special", () => {
    expect(sessions.filter((s) => s.type === "regular")).toHaveLength(4);
    expect(sessions.filter((s) => s.type === "special").map((s) => s.title).sort()).toEqual([
      "Egara Juga 2026",
      "Juguem a El Cartón Peleón!",
    ]);
  });

  it("attaches plays to their session, sorted by start, with seat data and place", () => {
    const friday = byId(FRIDAY_ID);
    expect(friday.plannedPlayCount).toBe(4);
    expect(friday.plannedPlays.map((p) => p.gameName)).toEqual([
      "Emberleaf",
      "Signorie",
      "Forest Shuffle: Smoky Mountains",
      "Fábricas Fantásticas",
    ]);
    const starts = friday.plannedPlays.map((p) => new Date(p.startsAt).getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));

    const emberleaf = friday.plannedPlays.find((p) => p.gameName === "Emberleaf")!;
    expect(emberleaf).toMatchObject({
      participantCount: 3,
      capacity: 4,
      minParticipants: 1,
      yearPublished: 0,
      slug: "emberleaf",
    });
    expect(emberleaf.imageUrl).toMatch(/^https:\/\//);
    expect(emberleaf.ludoyaUrl).toBe(`https://app.ludoya.com/events/${emberleaf.id}`);
    expect(emberleaf.place?.name).toBe("Centre Cívic Ca N’Aurell");
    expect(friday.plannedPlays.find((p) => p.gameName === "Signorie")?.yearPublished).toBe(2015);
  });

  it("maps counts, place, links and the absent waiting list", () => {
    const friday = byId(FRIDAY_ID);
    expect(friday).toMatchObject({
      participantCount: 10,
      capacity: null,
      minParticipants: null,
      queuedParticipantCount: null,
      organizerName: null,
      timeZone: "Europe/Madrid",
      ludoyaUrl: `https://app.ludoya.com/events/${FRIDAY_ID}`,
    });
    expect(friday.place).toEqual({
      id: "cb3ba5f9ea124546b83011d2d23df546",
      name: "Centre Cívic Ca N’Aurell",
      address: "Plaça del Tint, 4, Terrassa, Espanya",
      isUsual: false,
    });
    expect(byId(SATURDAY_ID).plannedPlays).toHaveLength(2);
  });

  it("reads the organizer from master or teacher and a queued count when present", () => {
    const raw = {
      futureEvents: {
        elements: [
          {
            id: "s1",
            type: "MEETUP",
            title: "Special day",
            startsAt: "2026-11-01T10:00:00Z",
            endsAt: "2026-11-01T12:00:00Z",
            timeZone: "Europe/Madrid",
            master: { name: "Organizer A" },
            queuedParticipantCount: 4,
          },
        ],
      },
    };
    expect(parseSessionsResponse(raw)[0]).toMatchObject({
      organizerName: "Organizer A",
      queuedParticipantCount: 4,
      place: null,
    });
  });

  it("drops special events further than 12 months away and cancelled ones", () => {
    const raw = {
      futureEvents: {
        elements: [
          { id: "far", type: "MEETUP", title: "Far", startsAt: "2028-11-01T10:00:00Z", endsAt: "2028-11-01T12:00:00Z" },
          { id: "off", type: "MEETUP", title: "Off", canceled: true, startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T12:00:00Z" },
        ],
      },
    };
    expect(parseSessionsResponse(raw)).toEqual([]);
  });

  it("names the exact field path when the shape changes", () => {
    const missingDate = {
      futureEvents: { elements: [{ id: "x", type: "MEETUP", title: "T", endsAt: "2026-11-01T12:00:00Z" }] },
    };
    expect(() => parseSessionsResponse(missingDate)).toThrow(LudoyaShapeError);
    expect(() => parseSessionsResponse(missingDate)).toThrow(/events\.futureEvents\.elements\[0\]\.startsAt/);
    expect(() => parseSessionsResponse({ futureEvents: {} })).toThrow(/futureEvents\.elements/);
    expect(() => parseSessionsResponse({ futureEvents: { elements: ["nope"] } })).toThrow(/elements\[0\]/);
  });
});

describe("withUsualVenue", () => {
  it("flags the default location and leaves names as received", () => {
    const sessions = withUsualVenue(
      parseSessionsResponse(fixture("events.json")),
      parseLocationsResponse(fixture("locations.json"))
    );
    const usual = sessions.find((s) => s.id === FRIDAY_ID)!;
    expect(usual.place).toMatchObject({ name: "Centre Cívic Ca N’Aurell", isUsual: true });
    expect(usual.plannedPlays.every((p) => p.place?.isUsual)).toBe(true);

    const elsewhere = sessions.find((s) => s.title.startsWith("Juguem"))!;
    expect(elsewhere.place).toMatchObject({ name: "El Cartón Peleón", isUsual: false });
  });

  it("returns sessions untouched when no default location exists", () => {
    const sessions = parseSessionsResponse(fixture("events.json"));
    expect(withUsualVenue(sessions, [{ id: "a", name: "A", address: null, isDefault: false }])).toBe(sessions);
  });
});

describe("parseChildrenResponse", () => {
  it("returns sorted plays and ignores children without a game", () => {
    const plays = parseChildrenResponse(fixture(`children-${SATURDAY_ID}.json`), SATURDAY_ID);
    expect(plays.map((p) => p.gameName)).toContain("Ostia");
    const raw = { children: [{ id: "day1", type: "MEETUP", title: "Day 1", startsAt: "2026-11-01T10:00:00Z" }] };
    expect(parseChildrenResponse(raw, "e")).toEqual([]);
    expect(parseChildrenResponse({ children: [] }, "e")).toEqual([]);
  });

  it("reports the event id in shape errors", () => {
    expect(() => parseChildrenResponse({}, "abc")).toThrow(/children\(abc\)\.children/);
  });
});

describe("parseLocationsResponse", () => {
  it("normalises locations and exposes exactly one default", () => {
    const locations = parseLocationsResponse(fixture("locations.json"));
    expect(locations.length).toBeGreaterThan(1);
    expect(locations.filter((l) => l.isDefault)).toHaveLength(1);
    expect(locations[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      address: expect.any(String),
      isDefault: true,
    });
  });
});

describe("parseUserSearchResponse", () => {
  it("returns matches and an empty list for no match", () => {
    expect(parseUserSearchResponse(fixture("search-users-found.json"))).toEqual([
      { id: expect.any(String), username: "member-a", name: "Member A" },
    ]);
    expect(parseUserSearchResponse(fixture("search-users-empty.json"))).toEqual([]);
  });

  it("fails with the field path on an unexpected shape", () => {
    expect(() => parseUserSearchResponse({ users: [] })).toThrow(/users\.elements/);
  });
});

describe("parseSessionsResponse visibility", () => {
  const event = (id: string, visibility?: string) => ({
    id,
    type: "MEETUP",
    title: id,
    startsAt: "2026-11-01T10:00:00Z",
    endsAt: "2026-11-01T12:00:00Z",
    ...(visibility ? { visibility } : {}),
  });

  it("keeps public and group-only events and drops friends-only and private ones", () => {
    const sessions = parseSessionsResponse({
      futureEvents: {
        elements: [event("a", "PUBLIC"), event("b", "ONLY_GROUP"), event("c", "ONLY_FRIENDS"), event("d", "PRIVATE"), event("e")],
      },
    });
    expect(sessions.map((s) => [s.id, s.visibility])).toEqual([
      ["a", "PUBLIC"],
      ["b", "ONLY_GROUP"],
      ["e", "PUBLIC"],
    ]);
  });

  it("includes past events only when asked", () => {
    const raw = {
      futureEvents: { elements: [event("future")] },
      pastEvents: { elements: [{ ...event("past"), startsAt: "2026-05-01T10:00:00Z", endsAt: "2026-05-01T12:00:00Z" }] },
    };
    expect(parseSessionsResponse(raw).map((s) => s.id)).toEqual(["future"]);
    expect(parseSessionsResponse(raw, { includePast: true }).map((s) => s.id)).toEqual(["future", "past"]);
    expect(() => parseSessionsResponse({ futureEvents: { elements: [] } }, { includePast: true })).toThrow(/pastEvents\.elements/);
  });
});
