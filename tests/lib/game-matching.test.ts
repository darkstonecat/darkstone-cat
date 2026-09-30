import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BggGame } from "@/lib/bgg";
import type { LudoyaPlannedPlay } from "@/lib/ludoya";

const bgg = vi.hoisted(() => ({
  searchBggGames: vi.fn(),
  fetchBggThings: vi.fn(),
}));
vi.mock("@/lib/bgg", () => bgg);

import { resolveEventGames } from "@/lib/game-matching";

const play = (over: Partial<LudoyaPlannedPlay>): LudoyaPlannedPlay => ({
  gameName: "Game",
  imageUrl: "https://ludoya-images.example/game.jpg",
  yearPublished: 0,
  slug: "game",
  ...over,
});

const collectionGame = (over: Partial<BggGame>): BggGame => ({
  id: "1",
  subtype: "boardgame",
  name: "Game",
  year: 0,
  thumbnail: "",
  image: "https://bgg.example/game.jpg",
  minPlayers: 1,
  maxPlayers: 4,
  playingTime: 60,
  rating: 7,
  weight: 3,
  minAge: 8,
  categories: [],
  mechanics: [],
  rankTypes: [],
  expansions: [],
  ...over,
});

const fetchSpy = vi.fn();

beforeEach(() => {
  bgg.searchBggGames.mockResolvedValue([]);
  bgg.fetchBggThings.mockResolvedValue(new Map());
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchSpy.mockReset();
  Object.values(bgg).forEach((m) => m.mockReset());
});

