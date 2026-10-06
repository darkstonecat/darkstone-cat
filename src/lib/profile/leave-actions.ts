"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signOutCurrentSession } from "@/lib/supabase/session-actions";
import { adminDbErrorCode } from "@/lib/admin/action-errors";

/*
 * M-1 · A member leaves the association ("Dona't de baixa"). `member_leave_self` closes the
 * caller's own membership, bans the login account and ends its server-side sessions in one
 * transaction (T6); this action then clears this browser's auth cookies. The spec defines no
 * e-mail for a self leave, so none is sent. The UI (T26) shows the notice and redirects home.
 */

export type LeaveAssociationError =
  | "unauthenticated"
  | "invalid"
  | "role_held"
  | "not_active"
  | "reason_too_long"
  | "failed";

/** `member_leave_self` counts 500 code points. */
const MAX_REASON_LENGTH = 500;

export async function leaveAssociation(
  reason?: string | null
): Promise<{ ok: true } | { error: LeaveAssociationError }> {
  // Authorise first: an anonymous caller gets `unauthenticated` whatever it sends.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  let why: string | null = null;
  if (reason !== undefined && reason !== null) {
    if (typeof reason !== "string") return { error: "invalid" };
    const trimmed = reason.trim();
    if ([...trimmed].length > MAX_REASON_LENGTH) return { error: "reason_too_long" };
    why = trimmed || null;
  }

  const { error } = await supabase.rpc("member_leave_self", { p_reason: why });
  if (error) {
    // Only the Postgres code: never the message (it can echo input) or the reason.
    console.error("[member-leave] failed code=%s", error.code || "unknown");
    const code = adminDbErrorCode(error);
    if (code === "forbidden") return { error: "unauthenticated" };
    if (code === "role_held" || code === "not_active" || code === "reason_too_long") return { error: code };
    return { error: "failed" };
  }

  // The leave already deleted every session of this user; this clears the cookies of this
  // browser. A failure here changes nothing for the member (the client wipes them as well).
  await signOutCurrentSession();

  revalidatePath("/[locale]/admin/members", "page");
  revalidatePath("/[locale]/admin/members/[number]", "page");
  return { ok: true };
}
