import type { AdminBadgeRow } from "@/lib/admin/badges";
import type { LocalizedText } from "@/lib/badges/catalogue";

/** Languages of the badge texts, in the order of the language tabs. */
export const BADGE_LOCALES = ["ca", "es", "en"] as const;
export type BadgeLocale = (typeof BADGE_LOCALES)[number];

/** Action error codes with a text under `admin.badges.errors`; anything else reads as `failed`. */
const KNOWN_ERRORS = [
  "unauthenticated",
  "forbidden",
  "invalid",
  "not_found",
  "invalid_badge",
  "badge_exists",
  "badge_in_use",
  "badge_text_sensitive",
  "badge_archived",
  "badge_held",
  "badge_not_held",
  "not_active",
  "no_value",
  "reason_too_long",
  "failed",
] as const;

/** `admin.badges` key of the message for an action error code. */
export function badgeErrorKey(code: string): `errors.${(typeof KNOWN_ERRORS)[number]}` {
  return `errors.${(KNOWN_ERRORS as readonly string[]).includes(code) ? (code as (typeof KNOWN_ERRORS)[number]) : "failed"}`;
}

function hasText(text: Partial<LocalizedText> | null | undefined, locale: BadgeLocale): boolean {
  const value = text?.[locale];
  return typeof value === "string" && value.trim() !== "";
}

/** A language counts as present when the name and both texts exist in it. */
export function hasLanguage(
  texts: { name?: Partial<LocalizedText> | null; earned?: Partial<LocalizedText> | null; locked?: Partial<LocalizedText> | null },
  locale: BadgeLocale,
): boolean {
  return hasText(texts.name, locale) && hasText(texts.earned, locale) && hasText(texts.locked, locale);
}

/** Languages a catalogue row is fully written in ("ca · es · en" / "Només ca"). */
export function badgeLanguages(row: Pick<AdminBadgeRow, "name" | "earned_text" | "locked_text">): BadgeLocale[] {
  return BADGE_LOCALES.filter((locale) =>
    hasLanguage({ name: row.name, earned: row.earned_text, locked: row.locked_text }, locale),
  );
}

export const CARD = "flex flex-col gap-4 rounded-2xl bg-brand-white p-5 md:p-7";
export const META = "flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-stone-custom/65";
export const CHIP = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";
