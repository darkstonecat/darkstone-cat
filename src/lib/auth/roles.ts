/**
 * Role model of the app. Mirrors `public.role_rank()` in
 * supabase/migrations/20261005100100_roles_expand.sql exactly:
 * member 0, board 1, admin 1 (legacy alias of board), superadmin 2.
 * Unknown values have no rank, so every check on them is false.
 *
 * `admin`: M7 (supabase/migrations/20261007100000_roles_contract.sql) rewrites every `admin`
 * to `board`, removes it from the role CHECK and from `role_rank()`. This code ships BEFORE M7
 * is applied in production (runbook), so it must keep treating a stored `admin` as board for
 * that window. Remove `admin` from ROLES/RANKS (and its tests) after M7 is applied in prod.
 * The audit renderer keeps mapping old `actor_role = 'admin'` entries to board for good.
 *
 * Pure module: safe in client and server code. This only drives what the UI shows;
 * the server guard (`@/lib/admin/guard`) and the database enforce access (BR-16).
 */

export const ROLES = ["member", "admin", "board", "superadmin"] as const;

export type Role = (typeof ROLES)[number];

/** Minimum levels a check can ask for. `admin` is never a target, only a legacy holder. */
export type RoleLevel = "member" | "board" | "superadmin";

const RANKS: Record<Role, number> = {
  member: 0,
  board: 1,
  admin: 1, // remove after M7 is applied in prod
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

/** Board, legacy admin or superadmin: may open the admin panel. */
export function isBoardRole(role: unknown): boolean {
  return hasRoleAtLeast(role, "board");
}

export function isSuperadmin(role: unknown): boolean {
  return hasRoleAtLeast(role, "superadmin");
}

export type RoleLabelKey = "role_member" | "role_board" | "role_superadmin";

/**
 * Translation key of the role label (same key in the `profile` and `admin`
 * namespaces). The legacy `admin` role is shown as board ("Junta"), which is what
 * it becomes in M7; unknown values read as a plain member.
 */
export function roleLabelKey(role: unknown): RoleLabelKey {
  if (isSuperadmin(role)) return "role_superadmin";
  if (isBoardRole(role)) return "role_board";
  return "role_member";
}
