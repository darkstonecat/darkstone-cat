"use server";

import { headers } from "next/headers";
import { createAdminClient } from "./admin";
import { getClientIp } from "@/lib/client-ip";
import { allowRequestShared } from "@/lib/rate-limit";
import { encrypt } from "@/lib/encryption";
import { normalizeUsername } from "@/lib/profile/username-pattern";
import { isValidDniNie, isValidPhone, isValidPostalCode } from "@/lib/validation/member-fields";

type SignupData = {
  userId: string;
  phone?: string;
  dni?: string;
  postal_code?: string;
  ludoya_username?: string;
  bgg_username?: string;
  newsletter_accepted: boolean;
};

const COMPLETE_WINDOW_MS = 10 * 60 * 1000;
const DISCARD_WINDOW_MS = 30 * 60 * 1000;
const GENERIC_ERROR = "Could not save member data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const PREPARE_IP_LIMIT = 10;
const PREPARE_WINDOW_MS = 10 * 60 * 1000;

/**
 * The browser shows the same screen whether or not the details were saved (so it
 * cannot reveal an existing account), which makes this log the only trace. The
 * reason is a fixed code: never log ids, emails or caught errors.
 */
function refuse(reason: string): { error: string } {
  console.warn("[signup] member details not saved reason=%s", reason);
  return { error: GENERIC_ERROR };
}

/**
 * A sign-up is "fresh" when the auth user exists, never confirmed its email and
 * was created within `windowMs`. The action runs with the admin client and the
 * caller has no session yet, so this is the only proof the id belongs to a
 * sign-up in progress.
 */
async function isFreshUnconfirmedUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  windowMs: number
): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return false;
  if (user.email_confirmed_at) return false;
  const created = Date.parse(user.created_at);
  return Number.isFinite(created) && Date.now() - created <= windowMs;
}

export async function updateMemberAfterSignup(
  data: SignupData
): Promise<{ error: string | null }> {
  try {
    if (!data || typeof data.userId !== "string" || !data.userId) {
      return { error: "Missing user ID" };
    }

    const phone = data.phone?.trim();
    const dni = data.dni?.trim();
    const postalCode = data.postal_code?.trim();
    const ludoya = data.ludoya_username?.trim();
    const bgg = data.bgg_username?.trim();

    if (phone && !isValidPhone(phone)) return { error: "Invalid phone" };
    if (dni && !isValidDniNie(dni)) return { error: "Invalid DNI/NIE" };
    if (postalCode && !isValidPostalCode(postalCode)) return { error: "Invalid postal code" };
    const ludoyaClean = ludoya ? normalizeUsername(ludoya) : null;
    const bggClean = bgg ? normalizeUsername(bgg) : null;
    if (ludoya && !ludoyaClean) return { error: "Invalid Ludoya username" };
    if (bgg && !bggClean) return { error: "Invalid BGG username" };

    const supabase = createAdminClient();

    if (!(await isFreshUnconfirmedUser(supabase, data.userId, COMPLETE_WINDOW_MS))) {
      return refuse("not_fresh_unconfirmed_user");
    }

    // Only a blank row may be completed: this action never overwrites saved data.
    const { data: row, error: rowError } = await supabase
      .from("members")
      .select("dni_nie_encrypted, phone_encrypted, postal_code, ludoya_username, bgg_username")
      .eq("id", data.userId)
      .maybeSingle();
    if (rowError || !row) return refuse("member_row_unavailable");
    if (Object.values(row).some((v) => v !== null && v !== "")) {
      return refuse("member_row_not_blank");
    }

    const updatePayload: Record<string, unknown> = {
      newsletter_accepted: data.newsletter_accepted === true,
    };
    if (phone) updatePayload.phone_encrypted = encrypt(phone);
    if (dni) updatePayload.dni_nie_encrypted = encrypt(dni);
    if (postalCode) updatePayload.postal_code = postalCode;
    if (ludoyaClean) updatePayload.ludoya_username = ludoyaClean;
    if (bggClean) updatePayload.bgg_username = bggClean;

    const { error } = await supabase.from("members").update(updatePayload).eq("id", data.userId);
    if (error) return refuse("update_failed");
    return { error: null };
  } catch {
    return refuse("unexpected_error");
  }
}

/**
 * Deletes a sign-up the person abandoned ("wrong email, go back") so its
 * personal data does not linger. Only an unconfirmed user created within the
 * last 30 minutes qualifies; its members row cascades. Never throws.
 */
export async function discardUnconfirmedSignup(userId: string): Promise<{ discarded: boolean }> {
  try {
    if (typeof userId !== "string" || !userId) return { discarded: false };
    const supabase = createAdminClient();
    if (!(await isFreshUnconfirmedUser(supabase, userId, DISCARD_WINDOW_MS))) {
      return { discarded: false };
    }
    // The members row (and its badges) goes with the auth user: members.id is ON DELETE CASCADE.
    const { error } = await supabase.auth.admin.deleteUser(userId);
    return { discarded: !error };
  } catch {
    return { discarded: false };
  }
}

/**
 * Runs right BEFORE the browser calls `signUp`: the last sign-up wins for an
 * unconfirmed account.
 *
 * GoTrue keeps an existing unconfirmed user, and its password, when the same email
 * signs up again. Someone who pre-registered a victim's email with their own
 * password would otherwise own the account once the victim confirms it. Here the
 * stale unconfirmed user (and its members row, which cascades) is deleted so the
 * next `signUp` creates a fresh one with the new password. A confirmed user is never
 * touched: the lookup only returns unconfirmed ones.
 *
 * Throttled per client IP only. A per-address limit would let an attacker burn the
 * victim's bucket first and keep the pre-registered account alive; the IP limit still
 * caps how many pending sign-ups one client can cancel.
 *
 * The answer is always `{ ok: true }` (unknown, unconfirmed, confirmed, throttled,
 * failed), so it cannot be used to find out who is a member, and it never blocks the
 * sign-up: a failure is logged without the address and the sign-up proceeds.
 */
export async function prepareSignup(email: string): Promise<{ ok: true }> {
  try {
    if (typeof email !== "string") return { ok: true };
    const clean = email.trim().toLowerCase();
    if (!clean || clean.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(clean)) return { ok: true };

    const ip = getClientIp(await headers());
    if (!(await allowRequestShared("signup-prepare-ip", ip, PREPARE_IP_LIMIT, PREPARE_WINDOW_MS))) {
      return { ok: true };
    }

    const supabase = createAdminClient();
    const { data: staleId, error: lookupError } = await supabase.rpc("unconfirmed_user_id", {
      p_email: clean,
    });
    if (lookupError) {
      console.error("[signup] prepare lookup failed code=%s", lookupError.code ?? "unknown");
      return { ok: true };
    }
    if (typeof staleId !== "string" || !staleId) return { ok: true };

    // The members row (and its badges) goes with the auth user: members.id is ON DELETE CASCADE.
    const { error } = await supabase.auth.admin.deleteUser(staleId);
    if (error) console.error("[signup] prepare delete failed status=%s", error.status ?? "unknown");
  } catch {
    console.error("[signup] prepare unexpected error");
  }
  return { ok: true };
}
