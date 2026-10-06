import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, fetchMember, fetchPublic, fetchBgg } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  fetchMember: vi.fn(),
  fetchPublic: vi.fn(),
  fetchBgg: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/member-sessions", () => ({ fetchMemberAreaSessions: fetchMember }));
vi.mock("@/lib/ludoya", () => ({ fetchPublicSessions: fetchPublic }));

vi.mock("@/lib/bgg", () => ({ BGG_CACHE_TAG: "bgg", fetchBggCollectionOrThrow: fetchBgg }));

import { REFRESH_JOBS, refreshErrorCode, runRefreshJobs } from "@/lib/cache-refresh";

describe("runRefreshJobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the tag stale with the max profile before warming", async () => {
    const order: string[] = [];
    revalidateTag.mockImplementation(() => order.push("revalidate"));
    const warm = vi.fn(async () => void order.push("warm"));

    const results = await runRefreshJobs([{ name: "a", tag: "tag-a", warm }]);

    expect(revalidateTag).toHaveBeenCalledWith("tag-a", "max");
    expect(order).toEqual(["revalidate", "warm"]);
    expect(results).toEqual([{ name: "a", ok: true, durationMs: expect.any(Number) }]);
  });

  it("reports a failing job with its message and still runs the others", async () => {
    const warmOk = vi.fn(async () => {});
    const results = await runRefreshJobs([
      { name: "bad", tag: "t1", warm: async () => Promise.reject(new Error("boom")) },
      { name: "good", tag: "t2", warm: warmOk },
    ]);

    expect(results).toEqual([
      { name: "bad", ok: false, error: "boom", errorCode: "error", durationMs: expect.any(Number) },
      { name: "good", ok: true, durationMs: expect.any(Number) },
    ]);
    expect(warmOk).toHaveBeenCalled();
  });

  it("the Ludoya job warms the member-area and /events requests", async () => {
    const job = REFRESH_JOBS.find((j) => j.name === "ludoya")!;
    await job.warm();

    expect(job.tag).toBe("ludoya");
    expect(fetchMember).toHaveBeenCalledTimes(1);
    expect(fetchPublic).toHaveBeenCalledTimes(1);
  });

  it("registers the BGG job after Ludoya and warms the club collection", async () => {
    expect(REFRESH_JOBS.map((j) => j.name)).toEqual(["ludoya", "bgg"]);
    const job = REFRESH_JOBS.find((j) => j.name === "bgg")!;
    await job.warm();

    expect(job.tag).toBe("bgg");
    expect(fetchBgg).toHaveBeenCalledTimes(1);
  });

  it("reports the BGG job as failed when the collection warm-up throws", async () => {
    fetchBgg.mockRejectedValueOnce(new Error("bgg down"));
    const job = REFRESH_JOBS.find((j) => j.name === "bgg")!;

    expect(await runRefreshJobs([job])).toEqual([
      { name: "bgg", ok: false, error: "bgg down", errorCode: "error", durationMs: expect.any(Number) },
    ]);
  });

  it("measures the duration of each job in whole milliseconds", async () => {
    vi.useFakeTimers();
    try {
      const pending = runRefreshJobs([
        { name: "slow", tag: "t", warm: () => new Promise((resolve) => setTimeout(resolve, 1500)) },
      ]);
      await vi.advanceTimersByTimeAsync(1500);
      const [result] = await pending;
      expect(result.durationMs).toBe(1500);
    } finally {
      vi.useRealTimers();
    }
  });

  it("only selected jobs run when a subset is passed", async () => {
    const results = await runRefreshJobs(REFRESH_JOBS.filter((j) => j.name === "bgg"));
    expect(results.map((r) => r.name)).toEqual(["bgg"]);
    expect(fetchMember).not.toHaveBeenCalled();
  });
});

describe("refreshErrorCode", () => {
  it("keeps the Ludoya client's own short code", () => {
    const error = Object.assign(new Error("Ludoya API 503 (unknown): /events"), { name: "LudoyaApiError", code: "rate_limited" });
    expect(refreshErrorCode(error)).toBe("rate_limited");
  });

  it("maps a changed Ludoya shape, a timeout, an HTTP status and a missing key", () => {
    expect(refreshErrorCode(Object.assign(new Error("shape"), { name: "LudoyaShapeError" }))).toBe("shape_changed");
    expect(refreshErrorCode(new Error("BGG API timeout after retries"))).toBe("timeout");
    expect(refreshErrorCode(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe("timeout");
    expect(refreshErrorCode(new Error("BGG API error: HTTP 503"))).toBe("http_503");
    expect(refreshErrorCode(new Error("BGG_API_KEY not set"))).toBe("missing_api_key");
  });

  it("never passes a message, a malformed code or a non-error through", () => {
    const odd = Object.assign(new Error("x"), { name: "LudoyaApiError", code: "Not A Code; drop table" });
    expect(refreshErrorCode(odd)).toBe("error");
    expect(refreshErrorCode(new Error("something with user@example.com"))).toBe("error");
    expect(refreshErrorCode("boom")).toBe("error");
    expect(refreshErrorCode(null)).toBe("error");
  });
});
