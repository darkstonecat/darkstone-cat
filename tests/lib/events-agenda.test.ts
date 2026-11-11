import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bgg = vi.hoisted(() => ({
  fetchBggCollection: vi.fn(),
  searchBggGames: vi.fn(),
  fetchBggThings: vi.fn(),
}));
vi.mock("@/lib/bgg", () => bgg);

import { fetchEventsAgenda } from "@/lib/events/agenda";

// Friday 2 October 2026, 14:00 in Madrid (the mock fixtures' dates).
const NOW = new Date("2026-10-02T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("LUDOYA_MOCK", "1");
  bgg.fetchBggCollection.mockResolvedValue({ games: [] });
  bgg.searchBggGames.mockResolvedValue([]);
  bgg.fetchBggThings.mockResolvedValue(new Map());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.values(bgg).forEach((m) => m.mockReset());
});

describe("fetchEventsAgenda", () => {
  it("returns four weeks of sessions plus the special events, from the 60 s request", async () => {
    const { agenda, error } = await fetchEventsAgenda(NOW);

    expect(error).toBeUndefined();
    const weeks = agenda.weeks.map((w) => [w.start, w.isCurrent, w.events.map((e) => e.title)]);
    expect(weeks[0]).toEqual(["2026-09-28", true, ["Divendres de jocs!", "Dissabtes de jocs!"]]);
    // Egara Juga (28-29 Nov) is past the four weeks but listed as a special.
    expect(agenda.specials.map((s) => s.title)).toEqual(["Juguem a El Cartón Peleón!", "Egara Juga 2026"]);
    expect(agenda.specials.map((s) => s.countdown)).toEqual([
      { kind: "days", days: 9 },
      { kind: "days", days: 57 },
    ]);
    expect(agenda.weeks.at(-1)).toMatchObject({ start: "2026-11-23", isCurrent: false });
    // A regular session past the four weeks (25 Dec) is not listed.
    expect(agenda.weeks.flatMap((w) => w.events).some((e) => e.startsAt.startsWith("2026-12-25"))).toBe(false);
  });

  it("gives every play of the first session a cover and seat data", async () => {
    const { agenda } = await fetchEventsAgenda(NOW);
    const friday = agenda.weeks[0].events[0];

    expect(friday.plays.map((p) => p.gameName)).toEqual([
      "Emberleaf",
      "Signorie",
      "Forest Shuffle: Smoky Mountains",
      "Fábricas Fantásticas",
    ]);
    expect(friday.plays[0]).toMatchObject({ participantCount: 3, capacity: 4, minParticipants: 1 });
    expect(friday.plays.every((p) => p.coverUrl !== undefined)).toBe(true);
  });

  it("sends no organizer names to the page", async () => {
    const { agenda } = await fetchEventsAgenda(NOW);

    expect(JSON.stringify(agenda)).not.toMatch(/organizer/i);
  });

  it("returns an empty agenda and the error kind when Ludoya fails", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fetchEventsAgenda(NOW);

    expect(result.agenda).toEqual({ weeks: [], specials: [] });
    expect(result.error).toBe("api_error");
  });
});
