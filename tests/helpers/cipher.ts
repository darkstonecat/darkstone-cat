import { randomBytes } from 'node:crypto'

/**
 * A value with the shape of src/lib/encryption.ts output, bound to `memberId`
 * (v2:<member id>:<iv>:<tag>:<data>, base64, 12-byte IV, 16-byte tag). The database only
 * accepts DNI/phone ciphertext of this shape naming the row's own id
 * (members_ciphertext_guard). Random bytes: never decrypted.
 */
export function fakeMemberCipher(memberId: string, dataBytes = 10): string {
  const [iv, tag, data] = [randomBytes(12), randomBytes(16), randomBytes(dataBytes)].map((b) =>
    b.toString('base64')
  )
  return `v2:${memberId}:${iv}:${tag}:${data}`
}
