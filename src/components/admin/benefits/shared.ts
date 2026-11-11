import type { LocalizedText } from "@/lib/badges/catalogue";

/** Languages of the benefit texts, in the order of the language tabs. */
export const BENEFIT_LOCALES = ["ca", "es", "en"] as const;
export type BenefitLocale = (typeof BENEFIT_LOCALES)[number];

/** Action error codes with a text under `admin.benefits.errors`; anything else reads as `failed`. */
const KNOWN_ERRORS = [
  "unauthenticated",
  "forbidden",
  "invalid",
  "not_found",
  "no_value",
  "benefit_archived",
  "benefit_text_sensitive",
  "failed",
] as const;

/** `admin.benefits` key of the message for an action error code. */
export function benefitErrorKey(code: string): `errors.${(typeof KNOWN_ERRORS)[number]}` {
  return `errors.${(KNOWN_ERRORS as readonly string[]).includes(code) ? (code as (typeof KNOWN_ERRORS)[number]) : "failed"}`;
}

/** A language counts as present when both the name and the description exist in it. */
export function benefitHasLanguage(
  texts: { name?: Partial<LocalizedText> | null; description?: Partial<LocalizedText> | null },
  locale: BenefitLocale,
): boolean {
  const has = (text: Partial<LocalizedText> | null | undefined) => {
    const value = text?.[locale];
    return typeof value === "string" && value.trim() !== "";
  };
  return has(texts.name) && has(texts.description);
}

export const CARD = "flex flex-col gap-4 rounded-2xl bg-brand-white p-5 md:p-7";
export const META = "flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-stone-custom/65";
export const CHIP = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";
