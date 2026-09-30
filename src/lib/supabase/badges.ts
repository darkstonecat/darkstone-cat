import { createClient } from "./server";
import { getCurrentUser } from "./auth";

export type StoredBadgeKey = "volunteer_egara_joga" | "ludoteca_donor";

export type MemberBadge =
  | { key: "member_year"; year: number; awardedAt: string }
  | { key: StoredBadgeKey; awardedAt: string };

type StoredBadgeRow = { badge_key: string; awarded_at: string };

const STORED_KEYS: readonly string[] = ["volunteer_egara_joga", "ludoteca_donor"];

/**
 * Pure derivation: the stored badges plus "Membre {year}", whose year comes from
 * `members.membership_start_date` (YYYY-MM-DD). Unknown stored keys are ignored.
 * The derived badge comes first, stored ones keep their award order.
 */
export function buildMemberBadges(
  membershipStartDate: string | null,
  stored: StoredBadgeRow[],
): MemberBadge[] {
  const badges: MemberBadge[] = [];

  const year = membershipStartDate ? Number(membershipStartDate.slice(0, 4)) : NaN;
  if (Number.isInteger(year) && year > 0) {
    badges.push({ key: "member_year", year, awardedAt: membershipStartDate as string });
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
    supabase.from("members").select("membership_start_date").eq("id", user.id).single(),
    supabase.from("member_badges").select("badge_key, awarded_at").eq("member_id", user.id),
  ]);

  return buildMemberBadges(member?.membership_start_date ?? null, rows ?? []);
}
