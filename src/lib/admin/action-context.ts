import "server-only";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin/guard";
import { isMemberId, type AdminActionError } from "@/lib/admin/action-errors";

/*
 * Shared steps of the board actions on one member (`member-actions.ts`,
 * `membership-actions.ts`). Not a "use server" module: nothing here is callable from the browser.
 */

/** Role check first (`getAdminAccess('board')`), then the member id. Returns the canonical (lower-case) id. */
export async function authoriseBoardOnMember(
  memberId: unknown
): Promise<{ id: string } | { error: AdminActionError }> {
  const access = await getAdminAccess("board");
  if (access.status !== "ok") return { error: access.status };
  if (!isMemberId(memberId)) return { error: "invalid" };
  return { id: memberId.toLowerCase() };
}

/** Only the action name and the Postgres (or local) code: never a DB message, value, name or reason. */
export function logAdminFailure(action: string, code: string | null | undefined): void {
  console.error("[admin-member] %s failed code=%s", action, code || "unknown");
}

export function revalidateMemberPages(): void {
  revalidatePath("/[locale]/admin/members", "page");
  revalidatePath("/[locale]/admin/members/[number]", "page");
}
