import { getLocalizedUrl } from "@/lib/seo";

/** `members.card_token` format: 32 lowercase hex characters (see the card_token migration). */
export const CARD_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export function isValidCardToken(token: string): boolean {
  return CARD_TOKEN_PATTERN.test(token);
}

/**
 * URL encoded in the member card QR: `https://www.darkstone.cat/verify/<token>`.
 * Always the default-locale (unprefixed) URL so a printed or saved QR never depends on a locale.
 * Never put the sequential member number in it.
 */
export function buildCardVerifyUrl(token: string): string {
  return getLocalizedUrl("ca", `/verify/${token}`);
}
