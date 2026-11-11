import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSessionsResponse } from "@/lib/ludoya/normalize";
import {
  classifyProgram,
  layoutProgram,
  PROGRAM_SLOT_THRESHOLD,
  type ProgramItem,
  type ProgramNode,
} from "@/lib/events/program";

const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/mock/ludoya/v1/events.json"), "utf-8"));
const egara = parseSessionsResponse(raw, { now: new Date("2026-10-01T00:00:00Z") }).find((s) => s.title === "Egara Juga 2026")!;
const EVENT = { startsAt: egara.startsAt, endsAt: egara.endsAt };

const node = (over: Partial<ProgramNode> & Pick<ProgramNode, "id">): ProgramNode => ({
  kind: "play",
  title: over.id,
  startsAt: "2026-12-04T15:00:00Z",
  endsAt: "2026-12-04T17:00:00Z",
  alwaysOpen: false,
  game: { name: over.id },
  coverUrl: null,
  participantCount: 0,
  capacity: 4,
  minParticipants: null,
  attendance: "rsvp",
  tournamentFormat: null,
  visibility: "PUBLIC",
  ludoyaUrl: `https://ludoya.example/${over.id}`,
  children: [],
  ...over,
});

const SESSION = { startsAt: "2026-12-04T15:00:00Z", endsAt: "2026-12-04T19:30:00Z" };
const byTitle = (items: ProgramItem[], title: string) => items.find((i) => i.title === title)!;

describe("classifyProgram", () => {
  const items = classifyProgram(egara.subEvents, EVENT);

  it("turns zones into a subtitle and never into an item", () => {
    expect(items.map((i) => i.title)).not.toContain("Partides de ROL");
    expect(byTitle(items, "Mundodisco: Aventuras en Ankh-Morpork")).toMatchObject({ kind: "play", zone: "Partides de ROL", placement: "timed" });
    expect(byTitle(items, "Arkham Horror: El Juego de Cartas (Edición Revisada)")).toMatchObject({ kind: "play", zone: null });
  });

  it("marks tournaments with their format and tickets", () => {
    expect(byTitle(items, "Puerto Rico Tournament")).toMatchObject({ kind: "tournament", format: "TABLE_KNOCKOUT", tickets: true, zone: "Tornejos Awaken Realms" });
    expect(byTitle(items, "Torneig de Root")).toMatchObject({ kind: "tournament", format: "SWISS", tickets: false });
  });

  it("makes timed meetups activities and always-open or whole-event ones demos or activities", () => {
    expect(byTitle(items, "Torneig Crokinole")).toMatchObject({ kind: "activity", placement: "timed", zone: null });
    expect(byTitle(items, "Fearsome Floors")).toMatchObject({ kind: "demo", placement: "alwaysOpen", zone: "Demostracions de 2tomatoes" });
    // Dated, but covers the whole event.
    expect(byTitle(items, "Alta Tensión")).toMatchObject({ kind: "demo", placement: "alwaysOpen" });
    expect(byTitle(items, "A Risk Cat")).toMatchObject({ kind: "activity", placement: "alwaysOpen", zone: null });
  });

  it("counts every published item of the tree", () => {
    const count = (kind: ProgramItem["kind"]) => items.filter((i) => i.kind === kind).length;
    expect({ plays: count("play"), tournaments: count("tournament"), activities: count("activity"), demos: count("demo") }).toEqual({
      plays: 8,
      tournaments: 3,
      activities: 3,
      demos: 13,
    });
  });

  it("keeps a play that spans the whole session in the grid", () => {
    const [item] = classifyProgram([node({ id: "long", startsAt: SESSION.startsAt, endsAt: SESSION.endsAt })], SESSION);
    expect(item.placement).toBe("timed");
  });

  it("drops group-only nodes with their subtree and carries no organizer or visibility", () => {
    const tree = [
      node({ id: "zone", kind: "meetup", visibility: "ONLY_GROUP", children: [node({ id: "hidden" })] }),
      node({ id: "secret", visibility: "ONLY_GROUP" }),
      { ...node({ id: "shown" }), organizerName: "Host" } as ProgramNode,
    ];
    const result = classifyProgram(tree, SESSION);
    expect(result.map((i) => i.id)).toEqual(["shown"]);
    expect(result[0]).not.toHaveProperty("organizerName");
    expect(result[0]).not.toHaveProperty("visibility");
  });

  it("puts undated plays in the always-open block", () => {
    const [item] = classifyProgram([node({ id: "nodate", startsAt: null, endsAt: null })], SESSION);
    expect(item).toMatchObject({ kind: "play", placement: "alwaysOpen" });
  });
});

