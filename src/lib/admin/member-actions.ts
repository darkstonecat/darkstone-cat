"use server";

import { createClient } from "@/lib/supabase/server";
import { adminDbErrorCode, type AdminActionError } from "@/lib/admin/action-errors";
import {
  authoriseBoardOnMember as authorise,
  logAdminFailure as logFailure,
  revalidateMemberPages,
} from "@/lib/admin/action-context";
import { decrypt, encrypt } from "@/lib/encryption";
import { normalizeUsername } from "@/lib/profile/username-pattern";
import { isValidDniNie, isValidPhone, isValidPostalCode } from "@/lib/validation/member-fields";

/*
 * Board actions on one member's file (spec A-4, A-5, A-8, A-9). Each one checks the role with
 * `getAdminAccess('board')`, validates its input, then calls the SECURITY DEFINER function with
 * the user's SESSION client: the function checks the role again, enforces the rules and writes
 * the audit entry with `auth.uid()` as the actor (never the service role, which has no actor).
 *
 * Errors are stable codes (`AdminActionError`); database messages are never returned, and only
 * the action name and the Postgres code are logged (BR-15: no DNI, phone or reason in logs).
 */

type Fail = { error: AdminActionError };

/** The A-4 fields. Optional keys are changed only when present; "" or null clears them. */
export type MemberUpdateInput = {
  first_name: string;
  last_name: string;
  postal_code?: string | null;
  ludoya_username?: string | null;
  bgg_username?: string | null;
  /** Send only when the admin edited the field: a new ciphertext always differs (random IV). */
  phone?: string | null;
  /** Send only when the admin edited the field. */
  dni?: string | null;
};

export type SensitiveField = "dni" | "phone";

const MAX_NAME_LENGTH = 100;
/** `admin_reason_max_length()` in the database. */
const MAX_REASON_LENGTH = 500;
const BADGE_KEY_RE = /^[a-z0-9_]{1,64}$/;

/** Optional text field: undefined/null/blank becomes "", anything that is not a string is rejected. */
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : null;
}

/** Present in the input (an undefined property counts as absent). */
function has(input: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(input, key) && input[key] !== undefined;
}

/** Optional reason/note: trimmed text, null when blank; `invalid` / `reason_too_long` otherwise. */
function optionalReason(value: unknown): { value: string | null } | Fail {
  const text = optionalText(value);
  if (text === null) return { error: "invalid" };
  if ([...text].length > MAX_REASON_LENGTH) return { error: "reason_too_long" };
  return { value: text || null };
}

// ---------------------------------------------------------------------------------------------
// A-4 · Edit a member's data
// ---------------------------------------------------------------------------------------------

/**
 * Same validation as the member's own profile edit (`updateMemberProfile`). DNI/phone are
 * encrypted for the TARGET member (`members_ciphertext_guard` refuses anything else). Returns
 * the audit field names that changed (empty for a no-op edit).
 */
export async function updateMember(
  memberId: string,
  input: MemberUpdateInput
): Promise<{ changed: string[] } | Fail> {
  const auth = await authorise(memberId);
  if ("error" in auth) return auth;

  // Server actions receive arbitrary client input: never assume the TypeScript shape.
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "invalid" };
  const data = input as Record<string, unknown>;

  const firstName = optionalText(data.first_name);
  const lastName = optionalText(data.last_name);
  if (
    !firstName ||
    !lastName ||
    firstName.length > MAX_NAME_LENGTH ||
    lastName.length > MAX_NAME_LENGTH
  ) {
    return { error: "invalid_name" };
  }

  const patch: Record<string, string | null> = { first_name: firstName, last_name: lastName };

  if (has(data, "postal_code")) {
    const postalCode = optionalText(data.postal_code);
    if (postalCode === null || (postalCode && !isValidPostalCode(postalCode))) {
      return { error: "invalid_postal_code" };
    }
    patch.postal_code = postalCode || null;
  }

  for (const key of ["ludoya_username", "bgg_username"] as const) {
    if (!has(data, key)) continue;
    const raw = optionalText(data[key]);
    const username = raw ? normalizeUsername(raw) : null;
    if (raw === null || (raw && !username)) return { error: "invalid_username" };
    patch[key] = username;
  }

  let phone: string | null | undefined;
  if (has(data, "phone")) {
    phone = optionalText(data.phone);
    if (phone === null || (phone && !isValidPhone(phone))) return { error: "invalid_phone" };
  }

  let dni: string | null | undefined;
  if (has(data, "dni")) {
    dni = optionalText(data.dni);
    if (dni === null || (dni && !isValidDniNie(dni))) return { error: "invalid_dni" };
  }

  try {
    if (phone !== undefined) patch.phone_encrypted = phone ? encrypt(phone, auth.id) : null;
    if (dni !== undefined) patch.dni_nie_encrypted = dni ? encrypt(dni, auth.id) : null;
  } catch {
    logFailure("update_member", "encrypt");
    return { error: "failed" };
  }

  const supabase = await createClient();
  const { data: changed, error } = await supabase.rpc("admin_update_member", {
    p_member_id: auth.id,
    p_patch: patch,
  });

  if (error) {
    logFailure("update_member", error.code);
    return { error: adminDbErrorCode(error) };
  }

  const fields = Array.isArray(changed) ? changed.filter((f): f is string => typeof f === "string") : [];
  if (fields.length > 0) revalidateMemberPages();
  return { changed: fields };
}

