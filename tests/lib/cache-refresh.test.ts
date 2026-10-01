import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, fetchMember, fetchPublic } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  fetchMember: vi.fn(),
  fetchPublic: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/member-sessions", () => ({ fetchMemberAreaSessions: fetchMember }));
vi.mock("@/lib/ludoya", () => ({ fetchPublicSessions: fetchPublic }));

import { REFRESH_JOBS, runRefreshJobs } from "@/lib/cache-refresh";

describe("runRefreshJobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the tag stale with the max profile before warming", async () => {
    const order: string[] = [];
    revalidateTag.mockImplementation(() => order.push("revalidate"));
    const warm = vi.fn(async () => void order.push("warm"));

    const results = await runRefreshJobs([{ name: "a", tag: "tag-a", warm }]);

    expect(revalidateTag).toHaveBeenCalledWith("tag-a", "max");
    expect(order).toEqual(["revalidate", "warm"]);
    expect(results).toEqual([{ name: "a", ok: true }]);
  });

  it("reports a failing job with its message and still runs the others", async () => {
    const warmOk = vi.fn(async () => {});
    const results = await runRefreshJobs([
      { name: "bad", tag: "t1", warm: async () => Promise.reject(new Error("boom")) },
      { name: "good", tag: "t2", warm: warmOk },
    ]);

    expect(results).toEqual([
      { name: "bad", ok: false, error: "boom" },
      { name: "good", ok: true },
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
});
