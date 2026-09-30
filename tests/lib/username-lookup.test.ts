import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupBggUsername } from "@/lib/bgg-user";
import { lookupLudoyaUsername } from "@/lib/ludoya/username";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  fetchMock.mockReset();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const users = (...names: string[]) => ({
  users: { elements: names.map((username, i) => ({ id: `id${i}`, username, name: username, avatarUrl: null })) },
});

describe("lookupLudoyaUsername", () => {
  beforeEach(() => {
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    vi.stubEnv("LUDOYA_MOCK", "");
  });

  it("is found on an exact, case-insensitive username match", async () => {
    fetchMock.mockResolvedValueOnce(json(users("member-a")));
    expect(await lookupLudoyaUsername("Member-A")).toBe("found");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/public/v1/search/users");
    expect(url.searchParams.get("intent")).toBe("PLAY");
    expect(url.searchParams.get("query")).toBe("Member-A");
  });

  it("is not_found when only partial matches come back, or nothing does", async () => {
    fetchMock.mockResolvedValueOnce(json(users("member-abc", "amember-a")));
    expect(await lookupLudoyaUsername("member-a")).toBe("not_found");
    fetchMock.mockResolvedValueOnce(json(users()));
    expect(await lookupLudoyaUsername("nobody")).toBe("not_found");
  });

  it("is failed on API errors, network errors and a changed shape", async () => {
    fetchMock.mockResolvedValueOnce(json({ code: "unauthorized" }, 401));
    expect(await lookupLudoyaUsername("member-a")).toBe("failed");

    fetchMock.mockResolvedValueOnce(json({ users: [] }));
    expect(await lookupLudoyaUsername("member-a")).toBe("failed");

    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    const pending = lookupLudoyaUsername("member-a");
    await vi.runAllTimersAsync();
    expect(await pending).toBe("failed");
  });

  it("is failed without a key", async () => {
    vi.stubEnv("LUDOYA_API_KEY", "");
    expect(await lookupLudoyaUsername("member-a")).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the fixtures in mock mode", async () => {
    vi.stubEnv("LUDOYA_MOCK", "1");
    vi.stubEnv("LUDOYA_API_KEY", "");
    expect(await lookupLudoyaUsername("member-a")).toBe("found");
    expect(await lookupLudoyaUsername("someone-else")).toBe("not_found");
  });
});

describe("lookupBggUsername", () => {
  const userXml = (id: string) =>
    `<?xml version="1.0" encoding="utf-8"?><user id="${id}" name="member_a" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"><firstname value="" /></user>`;

  beforeEach(() => vi.stubEnv("BGG_API_KEY", "bgg_test_token"));

  it("is found for a 200 user document, sending the bearer token without caching", async () => {
    fetchMock.mockResolvedValueOnce(new Response(userXml("12345"), { status: 200 }));
    expect(await lookupBggUsername("member a&b")).toBe("found");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://boardgamegeek.com/xmlapi2/user?name=member%20a%26b");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer bgg_test_token");
    expect(init?.cache).toBe("no-store");
  });

  it("is not_found for the 404 page BGG sends for unknown names", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<!DOCTYPE html><title>404 - Page Not Found</title>", { status: 404 }));
    expect(await lookupBggUsername("nobody")).toBe("not_found");
  });

  it("is not_found for a 200 user document with an empty id", async () => {
    fetchMock.mockResolvedValueOnce(new Response(userXml(""), { status: 200 }));
    expect(await lookupBggUsername("nobody")).toBe("not_found");
  });

  it("is failed for other statuses, unexpected bodies, network errors and a missing token", async () => {
    fetchMock.mockResolvedValueOnce(new Response("busy", { status: 429 }));
    expect(await lookupBggUsername("x")).toBe("failed");
    fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>", { status: 200 }));
    expect(await lookupBggUsername("x")).toBe("failed");
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await lookupBggUsername("x")).toBe("failed");

    vi.stubEnv("BGG_API_KEY", "");
    fetchMock.mockClear();
    expect(await lookupBggUsername("x")).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
