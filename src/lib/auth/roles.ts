/**
 * Role model of the app. Mirrors `public.role_rank()` after M7
 * (supabase/migrations/20261007100000_roles_contract.sql) exactly:
 * member 0, board 1, superadmin 2.
 * Unknown values have no rank, so every check on them is false. That includes the retired
 * `admin` role: M7 rewrote it to `board` and the role CHECK no longer accepts it. Only the
 * audit renderer still maps old `actor_role = 'admin'` entries to board.
 *
 * Pure module: safe in client and server code. This only drives what the UI shows;
 * the server guard (`@/lib/admin/guard`) and the database enforce access (BR-16).
 */

export const ROLES = ["member", "board", "superadmin"] as const;

export type Role = (typeof ROLES)[number];

/** Minimum levels a check can ask for. */
export type RoleLevel = Role;

const RANKS: Record<Role, number> = {
  member: 0,
  board: 1,
  superadmin: 2,
};

/** The value as a `Role`, or null when it is not one of the known roles. */
export function toRole(value: unknown): Role | null {
  return typeof value === "string" && Object.hasOwn(RANKS, value) ? (value as Role) : null;
}

/** Rank of a role, or null for anything unknown. */
export function roleRank(role: unknown): number | null {
  const known = toRole(role);
  return known === null ? null : RANKS[known];
}

/** True when `role` ranks at least as high as `min`. Unknown roles never pass. */
export function hasRoleAtLeast(role: unknown, min: RoleLevel): boolean {
  const rank = roleRank(role);
  return rank !== null && rank >= RANKS[min];
}

/** Board or superadmin: may open the admin panel. */
export function isBoardRole(role: unknown): boolean {
  return hasRoleAtLeast(role, "board");
}

export function isSuperadmin(role: unknown): boolean {
  return hasRoleAtLeast(role, "superadmin");
}

export type RoleLabelKey = "role_member" | "role_board" | "role_superadmin";

/**
 * Translation key of the role label (same key in the `profile` and `admin`
 * namespaces). Unknown values read as a plain member.
 */
export function roleLabelKey(role: unknown): RoleLabelKey {
  if (isSuperadmin(role)) return "role_superadmin";
  if (isBoardRole(role)) return "role_board";
  return "role_member";
}
