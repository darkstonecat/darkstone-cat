import { createClient } from "./server";
import { getCurrentUser } from "./auth";
import { madridToday } from "@/lib/admin/leave-dates";
import { tenureYears } from "@/lib/member-tenure";

export type StoredBadgeKey = "volunteer_egara_joga" | "ludoteca_donor";

export type MemberBadge =
  | { key: "member_tenure"; years: number; since: string }
  | { key: StoredBadgeKey; awardedAt: string };

type StoredBadgeRow = { badge_key: string; awarded_at: string };

const STORED_KEYS: readonly string[] = ["volunteer_egara_joga", "ludoteca_donor"];

/**
 * Pure derivation: the stored badges plus "X anys amb Darkstone", counted in full years from
 * `members.current_joined_on` (YYYY-MM-DD) up to `today`. It is earned on the first
 * anniversary and never stored (BR-6). Unknown stored keys are ignored.
 * The derived badge comes first, stored ones keep their award order.
 */
export function buildMemberBadges(
  currentJoinedOn: string | null,
  stored: StoredBadgeRow[],
  today: string,
): MemberBadge[] {
  const badges: MemberBadge[] = [];

  const years = tenureYears(currentJoinedOn, today);
  if (years !== null && years >= 1) {
    badges.push({ key: "member_tenure", years, since: currentJoinedOn as string });
  }

  const sorted = [...stored].sort((a, b) => a.awarded_at.localeCompare(b.awarded_at));
  for (const row of sorted) {
    if (STORED_KEYS.includes(row.badge_key)) {
      badges.push({ key: row.badge_key as StoredBadgeKey, awardedAt: row.awarded_at });
    }
  }

  return badges;
}

/** Badges of the current member (stored + derived). Empty when not logged in. */
export async function getMemberBadges(): Promise<MemberBadge[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const [{ data: member }, { data: rows }] = await Promise.all([
    supabase.from("members").select("current_joined_on").eq("id", user.id).single(),
    supabase.from("member_badges").select("badge_key, awarded_at").eq("member_id", user.id),
  ]);

  return buildMemberBadges(member?.current_joined_on ?? null, rows ?? [], madridToday());
}