describe("layoutProgram", () => {
  it("splits a multi-day event into its days, all in slots when one day is above the threshold", () => {
    const layout = layoutProgram(classifyProgram(egara.subEvents, EVENT), EVENT);
    expect(layout.multiDay).toBe(true);
    expect(layout.days.map((d) => d.day)).toEqual(["2026-11-28", "2026-11-29"]);
    const [saturday, sunday] = layout.days;
    // Saturday: 4 plays, 3 tournaments, 2 activities = 9 timed items, above the threshold.
    expect(saturday.mode).toBe("slots");
    expect(saturday.groups.map((g) => g.startsAt)).toEqual(["2026-11-28T09:00:00Z", "2026-11-28T15:00:00Z", "2026-11-28T17:00:00Z"]);
    expect(saturday.counts).toEqual({ plays: 4, tournaments: 3, activities: 2, demos: 0 });
    // Sunday has fewer items but follows Saturday, so the whole event reads the same way.
    expect(sunday.mode).toBe("slots");
    expect(sunday.groups.map((g) => [g.startsAt, g.items.length])).toEqual([["2026-11-29T09:00:00Z", 4]]);
    expect(sunday.counts.plays).toBe(4);
  });

  it("keeps every day of a multi-day event in a grid when none is above the threshold", () => {
    const WEEKEND = { startsAt: "2026-12-05T09:00:00Z", endsAt: "2026-12-06T18:00:00Z" };
    const items = classifyProgram(
      [
        ...Array.from({ length: PROGRAM_SLOT_THRESHOLD }, (_, i) => node({ id: `sat${i}`, startsAt: "2026-12-05T10:00:00Z", endsAt: "2026-12-05T12:00:00Z" })),
        node({ id: "sun", startsAt: "2026-12-06T10:00:00Z", endsAt: "2026-12-06T12:00:00Z" }),
      ],
      WEEKEND
    );
    expect(layoutProgram(items, WEEKEND).days.map((d) => d.mode)).toEqual(["grid", "grid"]);
  });

  it("groups the always-open block by zone, zone-less last", () => {
    const layout = layoutProgram(classifyProgram(egara.subEvents, EVENT), EVENT);
    expect(layout.alwaysOpen.map((g) => [g.zone, g.items.length])).toEqual([
      ["Demostracions de 2tomatoes", 5],
      ["Demostracions SD Games", 6],
      ["Demostracions Tranjis games", 2],
      [null, 1],
    ]);
    expect(layout.counts).toEqual({ plays: 8, tournaments: 3, activities: 3, demos: 13 });
  });

  it("keeps a grid up to the threshold and switches to slots above it", () => {
    const at = (n: number) =>
      classifyProgram(
        Array.from({ length: n }, (_, i) => node({ id: `p${i}`, startsAt: i % 2 ? "2026-12-04T16:00:00Z" : "2026-12-04T15:00:00Z" })),
        SESSION
      );
    const grid = layoutProgram(at(PROGRAM_SLOT_THRESHOLD), SESSION);
    expect(PROGRAM_SLOT_THRESHOLD).toBe(8);
    expect(grid.multiDay).toBe(false);
    expect(grid.days).toHaveLength(1);
    expect(grid.days[0].mode).toBe("grid");
    const starts = grid.days[0].groups[0].items.map((i) => i.startsAt);
    expect(starts).toEqual([...starts].sort());
    const slots = layoutProgram(at(PROGRAM_SLOT_THRESHOLD + 1), SESSION);
    expect(slots.days[0].mode).toBe("slots");
    expect(slots.days[0].groups.map((g) => g.items.length)).toEqual([5, 4]);
  });

  it("returns no days for an event without timed items", () => {
    const layout = layoutProgram([], SESSION);
    expect(layout).toEqual({ multiDay: false, days: [], alwaysOpen: [], counts: { plays: 0, tournaments: 0, activities: 0, demos: 0 } });
  });
});
