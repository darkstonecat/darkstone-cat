import "server-only";
import { fetchBggCollectionCount } from "@/lib/bgg";
import { fetchActiveMemberCount } from "@/lib/supabase/member-count";

/**
 * Most of the time both counts come from the data cache in a few ms. On a cold cache
 * BGG can poll on 202 for over 30 s, and a slow Supabase has no timeout of its own, so
 * each count gets this budget. A count that misses it shows the section's default text
 * (`stat_members_value`, `stat_games_fallback`); the lookup keeps running and warms the
 * cache for the next visit.
 */
export const ABOUT_STATS_BUDGET_MS = 3_000;

export type AboutStatsData = { gameCount: number; memberCount: number | null };

async function within<T>(lookup: Promise<T>, fallback: T, label: string, budgetMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[about-stats] ${label} exceeded ${budgetMs} ms`);
      resolve(fallback);
    }, budgetMs);
  });
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** The /about stats, each count capped at `budgetMs`. Never throws (both fetchers already catch). */
export async function fetchAboutStats(budgetMs = ABOUT_STATS_BUDGET_MS): Promise<AboutStatsData> {
  const [gameCount, memberCount] = await Promise.all([
    within(fetchBggCollectionCount(), 0, "games", budgetMs),
    within(fetchActiveMemberCount(), null, "members", budgetMs),
  ]);
  return { gameCount, memberCount };
}
