import { decrypt } from "@/lib/encryption";
import type { MaskedValue } from "./mask";

export type MaskedField = {
  value: MaskedValue | null;
  /** True when a stored value exists but could not be decrypted (wrong key, corrupt data). */
  unavailable: boolean;
};

/**
 * Decrypts on the server and returns only the masked form. A decrypt failure is
 * reported as `unavailable`, never as an empty field, and only the field name is logged.
 */
export function maskEncryptedField(
  encrypted: string | null,
  mask: (value: string) => MaskedValue | null,
  field: string
): MaskedField {
  if (!encrypted) return { value: null, unavailable: false };
  try {
    return { value: mask(decrypt(encrypted)), unavailable: false };
  } catch {
    console.error("[profile/details] decrypt failed", field);
    return { value: null, unavailable: true };
  }
}
