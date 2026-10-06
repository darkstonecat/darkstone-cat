import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@/lib/auth/roles";

export type AdminMember = Member & { email: string };

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  member_number: string;
  phone_encrypted: string | null;
  dni_nie_encrypted: string | null;
  postal_code: string | null;
  ludoya_username: string | null;
  bgg_username: string | null;
  role: Role;
  card_token: string;
  newsletter_accepted: boolean;
  membership_start_date: string | null;
  created_at: string;
  /** Set while the person is a former member (spec §4.1). */
  left_on: string | null;
};

/**
 * A former member is a visitor (spec §4.4, BR-18). The leave bans the account and deletes its
 * sessions, but an access token issued before it stays valid until it expires (up to an hour),
 * so every member-area read treats a closed membership as no member at all.
 */
function activeMember(row: unknown): Member | null {
  if (!row || typeof row !== "object") return null;
  const member = row as Member;
  return member.left_on == null ? member : null;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentMember(): Promise<Member | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  return activeMember(data);
}

export async function getProfileData(): Promise<{
  email: string;
  /** `auth.users.email_confirmed_at` is set. */
  emailConfirmed: boolean;
  member: Member;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[getProfileData] getUser failed:", userError?.message ?? "no user");
    return null;
  }

  const { data, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  if (memberError || !data) {
    console.error("[getProfileData] members query failed:", memberError?.message ?? "no data", "userId:", user.id);
    return null;
  }

  const member = activeMember(data);
  if (!member) return null;

  return {
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    member,
  };
}
