import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDecrypt = vi.fn()
const OWNER = '11111111-2222-4333-8444-555555555555'
vi.mock('@/lib/encryption', () => ({
  decrypt: (v: string, id: string) => mockDecrypt(v, id),
  ciphertextOwner: (v: string) => (v.startsWith('v2:') ? v.split(':')[1] : null),
}))

import { maskEncryptedField } from '@/lib/profile/masked-field'
import { maskDni } from '@/lib/profile/mask'

describe('maskEncryptedField', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    mockDecrypt.mockReset()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errorSpy.mockRestore())

  it('returns the masked value', () => {
    mockDecrypt.mockReturnValue('12345678Z')
    expect(maskEncryptedField('enc', maskDni, 'dni')).toEqual({
      value: { masked: '•••••678Z', tail: '678Z' },
      unavailable: false,
    })
  })

  it('treats a missing value as not provided, not unavailable', () => {
    expect(maskEncryptedField(null, maskDni, 'dni')).toEqual({ value: null, unavailable: false })
    expect(mockDecrypt).not.toHaveBeenCalled()
  })

  it('flags a decrypt failure as unavailable and logs only the field name', () => {
    mockDecrypt.mockImplementation(() => {
      throw new Error('bad key 12345678Z')
    })
    expect(maskEncryptedField('enc', maskDni, 'dni')).toEqual({ value: null, unavailable: true })
    expect(errorSpy).toHaveBeenCalledWith('[profile/details] decrypt failed', 'dni')
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('12345678Z')
  })

  it('decrypts for the member id the caller passes', () => {
    mockDecrypt.mockReturnValue('12345678Z')
    maskEncryptedField(`v2:${OWNER}:a:b:c`, maskDni, 'dni', OWNER)
    expect(mockDecrypt).toHaveBeenCalledWith(`v2:${OWNER}:a:b:c`, OWNER)
  })

  it('without a member id, uses the owner a stored v2 value names (its own row)', () => {
    mockDecrypt.mockReturnValue('12345678Z')
    maskEncryptedField(`v2:${OWNER}:a:b:c`, maskDni, 'dni')
    expect(mockDecrypt).toHaveBeenCalledWith(`v2:${OWNER}:a:b:c`, OWNER)
  })

  it('without a member id, still decrypts a legacy value', () => {
    mockDecrypt.mockReturnValue('12345678Z')
    expect(maskEncryptedField('iv:tag:data', maskDni, 'dni').value?.tail).toBe('678Z')
    expect(mockDecrypt).toHaveBeenCalledWith('iv:tag:data', '')
  })
})
