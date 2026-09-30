/**
 * Masking for values that are stored encrypted. Runs on the server: the
 * decrypted value must never be serialised to the client, only what this
 * returns. The bullet count is fixed so the length is not revealed either.
 */

export type MaskedValue = {
  /** Text to display, e.g. "•••••123A". */
  masked: string;
  /** The visible tail, for an accessible label ("DNI ending in 123A"). Empty when nothing is shown. */
  tail: string;
};

const DNI_BULLETS = "•••••";
const PHONE_BULLETS = "••• •••";

/** DNI / NIE: shows the last 4 characters when the value is long enough to stay mostly hidden. */
export function maskDni(value: string | null | undefined): MaskedValue | null {
  const clean = (value ?? "").replace(/[\s-]/g, "");
  if (!clean) return null;
  const tail = clean.length >= 8 ? clean.slice(-4).toUpperCase() : "";
  return { masked: `${DNI_BULLETS}${tail}`, tail };
}

/** Phone: shows the last 3 digits when there are at least 7. */
export function maskPhone(value: string | null | undefined): MaskedValue | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const tail = digits.length >= 7 ? digits.slice(-3) : "";
  return { masked: tail ? `${PHONE_BULLETS} ${tail}` : PHONE_BULLETS, tail };
}
