import "server-only";

import { revalidatePath } from "next/cache";
import { getAdminAccess, type AdminLevel } from "@/lib/admin/guard";
import { isMemberId, type AdminActionError } from "@/lib/admin/action-errors";

/*
 * Shared steps of the admin actions on one member (`member-actions.ts`, `membership-actions.ts`,
 * `access-actions.ts`, `superadmin-actions.ts`). Not a "use server" module: nothing here is
 * callable from the browser.
 */

/** Role check first (`getAdminAccess(min)`), then the member id. Returns the canonical (lower-case) id. */
export async function authoriseOnMember(
  min: AdminLevel,
  memberId: unknown
): Promise<{ id: string } | { error: AdminActionError }> {
  const access = await getAdminAccess(min);
  if (access.status !== "ok") return { error: access.status };
  if (!isMemberId(memberId)) return { error: "invalid" };
  return { id: memberId.toLowerCase() };
}

/** `authoriseOnMember('board', …)`: the level of every A-* action. */
export function authoriseBoardOnMember(memberId: unknown): Promise<{ id: string } | { error: AdminActionError }> {
  return authoriseOnMember("board", memberId);
}

/** Only the action name and the Postgres (or local) code: never a DB message, value, name or reason. */
export function logAdminFailure(action: string, code: string | null | undefined): void {
  console.error("[admin-member] %s failed code=%s", action, code || "unknown");
}

export function revalidateMemberPages(): void {
  revalidatePath("/[locale]/admin/members", "page");
  revalidatePath("/[locale]/admin/members/[number]", "page");
}

/** The roles screen (V-5), after a grant or revoke. */
export function revalidateRolePages(): void {
  revalidatePath("/[locale]/admin/roles", "page");
}
