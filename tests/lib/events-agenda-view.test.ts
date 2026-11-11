import { describe, expect, it } from "vitest";
import {
  AGENDA_WEEKS,
  MAX_BANNERS,
  countdown,
  summarizeEvent,
  weekSummary,
  madridWeekStart,
  programItems,
  toAgenda,
} from "@/lib/events/agenda-view";
import type { ProgramItem, ProgramLayout } from "@/lib/events/program";
import type { MemberSession, MemberSessionPlay } from "@/lib/member-sessions";
import type { CoveredSubEvent } from "@/lib/sub-event-covers";

const USUAL = { id: "loc-1", name: "Centre Cívic Ca N'Aurell", address: "Plaça del Tint, 4", isUsual: true };
const OTHER = { id: "loc-2", name: "Ateneu", address: "Carrer Major, 1", isUsual: false };

const play = (over: Partial<MemberSessionPlay> = {}): MemberSessionPlay => ({
  id: "p1",
  gameName: "Emberleaf",
  imageUrl: "https://ludoya.example/emberleaf.jpg",
  coverUrl: "https://bgg.example/emberleaf.jpg",
  yearPublished: 2024,
  slug: "emberleaf",
  startsAt: "2026-11-13T17:00:00Z",
  endsAt: "2026-11-13T19:00:00Z",
  place: USUAL,
  participantCount: 3,
  capacity: 4,
  minParticipants: 2,
  organizerName: "Secret Organizer",
  ludoyaUrl: "https://ludoya.example/p1",
  visibility: "PUBLIC",
  ...over,
});

const session = (over: Partial<MemberSession> = {}): MemberSession => ({
  id: "s1",
  title: "Divendres de jocs!",
  description: "Vine a jugar",
  startsAt: "2026-11-13T17:00:00Z",
  endsAt: "2026-11-13T21:30:00Z",
  timeZone: "Europe/Madrid",
  imageUrl: null,
  thumbnailUrl: null,
  plannedPlayCount: 1,
  ludoyaUrl: "https://ludoya.example/s1",
  type: "regular",
  visibility: "PUBLIC",
  place: USUAL,
  participantCount: 3,
  capacity: null,
  minParticipants: null,
  queuedParticipantCount: null,
  organizerName: "Session Host",
  plannedPlays: [play()],
  subEvents: [node()],
  ...over,
});

const node = (over: Partial<CoveredSubEvent> = {}): CoveredSubEvent => ({
  id: "p1",
  kind: "play",
  title: "Emberleaf",
  startsAt: "2026-11-13T17:00:00Z",
  endsAt: "2026-11-13T19:00:00Z",
  alwaysOpen: false,
  game: { name: "Emberleaf", yearPublished: 2024, imageUrl: null, slug: "emberleaf" },
  imageUrl: null,
  coverUrl: "https://bgg.example/emberleaf.jpg",
  place: OTHER,
  participantCount: 3,
  capacity: 4,
  minParticipants: 2,
  organizerName: "Secret Organizer",
  attendance: "rsvp",
  tournamentFormat: null,
  visibility: "PUBLIC",
  ludoyaUrl: "https://ludoya.example/p1",
  children: [],
  ...over,
});

/** A one-day program holding these items in one grid. */
const programOf = (items: ProgramItem[]): ProgramLayout => ({
  multiDay: false,
  days: [{ day: "2026-11-13", mode: "grid", groups: [{ startsAt: null, items }], counts: { plays: items.length, tournaments: 0, activities: 0, demos: 0 } }],
  alwaysOpen: [],
  counts: { plays: items.length, tournaments: 0, activities: 0, demos: 0 },
});

// Wednesday 11 November 2026, 12:00 in Madrid.
const NOW = new Date("2026-11-11T11:00:00Z");

describe("madridWeekStart", () => {
  it("returns the Monday of the Madrid week", () => {
    expect(madridWeekStart("2026-11-11")).toBe("2026-11-09");
    expect(madridWeekStart("2026-11-09")).toBe("2026-11-09");
    expect(madridWeekStart("2026-11-15")).toBe("2026-11-09");
    expect(madridWeekStart("2026-11-16")).toBe("2026-11-16");
  });
});

describe("countdown", () => {
  it("counts Madrid calendar days to the start", () => {
    expect(countdown({ startsAt: "2026-11-28T09:00:00Z", endsAt: "2026-11-29T16:00:00Z" }, NOW)).toEqual({ kind: "days", days: 17 });
  });

  it("says tomorrow and today", () => {
    expect(countdown({ startsAt: "2026-11-12T09:00:00Z", endsAt: "2026-11-12T16:00:00Z" }, NOW)).toEqual({ kind: "tomorrow", days: 1 });
    expect(countdown({ startsAt: "2026-11-11T16:00:00Z", endsAt: "2026-11-11T20:00:00Z" }, NOW)).toEqual({ kind: "today", days: 0 });
  });

  it("says running for a multi-day event that started on an earlier day", () => {
    expect(countdown({ startsAt: "2026-11-10T09:00:00Z", endsAt: "2026-11-12T16:00:00Z" }, NOW)).toEqual({ kind: "running", days: 0 });
  });

  it("counts across midnight in Madrid, not UTC", () => {
    // 23:30 UTC on the 11th is already the 12th in Madrid.
    expect(countdown({ startsAt: "2026-11-11T23:30:00Z", endsAt: "2026-11-12T02:00:00Z" }, NOW).kind).toBe("tomorrow");
  });
});

