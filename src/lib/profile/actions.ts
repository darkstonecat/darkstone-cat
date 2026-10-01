"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileData } from "@/lib/supabase/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import { normalizeUsername } from "@/lib/profile/username-pattern";
import { isValidDniNie, isValidPhone, isValidPostalCode } from "@/lib/validation/member-fields";

// ---------------------------------------------------------------------------
// updateMemberProfile
// ---------------------------------------------------------------------------

type ProfileUpdateData = {
  first_name: string;
  last_name: string;
  phone?: string;
  dni?: string;
  postal_code?: string;
  ludoya_username?: string;
  bgg_username?: string;
  newsletter_accepted: boolean;
};

/** Stable codes the form maps to translated messages; never a database message. */
export type ProfileUpdateError =
  | "unauthenticated"
  | "invalid"
  | "invalid_name"
  | "invalid_phone"
  | "invalid_dni"
  | "invalid_postal_code"
  | "invalid_username"
  | "failed";

const MAX_NAME_LENGTH = 100;

/** Optional text field: undefined/null/blank becomes "", anything that is not a string is rejected. */
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : null;
}

export async function updateMemberProfile(
  data: ProfileUpdateData
): Promise<{ error: ProfileUpdateError | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthenticated" };
  }

  // Server actions receive arbitrary client input: never assume the TypeScript shape.
  if (!data || typeof data !== "object" || typeof data.newsletter_accepted !== "boolean") {
    return { error: "invalid" };
  }

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

  const phone = optionalText(data.phone);
  if (phone === null || (phone && !isValidPhone(phone))) return { error: "invalid_phone" };

  const dni = optionalText(data.dni);
  if (dni === null || (dni && !isValidDniNie(dni))) return { error: "invalid_dni" };

  const postalCode = optionalText(data.postal_code);
  if (postalCode === null || (postalCode && !isValidPostalCode(postalCode))) {
    return { error: "invalid_postal_code" };
  }

  const ludoyaRaw = optionalText(data.ludoya_username);
  const bggRaw = optionalText(data.bgg_username);
  const ludoya = ludoyaRaw ? normalizeUsername(ludoyaRaw) : null;
  const bgg = bggRaw ? normalizeUsername(bggRaw) : null;
  if (ludoyaRaw === null || bggRaw === null || (ludoyaRaw && !ludoya) || (bggRaw && !bgg)) {
    return { error: "invalid_username" };
  }

  const updatePayload: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    postal_code: postalCode || null,
    ludoya_username: ludoya,
    bgg_username: bgg,
    newsletter_accepted: data.newsletter_accepted,
    phone_encrypted: phone ? encrypt(phone) : null,
    dni_nie_encrypted: dni ? encrypt(dni) : null,
  };

  const { error } = await supabase
    .from("members")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    // Postgres/PostgREST code only: the message can echo column values (personal data).
    console.error("[profile-update] members update failed code=%s", error.code ?? "unknown");
    return { error: "failed" };
  }

  // Sync name to auth.users.user_metadata so NavBar shows updated name
  await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  return { error: null };
}

// ---------------------------------------------------------------------------
// exportProfileData (GDPR data portability)
// ---------------------------------------------------------------------------

export async function exportProfileData(): Promise<{
  data: string | null;
  error: string | null;
}> {
  const profile = await getProfileData();
  if (!profile) {
    return { data: null, error: "Not authenticated" };
  }

  const { email, member } = profile;

  let phone: string | null = null;
  let dni: string | null = null;

  if (member.phone_encrypted) {
    try {
      phone = decrypt(member.phone_encrypted);
    } catch {
      phone = null;
    }
  }

  if (member.dni_nie_encrypted) {
    try {
      dni = decrypt(member.dni_nie_encrypted);
    } catch {
      dni = null;
    }
  }

  const supabase = await createClient();
  const { data: badgeRows } = await supabase
    .from("member_badges")
    .select("badge_key, awarded_at")
    .eq("member_id", member.id);

  const exportData = {
    email,
    first_name: member.first_name,
    last_name: member.last_name,
    member_number: member.member_number,
    phone,
    dni,
    postal_code: member.postal_code,
    ludoya_username: member.ludoya_username,
    bgg_username: member.bgg_username,
    role: member.role,
    newsletter_accepted: member.newsletter_accepted,
    membership_start_date: member.membership_start_date,
    created_at: member.created_at,
    badges: (badgeRows ?? []).map((b) => ({
      key: b.badge_key,
      awarded_at: b.awarded_at,
    })),
    exported_at: new Date().toISOString(),
  };

  return { data: JSON.stringify(exportData, null, 2), error: null };
}

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

export async function deleteAccount(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("[delete-account] auth.admin.deleteUser failed status=%s", error.status ?? "unknown");
    return { error: "failed" };
  }

  return { error: null };
}
