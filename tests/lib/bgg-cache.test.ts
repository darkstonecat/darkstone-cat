import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BGG_CACHE_TAG,
  fetchBggCollection,
  fetchBggCollectionCount,
  fetchBggCollectionOrThrow,
  fetchBggThings,
  searchBggGames,
} from "@/lib/bgg";

const COLLECTION_XML = `<items totalitems="1"><item objecttype="thing" objectid="10" subtype="boardgame"><name sortindex="1">Alpha</name><yearpublished>2020</yearpublished></item></items>`;
const EMPTY_XML = `<items totalitems="0"></items>`;

const fetchMock = vi.fn();

const calls = (needle: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(needle));

beforeEach(() => {
  vi.stubEnv("BGG_API_KEY", "token");
  vi.stubEnv("BGG_USERNAME", "club");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({
    status: 200,
    text: async () => (String(url).includes("/collection?") ? COLLECTION_XML : EMPTY_XML),
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BGG cache tags", () => {
  it("tags the base and expansion collection requests and their thing enrichment", async () => {
    await fetchBggCollectionOrThrow();

    const collection = calls("/collection?");
    expect(collection).toHaveLength(2);
    const enrichment = calls("/thing?");
    expect(enrichment.length).toBeGreaterThan(0);
    for (const [, init] of [...collection, ...enrichment]) {
      expect(init.next).toEqual({ revalidate: 86400, tags: [BGG_CACHE_TAG] });
    }
  });

  it("tags the collection count request used by /about", async () => {
    await fetchBggCollectionCount();

    const [[, init]] = calls("/collection?");
    expect(init.next.tags).toEqual(["bgg"]);
  });

  it("leaves per-game lookups untagged", async () => {
    await searchBggGames("Alpha");
    await fetchBggThings(["10"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.next).toEqual({ revalidate: 86400 });
    }
  });
});

describe("fetchBggCollectionOrThrow", () => {
  it("throws when BGG fails, while fetchBggCollection keeps returning an error result", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(fetchBggCollectionOrThrow()).rejects.toThrow("network down");

    const result = await fetchBggCollection();
    expect(result.games).toEqual([]);
    expect(result.error).toBe("api_error");
  });

  it("resolves with the collection in mock mode without calling fetch", async () => {
    vi.stubEnv("BGG_API_KEY", "");

    const result = await fetchBggCollectionOrThrow();

    expect(result.error).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
