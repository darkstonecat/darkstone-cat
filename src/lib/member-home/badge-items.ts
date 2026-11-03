import { formatCalendarDate } from "@/lib/format-date";
import { localize, type BadgeIconKey, type CatalogueBadge } from "@/lib/badges/catalogue";
import type { MemberBadge, StoredBadge, TenureBadge } from "@/lib/supabase/badges";

/** "X anys amb Darkstone": its texts are translated on the client (plural rules). */
export type TenureBadgeItem = {
  kind: "tenure";
  key: "member_tenure";
  icon: "star";
  earned: boolean;
  /** Only when earned: full years (title) and the current sign-up date, already formatted (description). */
  years: number | null;
  sinceLabel: string | null;
};

/** A catalogue badge: its texts come resolved from the server, in the page locale. */
export type CatalogueBadgeItem = {
  kind: "catalogue";
  key: string;
  icon: BadgeIconKey;
  earned: boolean;
  title: string;
  description: string;
};

export type BadgeItem = TenureBadgeItem | CatalogueBadgeItem;

function isTenure(badge: MemberBadge): badge is TenureBadge {
  return "years" in badge;
}

/**
 * Tenure first, then the catalogue in its order: earned badges first-class and the rest shown
 * locked, so members see what they can get. A badge with `showLocked` off appears only once
 * earned. Stored badges missing from the catalogue (archived or unknown) are not shown.
 * Dates and texts are resolved here, on the server, so the client never runs `Intl` on them.
 */
export function buildBadgeItems(badges: MemberBadge[], catalogue: CatalogueBadge[], locale: string): BadgeItem[] {
  const tenure = badges.find(isTenure) ?? null;
  const stored = new Map(
    badges.filter((badge): badge is StoredBadge => !isTenure(badge)).map((badge) => [badge.key, badge] as const)
  );

  const items: BadgeItem[] = [
    {
      kind: "tenure",
      key: "member_tenure",
      icon: "star",
      earned: tenure !== null,
      years: tenure ? tenure.years : null,
      sinceLabel: tenure ? formatCalendarDate(tenure.since, locale) : null,
    },
  ];

  for (const badge of catalogue) {
    const earned = stored.has(badge.key);
    if (!earned && !badge.showLocked) continue;
    items.push({
      kind: "catalogue",
      key: badge.key,
      icon: badge.icon,
      earned,
      title: localize(badge.name, locale),
      description: localize(earned ? badge.earnedText : badge.lockedText, locale),
    });
  }

  return items;
}
