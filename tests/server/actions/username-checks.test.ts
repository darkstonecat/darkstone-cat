import { beforeEach, describe, expect, it, vi } from "vitest";

const lookups = vi.hoisted(() => ({
  ludoya: vi.fn(),
  bgg: vi.fn(),
}));
let forwardedFor = "203.0.113.7";

let realIp: string | null = null;

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": `${forwardedFor}, 10.0.0.1`,
      ...(realIp ? { "x-real-ip": realIp } : {}),
    }),
}));
// The shared limiter is unavailable here, so the in-memory fallback does the throttling.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: () => ({ abortSignal: () => Promise.resolve({ data: null, error: { code: "TEST" } }) }),
  }),
}));
vi.mock("@/lib/ludoya/username", () => ({ lookupLudoyaUsername: lookups.ludoya }));
vi.mock("@/lib/bgg-user", () => ({ lookupBggUsername: lookups.bgg }));

import { checkBggUsername, checkLudoyaUsername } from "@/lib/profile/username-checks";
import { resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  resetRateLimits();
  forwardedFor = "203.0.113.7";
  realIp = null;
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

  it("never throws on non-string input and does not call upstream", async () => {
    for (const bad of [undefined, null, 42, { a: 1 }, ["x"]]) {
      expect(await checkLudoyaUsername(bad as never)).toEqual({ status: "failed" });
      expect(await checkBggUsername(bad as never)).toEqual({ status: "failed" });
    }
    expect(lookups.ludoya).not.toHaveBeenCalled();
    expect(lookups.bgg).not.toHaveBeenCalled();
  });

  it("rejects characters outside letters, digits, space, dot, dash and underscore", async () => {
    for (const bad of ["a&b=c", "x/y", "name?", "a\nb", "<script>"]) {
      expect(await checkLudoyaUsername(bad)).toEqual({ status: "failed" });
    }
    lookups.ludoya.mockResolvedValue("found");
    expect(await checkLudoyaUsername("José_Pérez.2-b")).toEqual({ status: "found" });
    expect(lookups.ludoya).toHaveBeenCalledTimes(1);
  });

  it("caps Ludoya lookups across all clients, without touching BGG", async () => {
    lookups.ludoya.mockResolvedValue("found");
    for (let i = 0; i < 30; i++) {
      forwardedFor = `198.51.100.${i}`;
      await checkLudoyaUsername("member-a");
    }
    forwardedFor = "192.0.2.1";
    expect(await checkLudoyaUsername("member-a")).toEqual({ status: "failed" });
    expect(lookups.ludoya).toHaveBeenCalledTimes(30);

    lookups.bgg.mockResolvedValue("found");
    expect(await checkBggUsername("member-a")).toEqual({ status: "found" });
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

  it("keys clients by x-real-ip before the forwarded chain", async () => {
    lookups.ludoya.mockResolvedValue("found");
    realIp = "203.0.113.50";
    for (let i = 0; i < 20; i++) {
      forwardedFor = `spoofed-${i}`; // a client cannot dodge the limit by rotating forwarded hops
      await checkLudoyaUsername("member-a");
    }
    forwardedFor = "spoofed-new";
    expect(await checkLudoyaUsername("member-a")).toEqual({ status: "failed" });
  });
});
