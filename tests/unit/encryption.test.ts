import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('encryption', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  })

  it('roundtrip encrypt → decrypt recovers plaintext', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    expect(decrypt(encrypt('Hello Darkstone!'))).toBe('Hello Darkstone!')
  })

  it('produces different ciphertexts for the same input (unique IVs)', async () => {
    const { encrypt } = await import('@/lib/encryption')
    expect(encrypt('same')).not.toBe(encrypt('same'))
  })

  it('output format is iv:authTag:ciphertext (3 base64 parts)', async () => {
    const { encrypt } = await import('@/lib/encryption')
    const parts = encrypt('test').split(':')
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(Buffer.from(part, 'base64').length).toBeGreaterThan(0)
    }
  })

  it('handles unicode (accents, emojis)', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const text = 'Associació Darkstone Catalunya 🎲 àèéíòóúü'
    expect(decrypt(encrypt(text))).toBe(text)
  })

  it('rejects corrupted ciphertext data', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const parts = encrypt('test').split(':')
    parts[2] = Buffer.from('corrupted-data').toString('base64')
    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('rejects tampered auth tag', async () => {
    const { encrypt, decrypt } = await import('@/lib/encryption')
    const parts = encrypt('test').split(':')
    const tagBuf = Buffer.from(parts[1], 'base64')
    tagBuf[0] ^= 0xff
    parts[1] = tagBuf.toString('base64')
    expect(() => decrypt(parts.join(':'))).toThrow()
  })

  it('throws when ENCRYPTION_KEY is missing', async () => {
    delete process.env.ENCRYPTION_KEY
    const { encrypt } = await import('@/lib/encryption')
    expect(() => encrypt('test')).toThrow(
      'ENCRYPTION_KEY must be a 64-character hex string'
    )
  })

  it('throws when ENCRYPTION_KEY has wrong length', async () => {
    process.env.ENCRYPTION_KEY = 'tooshort'
    const { encrypt } = await import('@/lib/encryption')
    expect(() => encrypt('test')).toThrow(
      'ENCRYPTION_KEY must be a 64-character hex string'
    )
  })

  it('throws when ENCRYPTION_KEY has the right length but non-hex characters', async () => {
    process.env.ENCRYPTION_KEY = 'z'.repeat(64)
    const { encrypt } = await import('@/lib/encryption')
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 64-character hex string')
  })

  it('accepts an uppercase hex key', async () => {
    process.env.ENCRYPTION_KEY = 'ABCDEF0123456789'.repeat(4)
    const { encrypt, decrypt } = await import('@/lib/encryption')
    expect(decrypt(encrypt('x'))).toBe('x')
  })

  describe('decrypt input validation', () => {
    it.each([
      ['empty string', ''],
      ['one part', 'abc'],
      ['two parts', 'abc:def'],
      ['four parts', 'a:b:c:d'],
    ])('rejects %s with a clear error', async (_label, input) => {
      const { decrypt } = await import('@/lib/encryption')
      expect(() => decrypt(input)).toThrow('expected 3 colon-separated parts')
    })

    it('rejects a wrong IV length', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const parts = encrypt('test').split(':')
      parts[0] = Buffer.alloc(8).toString('base64')
      expect(() => decrypt(parts.join(':'))).toThrow('IV must be 12 bytes')
    })

    it('rejects a wrong auth tag length', async () => {
      const { encrypt, decrypt } = await import('@/lib/encryption')
      const parts = encrypt('test').split(':')
      parts[1] = Buffer.alloc(8).toString('base64')
      expect(() => decrypt(parts.join(':'))).toThrow('auth tag must be 16 bytes')
    })

    it('rejects non-string input', async () => {
      const { decrypt } = await import('@/lib/encryption')
      expect(() => decrypt(null as never)).toThrow('expected 3 colon-separated parts')
    })
  })
})
