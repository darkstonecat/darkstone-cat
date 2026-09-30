import { formatCalendarDate } from "@/lib/format-date";
import type { MemberBadge } from "@/lib/supabase/badges";

export type BadgeKey = MemberBadge["key"];

export type BadgeItem = {
  key: BadgeKey;
  earned: boolean;
  /** Only for `member_year`: the year (title) and the start date, already formatted (description). */
  year: number | null;
  sinceLabel: string | null;
};

/** Every badge the association can grant, in display order. */
export const BADGE_ORDER: readonly BadgeKey[] = ["member_year", "volunteer_egara_joga", "ludoteca_donor"];

/**
 * Full catalogue with earned badges first-class and the rest shown locked, so members see what they can get.
 * Dates are formatted here, on the server, so the client never runs `Intl` on them.
 */
export function buildBadgeItems(badges: MemberBadge[], locale: string): BadgeItem[] {
  const earned = new Map(badges.map((b) => [b.key, b] as const));
  return BADGE_ORDER.map((key) => {
    const badge = earned.get(key);
    return {
      key,
      earned: Boolean(badge),
      year: badge?.key === "member_year" ? badge.year : null,
      sinceLabel: badge?.key === "member_year" ? formatCalendarDate(badge.awardedAt, locale) : null,
    };
  });
}
