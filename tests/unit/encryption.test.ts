import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCipheriv, randomBytes } from 'crypto'

const KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const OWNER = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-8888-4777-8666-555555555555'

/** What src/lib/encryption.ts wrote before v2: iv:tag:data, no AAD. */
function legacyEncrypt(plainText: string, keyHex = KEY_HEX): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv, { authTagLength: 16 })
  const data = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

describe('encryption', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ENCRYPTION_KEY = KEY_HEX
  })

  describe('v2 (bound to the member)', () => {
    it('round trips for the same member', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      expect(decrypt(encrypt('Hello Darkstone!', OWNER), OWNER)).toBe('Hello Darkstone!')
    })

    it('writes v2:<member id>:<iv>:<tag>:<data> with a 12-byte IV and a 16-byte tag', async () => {
      const { encrypt } = await import('@/lib/encryption')
      const parts = encrypt('test', OWNER).split(':')
      expect(parts).toHaveLength(5)
      expect(parts[0]).toBe('v2')
      expect(parts[1]).toBe(OWNER)
      expect(Buffer.from(parts[2], 'base64')).toHaveLength(12)
      expect(Buffer.from(parts[3], 'base64')).toHaveLength(16)
      expect(Buffer.from(parts[4], 'base64').length).toBeGreaterThan(0)
    })

    it('normalises an uppercase member id', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const value = encrypt('x', OWNER.toUpperCase())
      expect(value.split(':')[1]).toBe(OWNER)
      expect(decrypt(value, OWNER.toUpperCase())).toBe('x')
    })

    it('fits the 512-character column limit for the longest DNI and phone', async () => {
      const { encrypt } = await import('@/lib/encryption')
      expect(encrypt('+34 612 345 678 901 234', OWNER).length).toBeLessThan(512)
      expect(encrypt('X1234567L', OWNER).length).toBeLessThan(512)
    })

    it('produces different ciphertexts for the same input (unique IVs)', async () => {
      const { encrypt } = await import('@/lib/encryption')
      expect(encrypt('same', OWNER)).not.toBe(encrypt('same', OWNER))
    })

    it('handles unicode (accents, emojis)', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const text = 'Associació Darkstone Catalunya 🎲 àèéíòóúü'
      expect(decrypt(encrypt(text, OWNER), OWNER)).toBe(text)
    })

    it("refuses another member's ciphertext copied into the caller's row", async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const victims = encrypt('12345678Z', OTHER)
      expect(() => decrypt(victims, OWNER)).toThrow('Invalid ciphertext')
    })

    it('refuses a ciphertext whose embedded owner was rewritten (AAD mismatch)', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const parts = encrypt('12345678Z', OTHER).split(':')
      parts[1] = OWNER
      expect(() => decrypt(parts.join(':'), OWNER)).toThrow()
    })

    it('refuses a v2 value stripped down to the legacy shape (no downgrade)', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const [, , iv, tag, data] = encrypt('12345678Z', OWNER).split(':')
      expect(() => decrypt([iv, tag, data].join(':'), OWNER)).toThrow()
    })

    it('rejects corrupted data and a tampered tag', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const parts = encrypt('test', OWNER).split(':')
      const corrupted = [...parts]
      corrupted[4] = Buffer.from('corrupted-data').toString('base64')
      expect(() => decrypt(corrupted.join(':'), OWNER)).toThrow()

      const tag = Buffer.from(parts[3], 'base64')
      tag[0] ^= 0xff
      const tampered = [...parts]
      tampered[3] = tag.toString('base64')
      expect(() => decrypt(tampered.join(':'), OWNER)).toThrow()
    })

    it('rejects a wrong IV or tag length', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const parts = encrypt('test', OWNER).split(':')
      const badIv = [...parts]
      badIv[2] = Buffer.alloc(8).toString('base64')
      expect(() => decrypt(badIv.join(':'), OWNER)).toThrow('IV must be 12 bytes')
      const badTag = [...parts]
      badTag[3] = Buffer.alloc(8).toString('base64')
      expect(() => decrypt(badTag.join(':'), OWNER)).toThrow('auth tag must be 16 bytes')
    })

    it.each([['empty', ''], ['not a uuid', 'abc'], ['non-string', null]])(
      'encrypt refuses a member id that is %s',
      async (_label, id) => {
        const { encrypt } = await import('@/lib/encryption')
        expect(() => encrypt('x', id as never)).toThrow('member id')
      }
    )

    it('decrypt of a v2 value refuses a missing member id', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      expect(() => decrypt(encrypt('x', OWNER), '')).toThrow('member id')
    })
  })

  describe('legacy iv:tag:data (transitional fallback)', () => {
    it('still decrypts without AAD, whatever member id is passed', async () => {
      const { decrypt } = await import('@/lib/encryption')
      expect(decrypt(legacyEncrypt('612345678'), OWNER)).toBe('612345678')
    })

    it('rejects a tampered legacy tag', async () => {
      const { decrypt } = await import('@/lib/encryption')
      const parts = legacyEncrypt('612345678').split(':')
      const tag = Buffer.from(parts[1], 'base64')
      tag[0] ^= 0xff
      parts[1] = tag.toString('base64')
      expect(() => decrypt(parts.join(':'), OWNER)).toThrow()
    })

    it('rejects a wrong legacy IV length', async () => {
      const { decrypt } = await import('@/lib/encryption')
      const parts = legacyEncrypt('x').split(':')
      parts[0] = Buffer.alloc(8).toString('base64')
      expect(() => decrypt(parts.join(':'), OWNER)).toThrow('IV must be 12 bytes')
    })
  })

  describe('malformed input', () => {
    it.each([
      ['empty string', ''],
      ['one part', 'abc'],
      ['two parts', 'abc:def'],
      ['four parts', 'a:b:c:d'],
      ['v2 with four parts', `v2:${OWNER}:a:b`],
      ['unknown version', `v3:${OWNER}:a:b:c`],
      ['non-string', null],
    ])('rejects %s with a clear error', async (_label, input) => {
      const { decrypt } = await import('@/lib/encryption')
      expect(() => decrypt(input as never, OWNER)).toThrow('Invalid ciphertext')
    })
  })

  describe('ciphertextOwner', () => {
    it('returns the embedded owner of a v2 value and null otherwise', async () => {
      const { encrypt, ciphertextOwner } = await import('@/lib/encryption')
      expect(ciphertextOwner(encrypt('x', OWNER))).toBe(OWNER)
      expect(ciphertextOwner(legacyEncrypt('x'))).toBeNull()
      expect(ciphertextOwner('v2:not-a-uuid:a:b:c')).toBeNull()
      expect(ciphertextOwner(null as never)).toBeNull()
    })
  })

  describe('ENCRYPTION_KEY', () => {
    it('throws when it is missing', async () => {
      delete process.env.ENCRYPTION_KEY
      const { encrypt } = await import('@/lib/encryption')
      expect(() => encrypt('test', OWNER)).toThrow('ENCRYPTION_KEY must be a 64-character hex string')
    })

    it('throws when it has the wrong length', async () => {
      process.env.ENCRYPTION_KEY = 'tooshort'
      const { encrypt } = await import('@/lib/encryption')
      expect(() => encrypt('test', OWNER)).toThrow('ENCRYPTION_KEY must be a 64-character hex string')
    })

    it('throws when it has the right length but non-hex characters', async () => {
      process.env.ENCRYPTION_KEY = 'z'.repeat(64)
      const { encrypt } = await import('@/lib/encryption')
      expect(() => encrypt('test', OWNER)).toThrow('ENCRYPTION_KEY must be a 64-character hex string')
    })

    it('accepts an uppercase hex key', async () => {
      process.env.ENCRYPTION_KEY = 'ABCDEF0123456789'.repeat(4)
      const { encrypt, decrypt } = await import('@/lib/encryption')
      expect(decrypt(encrypt('x', OWNER), OWNER)).toBe('x')
    })
  })
})