describe("toAgenda", () => {
  it("groups by Madrid week: this week and the next three", () => {
    const sessions = [
      session({ id: "w0", startsAt: "2026-11-13T17:00:00Z", endsAt: "2026-11-13T21:00:00Z" }),
      session({ id: "w1", startsAt: "2026-11-20T17:00:00Z", endsAt: "2026-11-20T21:00:00Z" }),
      session({ id: "w3", startsAt: "2026-12-06T17:00:00Z", endsAt: "2026-12-06T21:00:00Z" }),
      session({ id: "w4", startsAt: "2026-12-07T17:00:00Z", endsAt: "2026-12-07T21:00:00Z" }),
    ];

    const { weeks } = toAgenda(sessions, NOW);

    expect(AGENDA_WEEKS).toBe(4);
    expect(weeks.map((w) => [w.start, w.end, w.isCurrent, w.events.map((e) => e.id)])).toEqual([
      ["2026-11-09", "2026-11-15", true, ["w0"]],
      ["2026-11-16", "2026-11-22", false, ["w1"]],
      ["2026-11-30", "2026-12-06", false, ["w3"]],
    ]);
  });

  it("keeps every special event of the next 12 months, even past the 4 weeks", () => {
    const sessions = [
      session({ id: "far-special", type: "special", startsAt: "2027-03-20T09:00:00Z", endsAt: "2027-03-20T18:00:00Z" }),
      session({ id: "too-far", type: "special", startsAt: "2027-12-20T09:00:00Z", endsAt: "2027-12-20T18:00:00Z" }),
      session({ id: "far-regular", startsAt: "2027-03-19T17:00:00Z", endsAt: "2027-03-19T21:00:00Z" }),
    ];

    const { weeks, specials } = toAgenda(sessions, NOW);

    expect(weeks.map((w) => [w.start, w.events.map((e) => e.id)])).toEqual([["2027-03-15", ["far-special"]]]);
    expect(specials.map((s) => s.id)).toEqual(["far-special"]);
  });

  it("drops events that already ended and keeps a running multi-day special in this week", () => {
    const sessions = [
      session({ id: "ended", startsAt: "2026-11-10T17:00:00Z", endsAt: "2026-11-10T21:00:00Z" }),
      session({ id: "running", type: "special", startsAt: "2026-11-01T09:00:00Z", endsAt: "2026-11-12T18:00:00Z" }),
    ];

    const { weeks } = toAgenda(sessions, NOW);

    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ start: "2026-11-09", isCurrent: true });
    expect(weeks[0].events.map((e) => [e.id, e.countdown])).toEqual([["running", { kind: "running", days: 0 }]]);
  });

  it("shows only PUBLIC sessions and plays", () => {
    const sessions = [
      session({ id: "group", visibility: "ONLY_GROUP" }),
      session({
        id: "public",
        subEvents: [
          node({ id: "open" }),
          node({ id: "hidden", visibility: "ONLY_GROUP" }),
          node({ id: "zone", kind: "meetup", visibility: "ONLY_GROUP", children: [node({ id: "inside" })] }),
        ],
      }),
    ];

    const { weeks } = toAgenda(sessions, NOW);
    const events = weeks.flatMap((w) => w.events);

    expect(events.map((e) => e.id)).toEqual(["public"]);
    expect(programItems(events[0].program).map((p) => p.id)).toEqual(["open"]);
  });

  it("never carries organizer names, visibility or raw place of the usual venue", () => {
    const agenda = toAgenda([session({ type: "special" })], NOW);
    const json = JSON.stringify(agenda);

    expect(json).not.toContain("Secret Organizer");
    expect(json).not.toContain("Session Host");
    expect(json).not.toContain("organizerName");
    expect(json).not.toContain("visibility");
    expect(json).not.toContain(USUAL.name);
  });

  it("names the place only when it is not the usual venue", () => {
    const sessions = [
      session({ id: "home" }),
      session({ id: "away", startsAt: "2026-11-14T09:00:00Z", endsAt: "2026-11-14T12:00:00Z", place: OTHER, plannedPlays: [play({ place: OTHER })] }),
      session({ id: "unknown", startsAt: "2026-11-15T09:00:00Z", endsAt: "2026-11-15T12:00:00Z", place: null, plannedPlays: [] }),
    ];

    const events = toAgenda(sessions, NOW).weeks[0].events;

    expect(events.map((e) => [e.id, e.place])).toEqual([
      ["home", null],
      ["away", { name: "Ateneu", address: "Carrer Major, 1" }],
      ["unknown", null],
    ]);
    // Program items carry no place at all.
    expect(programItems(events[1].program)[0]).not.toHaveProperty("place");
  });

  it("gives a countdown to specials only", () => {
    const sessions = [
      session({ id: "regular" }),
      session({ id: "special", type: "special", startsAt: "2026-11-14T09:00:00Z", endsAt: "2026-11-15T18:00:00Z" }),
    ];

    const events = toAgenda(sessions, NOW).weeks[0].events;

    expect(events.map((e) => [e.id, e.countdown])).toEqual([
      ["regular", null],
      ["special", { kind: "days", days: 3 }],
    ]);
  });

  it("builds the program from the sub-event tree with seats and the resolved cover", () => {
    const sessions = [session({ subEvents: [node(), node({ id: "p2", coverUrl: null, startsAt: "2026-11-13T18:00:00Z" })] })];

    const { program } = toAgenda(sessions, NOW).weeks[0].events[0];
    const [first, second] = programItems(program);

    expect(first).toEqual({
      kind: "play",
      id: "p1",
      title: "Emberleaf",
      gameName: "Emberleaf",
      zone: null,
      coverUrl: "https://bgg.example/emberleaf.jpg",
      startsAt: "2026-11-13T17:00:00Z",
      endsAt: "2026-11-13T19:00:00Z",
      placement: "timed",
      participantCount: 3,
      capacity: 4,
      minParticipants: 2,
      ludoyaUrl: "https://ludoya.example/p1",
    });
    // No cover anywhere: the card draws the placeholder.
    expect(second.coverUrl).toBeNull();
    expect(program.days).toHaveLength(1);
  });

  it("lists at most three upcoming specials for the banners, soonest first", () => {
    const specials = ["2026-12-05", "2026-11-20", "2027-01-10", "2027-02-14"].map((day, i) =>
      session({ id: `sp${i}`, type: "special", startsAt: `${day}T09:00:00Z`, endsAt: `${day}T18:00:00Z` })
    );

    const agenda = toAgenda(specials, NOW);

    expect(MAX_BANNERS).toBe(3);
    expect(agenda.specials.map((s) => s.id)).toEqual(["sp1", "sp0", "sp2"]);
  });

  it("keeps the event's own sign-ups and capacity", () => {
    const [event] = toAgenda([session({ participantCount: 21, capacity: null })], NOW).weeks[0].events;

    expect(event).toMatchObject({ participantCount: 21, capacity: null });
  });

  it("orders events inside a week by start", () => {
    const sessions = [
      session({ id: "sat", startsAt: "2026-11-14T09:00:00Z", endsAt: "2026-11-14T12:00:00Z" }),
      session({ id: "fri", startsAt: "2026-11-13T17:00:00Z", endsAt: "2026-11-13T21:00:00Z" }),
    ];

    expect(toAgenda(sessions, NOW).weeks[0].events.map((e) => e.id)).toEqual(["fri", "sat"]);
  });
});

