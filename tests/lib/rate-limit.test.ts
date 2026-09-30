import { beforeEach, describe, expect, it } from "vitest";
import { allowRequest, resetRateLimits } from "@/lib/rate-limit";

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
});
