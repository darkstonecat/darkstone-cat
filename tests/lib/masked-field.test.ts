import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDecrypt = vi.fn()
vi.mock('@/lib/encryption', () => ({ decrypt: (v: string) => mockDecrypt(v) }))

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
})
