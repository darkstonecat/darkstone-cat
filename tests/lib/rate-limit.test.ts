import { beforeEach, describe, expect, it } from "vitest";
import { allowRequest, MAX_KEYS, resetRateLimits } from "@/lib/rate-limit";

beforeEach(resetRateLimits);

describe("allowRequest", () => {
  it("allows up to the limit inside the window and then blocks", () => {
    expect([1, 2, 3].map((i) => allowRequest("k", 3, 1000, i))).toEqual([true, true, true]);
    expect(allowRequest("k", 3, 1000, 4)).toBe(false);
  });

  it("frees slots as the window slides", () => {
    allowRequest("k", 1, 1000, 0);
    expect(allowRequest("k", 1, 1000, 999)).toBe(false);
    expect(allowRequest("k", 1, 1000, 1000)).toBe(true);
  });

  it("keeps keys independent", () => {
    allowRequest("a", 1, 1000, 0);
    expect(allowRequest("b", 1, 1000, 0)).toBe(true);
  });

  it("keeps the map bounded by evicting the least recently used keys", () => {
    for (let i = 0; i < MAX_KEYS + 10; i++) allowRequest(`k${i}`, 1, 60_000, 0);
    // The oldest keys were evicted, so they get a fresh slot; the newest are still limited.
    expect(allowRequest("k0", 1, 60_000, 1)).toBe(true);
    expect(allowRequest(`k${MAX_KEYS + 9}`, 1, 60_000, 1)).toBe(false);
  });

  it("does not evict a key that is still being used", () => {
    allowRequest("hot", 1, 60_000, 0);
    for (let i = 0; i < MAX_KEYS - 1; i++) allowRequest(`k${i}`, 1, 60_000, 0);
    allowRequest("hot", 1, 60_000, 1); // refreshed, now the most recent
    for (let i = 0; i < 5; i++) allowRequest(`extra${i}`, 1, 60_000, 2);
    expect(allowRequest("hot", 1, 60_000, 3)).toBe(false);
  });
});
