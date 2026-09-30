import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdatePayload = vi.fn()
const mockEq = vi.fn()
const mockGetUserById = vi.fn()
const mockDeleteUser = vi.fn()
const mockMaybeSingle = vi.fn()
const mockMemberDelete = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { getUserById: mockGetUserById, deleteUser: mockDeleteUser } },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })),
      update: vi.fn((payload: unknown) => {
        mockUpdatePayload(payload)
        return { eq: mockEq }
      }),
      delete: vi.fn(() => ({ eq: mockMemberDelete })),
    })),
  })),
}))

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
}))

import { discardUnconfirmedSignup, updateMemberAfterSignup } from '@/lib/supabase/actions'
import { encrypt } from '@/lib/encryption'

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const freshUser = { id: 'user-1', created_at: minutesAgo(1), email_confirmed_at: null }
const blankRow = {
  dni_nie_encrypted: null,
  phone_encrypted: null,
  postal_code: null,
  ludoya_username: null,
  bgg_username: null,
}

describe('updateMemberAfterSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
    mockGetUserById.mockResolvedValue({ data: { user: freshUser }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: blankRow, error: null })
  })

  const baseData = { userId: 'user-1', newsletter_accepted: false }
  const rejected = { error: 'Could not save member data' }

  it('returns error when userId is missing', async () => {
    const result = await updateMemberAfterSignup({ ...baseData, userId: '' })
    expect(result).toEqual({ error: 'Missing user ID' })
    expect(mockUpdatePayload).not.toHaveBeenCalled()
  })

  it('encrypts phone when provided', async () => {
    await updateMemberAfterSignup({ ...baseData, phone: '612345678' })
    expect(encrypt).toHaveBeenCalledWith('612345678')
    expect(mockUpdatePayload.mock.calls[0][0].phone_encrypted).toBe('encrypted:612345678')
  })

  it('encrypts DNI and accepts a NIE', async () => {
    await updateMemberAfterSignup({ ...baseData, dni: '12345678A' })
    expect(mockUpdatePayload.mock.calls[0][0].dni_nie_encrypted).toBe('encrypted:12345678A')
    await updateMemberAfterSignup({ ...baseData, dni: 'X1234567L' })
    expect(mockUpdatePayload.mock.calls[1][0].dni_nie_encrypted).toBe('encrypted:X1234567L')
  })

  it('omits optional fields when empty or whitespace', async () => {
    await updateMemberAfterSignup({ ...baseData, phone: '', dni: '  ', postal_code: '' })
    const payload = mockUpdatePayload.mock.calls[0][0]
    expect(payload).not.toHaveProperty('phone_encrypted')
    expect(payload).not.toHaveProperty('dni_nie_encrypted')
    expect(payload).not.toHaveProperty('postal_code')
  })

  it('includes optional fields when non-empty, normalizing usernames', async () => {
    await updateMemberAfterSignup({
      ...baseData,
      postal_code: '08221',
      ludoya_username: '@darkstone',
      bgg_username: 'darkstone_bcn',
    })
    const payload = mockUpdatePayload.mock.calls[0][0]
    expect(payload.postal_code).toBe('08221')
    expect(payload.ludoya_username).toBe('darkstone')
    expect(payload.bgg_username).toBe('darkstone_bcn')
  })

  it('targets the correct user ID', async () => {
    await updateMemberAfterSignup(baseData)
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns a generic error on database failure', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'internal detail' } })
    expect(await updateMemberAfterSignup(baseData)).toEqual(rejected)
  })

  it('never throws', async () => {
    mockGetUserById.mockRejectedValueOnce(new Error('boom'))
    expect(await updateMemberAfterSignup(baseData)).toEqual(rejected)
  })

  describe('caller proof', () => {
    it('rejects an id that is not an auth user', async () => {
      mockGetUserById.mockResolvedValue({ data: { user: null }, error: { message: 'not found' } })
      expect(await updateMemberAfterSignup({ ...baseData, phone: '612345678' })).toEqual(rejected)
      expect(mockUpdatePayload).not.toHaveBeenCalled()
    })

    it('rejects a user who already confirmed the email', async () => {
      mockGetUserById.mockResolvedValue({
        data: { user: { ...freshUser, email_confirmed_at: minutesAgo(1) } },
        error: null,
      })
      expect(await updateMemberAfterSignup(baseData)).toEqual(rejected)
      expect(mockUpdatePayload).not.toHaveBeenCalled()
    })

    it('rejects a user created more than 10 minutes ago', async () => {
      mockGetUserById.mockResolvedValue({
        data: { user: { ...freshUser, created_at: minutesAgo(11) } },
        error: null,
      })
      expect(await updateMemberAfterSignup(baseData)).toEqual(rejected)
      expect(mockUpdatePayload).not.toHaveBeenCalled()
    })

    it('rejects a member row that was already completed', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { ...blankRow, dni_nie_encrypted: 'encrypted:old' },
        error: null,
      })
      expect(await updateMemberAfterSignup({ ...baseData, phone: '612345678' })).toEqual(rejected)
      expect(mockUpdatePayload).not.toHaveBeenCalled()
    })
  })

  describe('format validation', () => {
    it.each([
      ['dni', '1234A'],
      ['dni', '123456789'],
      ['phone', 'abc'],
      ['phone', '12'],
      ['postal_code', '0822'],
      ['postal_code', '0822a'],
      ['ludoya_username', 'bad/name'],
      ['bgg_username', 'x'.repeat(65)],
    ])('rejects a bad %s (%s) before touching the database', async (field, value) => {
      const result = await updateMemberAfterSignup({ ...baseData, [field]: value })
      expect(result.error).toBeTruthy()
      expect(mockGetUserById).not.toHaveBeenCalled()
      expect(mockUpdatePayload).not.toHaveBeenCalled()
    })
  })
})

describe('discardUnconfirmedSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserById.mockResolvedValue({ data: { user: freshUser }, error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockMemberDelete.mockResolvedValue({ error: null })
  })

  it('deletes a fresh unconfirmed user (member row cascades)', async () => {
    expect(await discardUnconfirmedSignup('user-1')).toEqual({ discarded: true })
    // The members row goes through the FK cascade, not an explicit delete.
    expect(mockMemberDelete).not.toHaveBeenCalled()
    expect(mockDeleteUser).toHaveBeenCalledWith('user-1')
  })

  it('accepts a sign-up up to 30 minutes old', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { ...freshUser, created_at: minutesAgo(25) } },
      error: null,
    })
    expect((await discardUnconfirmedSignup('user-1')).discarded).toBe(true)
  })

  it.each([
    ['unknown user', { data: { user: null }, error: { message: 'nf' } }],
    ['confirmed user', { data: { user: { ...freshUser, email_confirmed_at: minutesAgo(2) } }, error: null }],
    ['old user', { data: { user: { ...freshUser, created_at: minutesAgo(45) } }, error: null }],
  ])('refuses %s', async (_name, response) => {
    mockGetUserById.mockResolvedValue(response)
    expect(await discardUnconfirmedSignup('user-1')).toEqual({ discarded: false })
    expect(mockDeleteUser).not.toHaveBeenCalled()
    expect(mockMemberDelete).not.toHaveBeenCalled()
  })

  it('never throws', async () => {
    mockDeleteUser.mockRejectedValue(new Error('boom'))
    expect(await discardUnconfirmedSignup('user-1')).toEqual({ discarded: false })
    expect(await discardUnconfirmedSignup('')).toEqual({ discarded: false })
  })
})
