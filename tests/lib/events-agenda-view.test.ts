import { describe, expect, it } from "vitest";
import {
  AGENDA_WEEKS,
  MAX_BANNERS,
  countdown,
  summarizeEvent,
  weekSummary,
  madridWeekStart,
  toAgenda,
} from "@/lib/events/agenda-view";
import type { MemberSession, MemberSessionPlay } from "@/lib/member-sessions";

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
  ...over,
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
        plannedPlays: [play({ id: "open" }), play({ id: "hidden", visibility: "ONLY_GROUP" })],
      }),
    ];

    const { weeks } = toAgenda(sessions, NOW);
    const events = weeks.flatMap((w) => w.events);

    expect(events.map((e) => e.id)).toEqual(["public"]);
    expect(events[0].plays.map((p) => p.id)).toEqual(["open"]);
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
    expect(events[0].plays[0].place).toBeNull();
    expect(events[1].plays[0].place).toEqual({ name: "Ateneu", address: "Carrer Major, 1" });
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

  it("keeps play seats and the cover, and falls back to Ludoya's image", () => {
    const sessions = [session({ plannedPlays: [play(), play({ id: "p2", coverUrl: null })] })];

    const [first, second] = toAgenda(sessions, NOW).weeks[0].events[0].plays;

    expect(first).toEqual({
      id: "p1",
      gameName: "Emberleaf",
      coverUrl: "https://bgg.example/emberleaf.jpg",
      startsAt: "2026-11-13T17:00:00Z",
      endsAt: "2026-11-13T19:00:00Z",
      place: null,
      participantCount: 3,
      capacity: 4,
      minParticipants: 2,
      ludoyaUrl: "https://ludoya.example/p1",
    });
    expect(second.coverUrl).toBe("https://ludoya.example/emberleaf.jpg");
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
  const p = (taken: number, capacity: number | null) => ({ participantCount: taken, capacity });

  it("says there are no plays yet", () => {
    expect(summarizeEvent({ plays: [] })).toEqual({ playCount: 0, availability: { kind: "none" } });
  });

  it("adds up the free seats of every play", () => {
    expect(summarizeEvent({ plays: [p(3, 4), p(2, 4), p(5, 5)] })).toEqual({ playCount: 3, availability: { kind: "seats", free: 3 } });
  });

  it("says unlimited when the only room left is a play without limit", () => {
    expect(summarizeEvent({ plays: [p(5, 5), p(9, null)] }).availability).toEqual({ kind: "unlimited" });
  });

  it("says all full when every play is full", () => {
    expect(summarizeEvent({ plays: [p(5, 5), p(6, 4)] }).availability).toEqual({ kind: "all_full" });
  });
});

describe("weekSummary", () => {
  it("counts sessions, plays, specials and free seats of a week", () => {
    const events = [
      { type: "regular" as const, plays: [{ participantCount: 3, capacity: 4 }, { participantCount: 1, capacity: 4 }] },
      { type: "regular" as const, plays: [] },
      { type: "special" as const, plays: [{ participantCount: 2, capacity: null }] },
    ];

    expect(weekSummary(events)).toEqual({ sessions: 2, specials: 1, plays: 3, free: 4 });
  });
});