// ---------------------------------------------------------------------------------------------
// A-5 · Reveal DNI/phone
// ---------------------------------------------------------------------------------------------

/**
 * The database writes `member.reveal_sensitive` before it returns the ciphertext; the value is
 * decrypted here and goes only to the caller. A former member's DNI needs a superadmin and a
 * reason of at least 10 characters (D-E, enforced by the database: `reason_required`).
 * No revalidation: the value is shown on that screen only.
 */
export async function revealSensitive(
  memberId: string,
  field: SensitiveField,
  reason?: string | null
): Promise<{ value: string } | Fail> {
  const auth = await authorise(memberId);
  if ("error" in auth) return auth;

  if (field !== "dni" && field !== "phone") return { error: "invalid" };
  const why = optionalReason(reason);
  if ("error" in why) return why;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reveal_sensitive", {
    p_member_id: auth.id,
    p_field: field,
    p_reason: why.value,
  });

  if (error) {
    logFailure("reveal_sensitive", error.code);
    return { error: adminDbErrorCode(error) };
  }
  if (typeof data !== "string" || data === "") return { error: "no_value" };

  try {
    return { value: decrypt(data, auth.id) };
  } catch {
    logFailure("reveal_sensitive", "decrypt");
    return { error: "failed" };
  }
}

// ---------------------------------------------------------------------------------------------
// A-8 · Award or revoke a badge
// ---------------------------------------------------------------------------------------------

function badgeError(code: AdminActionError): AdminActionError {
  // The only invalid argument of the badge functions is a key outside the catalogue.
  return code === "invalid" ? "invalid_badge" : code;
}

export async function awardBadge(
  memberId: string,
  badgeKey: string,
  note?: string | null
): Promise<{ ok: true; awardedAt: string | null } | Fail> {
  const auth = await authorise(memberId);
  if ("error" in auth) return auth;

  if (typeof badgeKey !== "string" || !BADGE_KEY_RE.test(badgeKey)) return { error: "invalid_badge" };
  const why = optionalReason(note);
  if ("error" in why) return why;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_award_badge", {
    p_member_id: auth.id,
    p_badge_key: badgeKey,
    p_note: why.value,
  });

  if (error) {
    logFailure("award_badge", error.code);
    return { error: badgeError(adminDbErrorCode(error)) };
  }

  revalidateMemberPages();
  return { ok: true, awardedAt: typeof data === "string" ? data : null };
}

export async function revokeBadge(
  memberId: string,
  badgeKey: string,
  reason?: string | null
): Promise<{ ok: true } | Fail> {
  const auth = await authorise(memberId);
  if ("error" in auth) return auth;

  if (typeof badgeKey !== "string" || !BADGE_KEY_RE.test(badgeKey)) return { error: "invalid_badge" };
  const why = optionalReason(reason);
  if ("error" in why) return why;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_badge", {
    p_member_id: auth.id,
    p_badge_key: badgeKey,
    p_reason: why.value,
  });

  if (error) {
    logFailure("revoke_badge", error.code);
    return { error: badgeError(adminDbErrorCode(error)) };
  }

  revalidateMemberPages();
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// A-9 · Regenerate a card
// ---------------------------------------------------------------------------------------------

/** Issues a new card token (the old QR stops working at once). The token is never returned. */
export async function regenerateCard(memberId: string): Promise<{ ok: true } | Fail> {
  const auth = await authorise(memberId);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_card_token", { target_member_id: auth.id });

  if (error) {
    logFailure("regenerate_card", error.code);
    return { error: adminDbErrorCode(error) };
  }

  revalidateMemberPages();
  return { ok: true };
}
