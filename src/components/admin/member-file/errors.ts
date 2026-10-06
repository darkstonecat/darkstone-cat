/** Action error codes that have a text under `admin.member_file.errors`; anything else reads as `failed`. */
const KNOWN_ERROR_KEYS = [
  "unauthenticated",
  "forbidden",
  "invalid",
  "not_found",
  "not_active",
  "not_former",
  "reason_required",
  "reason_too_long",
  "no_value",
  "self_target",
  "role_held",
  "invalid_date",
  "register_closed",
  "no_login",
  "invalid_channel",
  "note_too_long",
  "badge_held",
  "badge_not_held",
  "invalid_badge",
  "send_failed",
  "invalid_role",
  "role_unchanged",
  "self_role_change",
  "last_superadmin",
  "former_member_role",
  "confirm_mismatch",
  "failed",
] as const;

export function errorKey(code: string): (typeof KNOWN_ERROR_KEYS)[number] {
  return (KNOWN_ERROR_KEYS as readonly string[]).includes(code) ? (code as (typeof KNOWN_ERROR_KEYS)[number]) : "failed";
}

/** Plain textarea of the dialogs whose reason is optional (the `reason` slot is always required). */
export const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border border-stone-custom/20 bg-brand-white px-3.5 py-3 text-base text-stone-custom outline-none focus-visible:outline-2 focus-visible:outline-brand-orange disabled:opacity-50";

export const INPUT_CLASS =
  "w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/50 outline-none transition-colors focus:border-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2 disabled:opacity-50";
