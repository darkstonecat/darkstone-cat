import { beforeEach, describe, expect, it, vi } from "vitest";

const lookups = vi.hoisted(() => ({
  ludoya: vi.fn(),
  bgg: vi.fn(),
}));
let forwardedFor = "203.0.113.7";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": `${forwardedFor}, 10.0.0.1` }),
}));
vi.mock("@/lib/ludoya/username", () => ({ lookupLudoyaUsername: lookups.ludoya }));
vi.mock("@/lib/bgg-user", () => ({ lookupBggUsername: lookups.bgg }));

import { checkBggUsername, checkLudoyaUsername } from "@/lib/profile/username-checks";
import { resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
  forwardedFor = "203.0.113.7";
});

describe("username check actions", () => {
  it("returns the lookup status for a trimmed username", async () => {
    lookups.ludoya.mockResolvedValue("found");
    lookups.bgg.mockResolvedValue("not_found");

    expect(await checkLudoyaUsername("  member-a  ")).toEqual({ status: "found" });
    expect(await checkBggUsername("member-a")).toEqual({ status: "not_found" });
    expect(lookups.ludoya).toHaveBeenCalledWith("member-a");
  });

  it("does not call upstream for empty or oversized input", async () => {
    expect(await checkLudoyaUsername("   ")).toEqual({ status: "failed" });
    expect(await checkBggUsername("x".repeat(65))).toEqual({ status: "failed" });
    expect(lookups.ludoya).not.toHaveBeenCalled();
    expect(lookups.bgg).not.toHaveBeenCalled();
  });

  it("reports failed (never throws) when the lookup fails", async () => {
    lookups.ludoya.mockResolvedValue("failed");
    expect(await checkLudoyaUsername("member-a")).toEqual({ status: "failed" });
  });

  it("throttles one client per service, without affecting others", async () => {
    lookups.ludoya.mockResolvedValue("found");
    for (let i = 0; i < 20; i++) await checkLudoyaUsername(`user-${i}`);
    expect(lookups.ludoya).toHaveBeenCalledTimes(20);

    expect(await checkLudoyaUsername("one-too-many")).toEqual({ status: "failed" });
    expect(lookups.ludoya).toHaveBeenCalledTimes(20);

    lookups.bgg.mockResolvedValue("found");
    expect(await checkBggUsername("member-a")).toEqual({ status: "found" });

    forwardedFor = "198.51.100.9";
    expect(await checkLudoyaUsername("member-a")).toEqual({ status: "found" });
  });
});
