import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBggCollectionCount: vi.fn(),
  fetchActiveMemberCount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/bgg", () => ({ fetchBggCollectionCount: mocks.fetchBggCollectionCount }));
vi.mock("@/lib/supabase/member-count", () => ({ fetchActiveMemberCount: mocks.fetchActiveMemberCount }));

import { ABOUT_STATS_BUDGET_MS, fetchAboutStats } from "@/lib/about-stats";

const never = () => new Promise<never>(() => {});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchAboutStats", () => {
  it("returns both counts when they arrive in time", async () => {
    mocks.fetchBggCollectionCount.mockResolvedValue(312);
    mocks.fetchActiveMemberCount.mockResolvedValue(209);

    await expect(fetchAboutStats()).resolves.toEqual({ gameCount: 312, memberCount: 209 });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("falls back for a count that exceeds the budget and keeps the other one", async () => {
    mocks.fetchBggCollectionCount.mockImplementation(never);
    mocks.fetchActiveMemberCount.mockResolvedValue(209);

    const result = fetchAboutStats();
    await vi.advanceTimersByTimeAsync(ABOUT_STATS_BUDGET_MS);

    await expect(result).resolves.toEqual({ gameCount: 0, memberCount: 209 });
    expect(console.warn).toHaveBeenCalledWith(`[about-stats] games exceeded ${ABOUT_STATS_BUDGET_MS} ms`);
  });

  it("falls back for both counts when neither arrives in time", async () => {
    mocks.fetchBggCollectionCount.mockImplementation(never);
    mocks.fetchActiveMemberCount.mockImplementation(never);

    const result = fetchAboutStats();
    await vi.advanceTimersByTimeAsync(ABOUT_STATS_BUDGET_MS);

    await expect(result).resolves.toEqual({ gameCount: 0, memberCount: null });
  });

  it("does not fall back before the budget is spent", async () => {
    let resolveGames: (n: number) => void = () => {};
    mocks.fetchBggCollectionCount.mockImplementation(() => new Promise<number>((r) => (resolveGames = r)));
    mocks.fetchActiveMemberCount.mockResolvedValue(209);

    const result = fetchAboutStats();
    await vi.advanceTimersByTimeAsync(ABOUT_STATS_BUDGET_MS - 1);
    resolveGames(312);

    await expect(result).resolves.toEqual({ gameCount: 312, memberCount: 209 });
  });
});
