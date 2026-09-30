import type { MemberBadge } from "@/lib/supabase/badges";

export type BadgeKey = MemberBadge["key"];

export type BadgeItem = {
  key: BadgeKey;
  earned: boolean;
  /** Only for `member_year`: the year (title) and the start date (description). */
  year: number | null;
  since: string | null;
};

/** Every badge the association can grant, in display order. */
export const BADGE_ORDER: readonly BadgeKey[] = ["member_year", "volunteer_egara_joga", "ludoteca_donor"];

/** Full catalogue with earned badges first-class and the rest shown locked, so members see what they can get. */
export function buildBadgeItems(badges: MemberBadge[]): BadgeItem[] {
  const earned = new Map(badges.map((b) => [b.key, b] as const));
  return BADGE_ORDER.map((key) => {
    const badge = earned.get(key);
    return {
      key,
      earned: Boolean(badge),
      year: badge?.key === "member_year" ? badge.year : null,
      since: badge?.key === "member_year" ? badge.awardedAt : null,
    };
  });
}
