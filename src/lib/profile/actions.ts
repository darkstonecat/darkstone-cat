"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileData } from "@/lib/supabase/auth";
import { encrypt, decrypt } from "@/lib/encryption";

// ---------------------------------------------------------------------------
// DNI/NIE validation (Spanish format)
// ---------------------------------------------------------------------------

const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i;

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

export async function updateMemberProfile(
  data: ProfileUpdateData
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!data.first_name.trim() || !data.last_name.trim()) {
    return { error: "First name and last name are required." };
  }

  if (data.dni?.trim() && !DNI_NIE_REGEX.test(data.dni.trim())) {
    return { error: "Invalid DNI/NIE format." };
  }

  const updatePayload: Record<string, unknown> = {
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    postal_code: data.postal_code?.trim() || null,
    ludoya_username: data.ludoya_username?.trim() || null,
    bgg_username: data.bgg_username?.trim() || null,
    newsletter_accepted: data.newsletter_accepted,
  };

  if (data.phone?.trim()) {
    updatePayload.phone_encrypted = encrypt(data.phone.trim());
  } else {
    updatePayload.phone_encrypted = null;
  }

  if (data.dni?.trim()) {
    updatePayload.dni_nie_encrypted = encrypt(data.dni.trim());
  } else {
    updatePayload.dni_nie_encrypted = null;
  }

  const { error } = await supabase
    .from("members")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Sync name to auth.users.user_metadata so NavBar shows updated name
  await supabase.auth.updateUser({
    data: {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
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
    return { error: error.message };
  }

  return { error: null };
}
