import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BggGame } from "@/lib/bgg";

const bgg = vi.hoisted(() => ({
  fetchBggCollection: vi.fn(),
  searchBggGames: vi.fn(),
  fetchBggThings: vi.fn(),
}));
vi.mock("@/lib/bgg", () => bgg);

import { COVER_BUDGET_MS, fetchMemberAreaSessions, withCovers } from "@/lib/member-sessions";

const collectionGame = (over: Partial<BggGame>): BggGame => ({
  id: "1",
  subtype: "boardgame",
  name: "X",
  year: 0,
  thumbnail: "",
  image: "",
  minPlayers: 1,
  maxPlayers: 4,
  playingTime: 60,
  rating: 7,
  weight: 2.5,
  minAge: 8,
  categories: [],
  mechanics: [],
  rankTypes: [],
  expansions: [],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
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

/** Friday 2 and Saturday 3 October of the mock fixtures (4 and 2 plays). */
async function weekend() {
  const sessions = await fetchMemberAreaSessions();
  return sessions.filter((s) => s.startsAt >= "2026-10-02" && s.startsAt < "2026-10-04");
}

describe("withCovers", () => {
  it("keeps every play with its seats and place, Ludoya cover as fallback", async () => {
    const sessions = await withCovers(await weekend(), Infinity);

    expect(sessions.map((s) => s.title)).toEqual(["Divendres de jocs!", "Dissabtes de jocs!"]);
    const friday = sessions[0];
    expect(friday.plannedPlays).toHaveLength(4);
    expect(friday.place).toMatchObject({ name: "Centre Cívic Ca N’Aurell", isUsual: true });
    const play = friday.plannedPlays[0];
    expect(play).toMatchObject({ gameName: "Emberleaf", participantCount: 3, capacity: 4 });
    expect(play.coverUrl).toBe(play.imageUrl);
  });

  it("uses the BGG cover when name and year agree with the club collection", async () => {
    bgg.fetchBggCollection.mockResolvedValue({
      games: [collectionGame({ id: "1", name: "Signorie", year: 2015, image: "https://bgg.example/signorie.jpg" })],
    });

    const [friday] = await withCovers(await weekend(), Infinity);
    const signorie = friday.plannedPlays.find((p) => p.gameName === "Signorie")!;
    const emberleaf = friday.plannedPlays.find((p) => p.gameName === "Emberleaf")!;

    expect(signorie.coverUrl).toBe("https://bgg.example/signorie.jpg");
    expect(emberleaf.coverUrl).toBe(emberleaf.imageUrl);
  });

  it("keeps the Ludoya cover when the year differs (possible wrong edition)", async () => {
    bgg.fetchBggCollection.mockResolvedValue({
      games: [collectionGame({ name: "Signorie", year: 2001, image: "https://bgg.example/other.jpg" })],
    });

    const [friday] = await withCovers(await weekend(), Infinity);
    const signorie = friday.plannedPlays.find((p) => p.gameName === "Signorie")!;
    expect(signorie.coverUrl).toBe(signorie.imageUrl);
  });

  it("falls back to Ludoya covers when BGG is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    bgg.fetchBggCollection.mockRejectedValue(new Error("BGG down"));
    bgg.searchBggGames.mockRejectedValue(new Error("BGG down"));

    const [friday] = await withCovers(await weekend(), Infinity);
    expect(friday.plannedPlays.every((p) => p.coverUrl === p.imageUrl)).toBe(true);
  });

  it("does not wait for a slow BGG: after the cover budget the Ludoya covers are used", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    bgg.fetchBggCollection.mockReturnValue(new Promise(() => {})); // never settles
    const input = await weekend();

    let settled = false;
    const pending = withCovers(input, Infinity).finally(() => (settled = true));
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(COVER_BUDGET_MS + 100);
      expect(settled).toBe(true);
    });
    const sessions = await pending;

    expect(sessions).toHaveLength(2);
    expect(sessions.flatMap((s) => s.plannedPlays).every((p) => p.coverUrl === p.imageUrl)).toBe(true);
  });

  it("looks up BGG only for the first plays of each session", async () => {
    const input = await weekend();
    await withCovers(input, 1);
    expect(bgg.searchBggGames).toHaveBeenCalledTimes(2);

    bgg.searchBggGames.mockClear();
    await withCovers(input, Infinity);
    expect(bgg.searchBggGames).toHaveBeenCalledTimes(6);
  });
});

describe("fetchMemberAreaSessions", () => {
  it("asks for past events too, so a running multi-day event is not lost", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      new Response(
        JSON.stringify(
          String(input).includes("/locations")
            ? { locations: [] }
            : {
                futureEvents: { elements: [] },
                pastEvents: {
                  elements: [
                    { id: "run", type: "MEETUP", visibility: "PUBLIC", title: "Running", startsAt: "2026-10-01T09:00:00Z", endsAt: "2026-10-03T16:00:00Z" },
                  ],
                },
              }
        ),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const sessions = await fetchMemberAreaSessions();

    const eventsUrl = fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.includes("/events"))!;
    expect(eventsUrl).toContain("pastLimit=200");
    expect(sessions.map((s) => s.id)).toEqual(["run"]);
  });
});
