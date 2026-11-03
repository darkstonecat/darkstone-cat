import { formatCalendarDate } from "@/lib/format-date";
import type { MemberBadge } from "@/lib/supabase/badges";

export type BadgeKey = MemberBadge["key"];

export type BadgeItem = {
  key: BadgeKey;
  earned: boolean;
  /** Only for an earned `member_tenure`: full years (title) and the current sign-up date, already formatted (description). */
  years: number | null;
  sinceLabel: string | null;
};

/** Every badge the association can grant, in display order. */
export const BADGE_ORDER: readonly BadgeKey[] = ["member_tenure", "volunteer_egara_joga", "ludoteca_donor"];

/**
 * Full catalogue with earned badges first-class and the rest shown locked, so members see what they can get.
 * Dates are formatted here, on the server, so the client never runs `Intl` on them.
 */
export function buildBadgeItems(badges: MemberBadge[], locale: string): BadgeItem[] {
  const earned = new Map(badges.map((b) => [b.key, b] as const));
  return BADGE_ORDER.map((key) => {
    const badge = earned.get(key);
    const tenure = badge?.key === "member_tenure" ? badge : null;
    return {
      key,
      earned: Boolean(badge),
      years: tenure ? tenure.years : null,
      sinceLabel: tenure ? formatCalendarDate(tenure.since, locale) : null,
    };
  });
}
