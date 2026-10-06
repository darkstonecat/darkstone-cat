/**
 * V-1 numbers: the row of `admin_stats()` and the derived values the dashboard shows.
 * Pure module (no `server-only`).
 */

/** One row of `admin_stats()` (all integers; periods are Madrid calendar months and years). */
export type AdminStatsRow = {
  active_members: number;
  former_members: number;
  joined_this_month: number;
  left_this_month: number;
  left_this_month_self: number;
  left_this_month_board: number;
  rejoined_this_year: number;
  newsletter_members: number;
  board_members: number;
  superadmins: number;
};

/** How many entries "Activitat recent" lists (spec V-1: the last 10). */
export const OVERVIEW_ACTIVITY_LIMIT = 10;

const FIELDS: readonly (keyof AdminStatsRow)[] = [
  "active_members",
  "former_members",
  "joined_this_month",
  "left_this_month",
  "left_this_month_self",
  "left_this_month_board",
  "rejoined_this_year",
  "newsletter_members",
  "board_members",
  "superadmins",
];

/** The first row of the RPC answer when every field is a non-negative integer, else null. */
export function parseAdminStats(data: unknown): AdminStatsRow | null {
  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (row === null || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const out = {} as AdminStatsRow;
  for (const field of FIELDS) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
    out[field] = value;
  }
  return out;
}

/** Whole-number share of the active members who take the newsletter (0 with no active member). */
export function newsletterPercent(stats: Pick<AdminStatsRow, "newsletter_members" | "active_members">): number {
  if (stats.active_members <= 0) return 0;
  return Math.round((stats.newsletter_members * 100) / stats.active_members);
}
