import { ciphertextOwner, decrypt } from "@/lib/encryption";
import type { MaskedValue } from "./mask";

export type MaskedField = {
  value: MaskedValue | null;
  /** True when a stored value exists but could not be decrypted (wrong key, corrupt data). */
  unavailable: boolean;
};

/**
 * Decrypts on the server and returns only the masked form. A decrypt failure is
 * reported as `unavailable`, never as an empty field, and only the field name is logged.
 *
 * Pass `memberId`, the id of the row the value was read from. Without it, the value must
 * come straight from its own members row: the database refuses a v2 value that names
 * another row (members_ciphertext_guard), so the owner the value names is that row's id.
 */
export function maskEncryptedField(
  encrypted: string | null,
  mask: (value: string) => MaskedValue | null,
  field: string,
  memberId?: string
): MaskedField {
  if (!encrypted) return { value: null, unavailable: false };
  try {
    const owner = memberId ?? ciphertextOwner(encrypted) ?? "";
    return { value: mask(decrypt(encrypted, owner)), unavailable: false };
  } catch {
    console.error("[profile/details] decrypt failed", field);
    return { value: null, unavailable: true };
  }
}
