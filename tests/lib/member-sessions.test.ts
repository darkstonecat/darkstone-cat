import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BggGame } from "@/lib/bgg";

const bgg = vi.hoisted(() => ({
  fetchBggCollection: vi.fn(),
  searchBggGames: vi.fn(),
  fetchBggThings: vi.fn(),
}));
vi.mock("@/lib/bgg", () => bgg);

import { fetchMemberWeekSessions, fetchMonthEvents } from "@/lib/member-sessions";

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

describe("fetchMemberWeekSessions", () => {
  it("returns the next seven days with plays, seats, place and Ludoya covers as fallback", async () => {
    const result = await fetchMemberWeekSessions();

    expect(result.error).toBeUndefined();
    expect(result.sessions.map((s) => s.title)).toEqual(["Divendres de jocs!", "Dissabtes de jocs!"]);
    const friday = result.sessions[0];
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

    const { sessions } = await fetchMemberWeekSessions();
    const signorie = sessions[0].plannedPlays.find((p) => p.gameName === "Signorie")!;
    const emberleaf = sessions[0].plannedPlays.find((p) => p.gameName === "Emberleaf")!;

    expect(signorie.coverUrl).toBe("https://bgg.example/signorie.jpg");
    expect(emberleaf.coverUrl).toBe(emberleaf.imageUrl);
  });

  it("keeps the Ludoya cover when the year differs (possible wrong edition)", async () => {
    bgg.fetchBggCollection.mockResolvedValue({
      games: [collectionGame({ name: "Signorie", year: 2001, image: "https://bgg.example/other.jpg" })],
    });

    const { sessions } = await fetchMemberWeekSessions();
    const signorie = sessions[0].plannedPlays.find((p) => p.gameName === "Signorie")!;
    expect(signorie.coverUrl).toBe(signorie.imageUrl);
  });

  it("falls back to Ludoya covers when BGG is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    bgg.fetchBggCollection.mockRejectedValue(new Error("BGG down"));
    bgg.searchBggGames.mockRejectedValue(new Error("BGG down"));

    const { sessions, error } = await fetchMemberWeekSessions();

    expect(error).toBeUndefined();
    expect(sessions[0].plannedPlays.every((p) => p.coverUrl === p.imageUrl)).toBe(true);
  });

  it("only resolves BGG covers for the plays the home shows (max 5 per session)", async () => {
    await fetchMemberWeekSessions();
    // Friday has 4 plays and Saturday 2, all under the cap → one search each.
    expect(bgg.searchBggGames).toHaveBeenCalledTimes(6);
  });

  it("reports api_error and timeout instead of throwing", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "unauthorized" }), { status: 401 })));
    expect(await fetchMemberWeekSessions()).toEqual({ sessions: [], error: "api_error" });

    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }));
    const pending = fetchMemberWeekSessions();
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ sessions: [], error: "timeout" });
  });
});

describe("fetchMonthEvents", () => {
  it("returns the sessions of the requested Madrid month without covers work", async () => {
    const { events, error } = await fetchMonthEvents(2026, 11);
    expect(error).toBeUndefined();
    expect(events.map((e) => e.title)).toContain("Egara Juga 2026");
    expect(bgg.searchBggGames).not.toHaveBeenCalled();
  });

  it("asks for past events only when the month has already started", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      new Response(
        JSON.stringify(
          String(input).includes("/locations")
            ? { locations: [] }
            : { futureEvents: { elements: [] }, pastEvents: { elements: [] } }
        ),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchMonthEvents(2026, 10); // current month
    await fetchMonthEvents(2026, 11); // future month

    const urls = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/events"));
    expect(urls[0]).toContain("pastLimit=60");
    expect(urls[1]).not.toContain("pastLimit");
  });
});
