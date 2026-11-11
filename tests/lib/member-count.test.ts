import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { query, unstableCache } = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    is: vi.fn(),
  };
  // Pass-through cache: the test checks the options, not Next's cache itself.
  const unstableCache = vi.fn((fn: () => Promise<unknown>) => fn);
  return { query, unstableCache };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => (table === "members" ? query : null) }),
}));

import { MEMBER_COUNT_CACHE_TAG, fetchActiveMemberCount } from "@/lib/supabase/member-count";

// Taken at import time: the cache wrapper is built once, and mocks are cleared between tests.
const cacheCall = unstableCache.mock.calls[0];

beforeEach(() => {
  query.select.mockReset().mockReturnValue(query);
  query.is.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchActiveMemberCount", () => {
  it("counts members without a leave date, without reading any row", async () => {
    query.is.mockResolvedValue({ count: 202, error: null });

    await expect(fetchActiveMemberCount()).resolves.toBe(202);
    expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(query.is).toHaveBeenCalledWith("left_on", null);
  });

  it("caches the count for a day under its own tag", () => {
    expect(cacheCall).toEqual([
      expect.any(Function),
      ["active-member-count"],
      { revalidate: 86400, tags: [MEMBER_COUNT_CACHE_TAG] },
    ]);
  });

  it("returns null and logs only the Postgres code when the query fails", async () => {
    query.is.mockResolvedValue({ count: null, error: { code: "PGRST301", message: "secret detail" } });

    await expect(fetchActiveMemberCount()).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith("[member-count] failed code=%s", "PGRST301");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret detail");
  });

  it("returns null when the client throws", async () => {
    query.is.mockRejectedValue(new Error("fetch failed"));

    await expect(fetchActiveMemberCount()).resolves.toBeNull();
  });
});
