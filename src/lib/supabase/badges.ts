import { createClient } from "./server";
import { getCurrentUser } from "./auth";
import { madridToday } from "@/lib/admin/leave-dates";
import { tenureYears } from "@/lib/member-tenure";
import { CATALOGUE_COLUMNS, toCatalogue, type CatalogueBadge } from "@/lib/badges/catalogue";

export type TenureBadge = { key: "member_tenure"; years: number; since: string };
export type StoredBadge = { key: string; awardedAt: string };
export type MemberBadge = TenureBadge | StoredBadge;

type StoredBadgeRow = { badge_key: string; awarded_at: string };

/**
 * Pure derivation: the stored badges plus "X anys amb Darkstone", counted in full years from
 * `members.current_joined_on` (YYYY-MM-DD) up to `today`. It is earned on the first
 * anniversary and never stored (BR-6). Every stored key is kept: the catalogue decides what is
 * shown (`buildBadgeItems`). The derived badge comes first, stored ones keep their award order.
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
    if (row.badge_key !== "member_tenure") badges.push({ key: row.badge_key, awardedAt: row.awarded_at });
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

/**
 * The catalogue a signed-in member may see: RLS hides archived badges ("Desaparecen para
 * todos"). Empty on error, so the badges card degrades to the tenure badge alone.
 */
export async function getBadgeCatalogue(): Promise<CatalogueBadge[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("badges").select(CATALOGUE_COLUMNS).is("archived_at", null);
  if (error) {
    console.error("[badges] catalogue read failed code=%s", error.code ?? "unknown");
    return [];
  }
  return toCatalogue(data);
}