describe("resolveEventGames", () => {
  it("uses the BGG cover and weight when name and year match the club collection", async () => {
    const [game] = await resolveEventGames(
      [play({ gameName: "Signorie", yearPublished: 2015 })],
      [collectionGame({ id: "77", name: "Signorie", year: 2015, weight: 3.2 })]
    );
    expect(game).toMatchObject({
      name: "Signorie",
      bggId: "77",
      imageUrl: "https://bgg.example/game.jpg",
      weight: 3.2,
      type: "boardgame",
      frame: "orange",
    });
  });

  it("keeps the Ludoya cover on a name-only match (year missing or different)", async () => {
    const games = await resolveEventGames(
      [
        play({ gameName: "Emberleaf", yearPublished: 0, imageUrl: "https://ludoya-images.example/a.jpg" }),
        play({ gameName: "Signorie", yearPublished: 2015, imageUrl: "https://ludoya-images.example/b.jpg" }),
      ],
      [
        collectionGame({ id: "1", name: "Emberleaf", year: 2024 }),
        collectionGame({ id: "2", name: "Signorie", year: 2001 }),
      ]
    );
    expect(games.map((g) => g.imageUrl)).toEqual([
      "https://ludoya-images.example/a.jpg",
      "https://ludoya-images.example/b.jpg",
    ]);
    expect(games.map((g) => g.bggId)).toEqual(["1", "2"]);
  });

  it("falls back to BGG search (year as tiebreaker) and then thing data", async () => {
    bgg.searchBggGames.mockResolvedValue([
      { id: "10", name: "Ostia", year: 2001 },
      { id: "11", name: "Ostia", year: 2019 },
    ]);
    bgg.fetchBggThings.mockResolvedValue(
      new Map([
        ["11", { id: "11", name: "Ostia", image: "https://bgg.example/ostia.jpg", thumbnail: "", weight: 1.8, categories: [], thingType: "boardgame" }],
      ])
    );

    const [game] = await resolveEventGames([play({ gameName: "Ostia", yearPublished: 2019 })], []);

    expect(bgg.fetchBggThings).toHaveBeenCalledWith(["11"]);
    expect(game).toMatchObject({ bggId: "11", imageUrl: "https://bgg.example/ostia.jpg", frame: "green" });
  });

  it("ends with the Ludoya cover and the default frame when BGG knows nothing", async () => {
    const [game] = await resolveEventGames([play({ gameName: "Unknown Prototype" })], []);
    expect(game).toMatchObject({ bggId: "", weight: 0, frame: "orange", imageUrl: "https://ludoya-images.example/game.jpg" });
  });

  it("detects RPGs by name now that Ludoya sends no game type", async () => {
    const [game] = await resolveEventGames([play({ gameName: "Dungeons & Dragons (5th Edition)" })], []);
    expect(game).toMatchObject({ type: "rpg", frame: "rpg" });
  });

  it("matches the RPG name list on whole words only", async () => {
    const games = await resolveEventGames(
      [
        play({ gameName: "Fateful Journey", slug: "a", imageUrl: "https://l.example/a.jpg" }),
        play({ gameName: "Fate Core", slug: "b", imageUrl: "https://l.example/b.jpg" }),
        play({ gameName: "Warhammer Fantasy Roleplay: Rough Nights", slug: "c", imageUrl: "https://l.example/c.jpg" }),
      ],
      []
    );
    expect(games.map((g) => [g.name, g.type])).toEqual([
      ["Fateful Journey", "boardgame"],
      ["Fate Core", "rpg"],
      ["Warhammer Fantasy Roleplay: Rough Nights", "rpg"],
    ]);
  });

  it("does not trust a fuzzy collection match unless the year agrees", async () => {
    const collection = [collectionGame({ id: "9", name: "Terraforming Marsh", year: 2010, weight: 4.5 })];
    const [wrongYear] = await resolveEventGames([play({ gameName: "Terraforming Mars", yearPublished: 2016 })], collection);
    expect(wrongYear).toMatchObject({ bggId: "", weight: 0, frame: "orange" });

    const [noYear] = await resolveEventGames([play({ gameName: "Terraforming Mars", yearPublished: 0 })], collection);
    expect(noYear).toMatchObject({ bggId: "", weight: 0 });

    const [sameYear] = await resolveEventGames([play({ gameName: "Terraforming Mars", yearPublished: 2010 })], collection);
    expect(sameYear).toMatchObject({ bggId: "9", weight: 4.5, frame: "red" });
  });

  it("does not trust a fuzzy BGG search result unless the year agrees, but trusts an exact name", async () => {
    bgg.searchBggGames.mockResolvedValue([{ id: "20", name: "Terraforming Marsh", year: 2010 }]);
    bgg.fetchBggThings.mockResolvedValue(
      new Map([["20", { id: "20", name: "x", image: "https://bgg.example/x.jpg", thumbnail: "", weight: 4.5, categories: [], thingType: "boardgame" }]])
    );
    const [fuzzy] = await resolveEventGames([play({ gameName: "Terraforming Mars", yearPublished: 2016 })], []);
    expect(fuzzy).toMatchObject({ bggId: "", weight: 0 });

    bgg.searchBggGames.mockResolvedValue([{ id: "20", name: "Terraforming Mars", year: 2016 }]);
    const [exact] = await resolveEventGames([play({ gameName: "Terraforming Mars", yearPublished: 0 })], []);
    expect(exact).toMatchObject({ bggId: "20", weight: 4.5 });
  });

  it("makes no Ludoya request: there is no BGG id bridge any more", async () => {
    await resolveEventGames([play({ gameName: "Ostia", slug: "ostia" })], []);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("logs how every game resolved, in Ludoya order", async () => {
    bgg.searchBggGames.mockImplementation(async (q: string) => (q === "Ostia" ? [{ id: "11", name: "Ostia", year: 2019 }] : []));
    bgg.fetchBggThings.mockResolvedValue(
      new Map([["11", { id: "11", name: "Ostia", image: "https://bgg.example/o.jpg", thumbnail: "", weight: 2, categories: [], thingType: "boardgame" }]])
    );

    await resolveEventGames(
      [play({ gameName: "Signorie", yearPublished: 2015 }), play({ gameName: "Ostia", yearPublished: 2019 }), play({ gameName: "Prototype X" })],
      [collectionGame({ id: "77", name: "Signorie", year: 2015 })]
    );

    expect(console.info).toHaveBeenCalledWith(
      "[EventImage] Resolved 3/3 games: Signorie (collection-name #77), Ostia (bgg-search #11), Prototype X (ludoya-only)"
    );
  });
});
