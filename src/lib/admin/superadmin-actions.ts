"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminDbErrorCode, type AdminActionError } from "@/lib/admin/action-errors";
import {
  authoriseOnMember,
  logAdminFailure,
  revalidateMemberPages,
  revalidateRolePages,
} from "@/lib/admin/action-context";

/*
 * Superadmin actions: grant or revoke a role (S-1, S-2) and anonymise a former member (S-3).
 * `getAdminAccess('superadmin')` first, input validation, then the T8 function with the user's
 * SESSION client. Never the service role for the role functions: without the user's JWT
 * `auth.uid()` is NULL and the role guard cannot apply BR-11 (nobody changes their own role).
 * The service role is used for one thing only: deleting the login account after S-3.
 */

type Fail = { error: AdminActionError };

export type AssignableRole = "member" | "board" | "superadmin";

export type RoleChange = {
  ok: true;
  action: "role.grant" | "role.revoke";
  role: AssignableRole;
  roleSince: string | null;
};

export type Anonymised = {
  ok: true;
  /** False when the login account could not be deleted: offer a retry of the same action. */
  accountDeleted: boolean;
  /** True on a retry: the record had been anonymised already. */
  alreadyAnonymised: boolean;
  /** Purge date (`YYYY-MM-DD`) from the first, successful call; null on a retry. */
  purgeOn: string | null;
};

const ASSIGNABLE_ROLES: readonly string[] = ["member", "board", "superadmin"];
/** 500 code points, as `admin_assert_reason_length` counts them. */
const MAX_REASON_LENGTH = 500;
/** Member numbers are short (`000-154`); anything longer cannot match. */
const MAX_CONFIRM_LENGTH = 32;

/** Optional reason: trimmed, null when blank; `invalid` / `reason_too_long` otherwise. */
function optionalReason(value: unknown): { value: string | null } | Fail {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: "invalid" };
  const text = value.trim();
  if ([...text].length > MAX_REASON_LENGTH) return { error: "reason_too_long" };
  return { value: text || null };
}

/** The single row of a RETURNS TABLE function (PostgREST answers an array). */
function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

// ---------------------------------------------------------------------------------------------
// S-1 / S-2 · Grant or revoke board / superadmin
// ---------------------------------------------------------------------------------------------

/**
 * Sets the member's role to `member`, `board` or `superadmin` (never the legacy `admin`). The
 * database decides grant or revoke by rank and enforces BR-10/11/12 (`last_superadmin`,
 * `self_role_change`, `former_member_role`); the same rank is `role_unchanged` (a stale screen:
 * refresh it). Optional reason, at most 500 characters (the dialogs ask for none).
 */
export async function setMemberRole(
  memberId: string,
  role: AssignableRole,
  reason?: string | null
): Promise<RoleChange | Fail> {
  const auth = await authoriseOnMember("superadmin", memberId);
  if ("error" in auth) return auth;

  if (typeof role !== "string" || !ASSIGNABLE_ROLES.includes(role)) return { error: "invalid_role" };
  const why = optionalReason(reason);
  if ("error" in why) return why;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_role", {
    p_member_id: auth.id,
    p_role: role,
    p_reason: why.value,
  });

  if (error) {
    logAdminFailure("set_member_role", error.code);
    return { error: adminDbErrorCode(error) };
  }

  revalidateMemberPages();
  revalidateRolePages();

  const row = firstRow(data);
  return {
    ok: true,
    action: row?.action === "role.revoke" ? "role.revoke" : "role.grant",
    role,
    roleSince: stringOrNull(row?.role_since),
  };
}

// ---------------------------------------------------------------------------------------------
// S-3 · Anonymise a former member
// ---------------------------------------------------------------------------------------------

/**
 * Deletes the login account with the Auth admin API. A missing account (404 / `user_not_found`)
 * counts as deleted. Logs only the error code.
 */
async function deleteLoginAccount(memberId: string): Promise<boolean> {
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(memberId);
    if (!error) return true;
    if (error.status === 404 || error.code === "user_not_found") return true;
    logAdminFailure("anonymise_delete_account", error.code ?? (error.status ? String(error.status) : null));
    return false;
  } catch {
    logAdminFailure("anonymise_delete_account", "exception");
    return false;
  }
}

/**
 * `confirmNumber` is the member number the superadmin typed (compared by the database after
 * trimming). Then `admin_anonymise_member` deletes the badges and leftovers and writes the
 * `member.anonymise` entry, and the login account is deleted.
 *
 * Retry semantics (idempotent): `admin:already_anonymised` is not an error here. The database
 * answers it only after the superadmin check, the former-member check and a matching
 * confirmation, so the action goes on to delete the login account again (a missing account
 * counts as deleted) and answers `{ ok: true, alreadyAnonymised: true }`. When the deletion
 * fails the answer is still `ok` (the record IS anonymised) with `accountDeleted: false`, and the
 * UI offers the same action again. `already_anonymised` is therefore never returned.
 */
export async function anonymiseMember(
  memberId: string,
  confirmNumber: string,
  reason?: string | null
): Promise<Anonymised | Fail> {
  const auth = await authoriseOnMember("superadmin", memberId);
  if ("error" in auth) return auth;

  if (typeof confirmNumber !== "string") return { error: "invalid" };
  const confirm = confirmNumber.trim();
  if (!confirm || confirm.length > MAX_CONFIRM_LENGTH) return { error: "confirm_mismatch" };
  const why = optionalReason(reason);
  if ("error" in why) return why;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_anonymise_member", {
    p_member_id: auth.id,
    p_confirm_number: confirm,
    p_reason: why.value,
  });

  let alreadyAnonymised = false;
  if (error) {
    const code = adminDbErrorCode(error);
    if (code !== "already_anonymised") {
      logAdminFailure("anonymise_member", error.code);
      return { error: code };
    }
    alreadyAnonymised = true;
  }

  revalidateMemberPages();

  const accountDeleted = await deleteLoginAccount(auth.id);
  return {
    ok: true,
    accountDeleted,
    alreadyAnonymised,
    purgeOn: alreadyAnonymised ? null : stringOrNull(firstRow(data)?.purge_on),
  };
}