describe("summarizeEvent", () => {
  const p = (taken: number, capacity: number | null, kind: "play" | "tournament" = "play"): ProgramItem =>
    ({ kind, id: `${taken}-${capacity}`, title: "x", gameName: null, zone: null, coverUrl: null, startsAt: null, endsAt: null, ludoyaUrl: "", placement: "timed", participantCount: taken, capacity, minParticipants: null, format: null, tickets: false }) as ProgramItem;
  const activity = { kind: "activity", id: "a", title: "Talk", zone: null, coverUrl: null, startsAt: null, endsAt: null, ludoyaUrl: "", placement: "timed" } as ProgramItem;

  it("says there are no plays yet", () => {
    expect(summarizeEvent({ program: programOf([]) })).toEqual({ playCount: 0, availability: { kind: "none" } });
  });

  it("adds up the free seats of every play and tournament, ignoring activities", () => {
    expect(summarizeEvent({ program: programOf([p(3, 4), p(2, 4, "tournament"), p(5, 5), activity]) })).toEqual({
      playCount: 3,
      availability: { kind: "seats", free: 3 },
    });
  });

  it("says unlimited when the only room left is a play without limit", () => {
    expect(summarizeEvent({ program: programOf([p(5, 5), p(9, null)]) }).availability).toEqual({ kind: "unlimited" });
  });

  it("says all full when every play is full", () => {
    expect(summarizeEvent({ program: programOf([p(5, 5), p(6, 4)]) }).availability).toEqual({ kind: "all_full" });
  });
});

describe("weekSummary", () => {
  it("counts sessions, plays, specials and free seats of a week", () => {
    const seat = (taken: number, capacity: number | null) =>
      ({ kind: "play", id: `${taken}`, title: "x", gameName: null, zone: null, coverUrl: null, startsAt: null, endsAt: null, ludoyaUrl: "", placement: "timed", participantCount: taken, capacity, minParticipants: null }) as ProgramItem;
    const events = [
      { type: "regular" as const, program: programOf([seat(3, 4), seat(1, 4)]) },
      { type: "regular" as const, program: programOf([]) },
      { type: "special" as const, program: programOf([seat(2, null)]) },
    ];

    expect(weekSummary(events)).toEqual({ sessions: 2, specials: 1, plays: 3, free: 4 });
  });
});
