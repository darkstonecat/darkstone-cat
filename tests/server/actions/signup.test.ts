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

const mockAllowRequestShared = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  allowRequestShared: (...args: unknown[]) => mockAllowRequestShared(...args),
}))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-real-ip': '203.0.113.7' })),
}))

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
}))

import { discardUnconfirmedSignup, updateMemberAfterSignup } from '@/lib/supabase/actions'
import { encrypt } from '@/lib/encryption'

const USER_ID = '4f1c2b3a-5d6e-4f70-8a9b-0c1d2e3f4a5b'

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const freshUser = { id: USER_ID, created_at: minutesAgo(1), email_confirmed_at: null }
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
    mockAllowRequestShared.mockResolvedValue(true)
    mockEq.mockResolvedValue({ error: null })
    mockGetUserById.mockResolvedValue({ data: { user: freshUser }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: blankRow, error: null })
  })

  const baseData = { userId: USER_ID, newsletter_accepted: false }
  const rejected = { error: 'Could not save member data' }

  it('returns error when userId is missing', async () => {
    const result = await updateMemberAfterSignup({ ...baseData, userId: '' })
    expect(result).toEqual({ error: 'Missing user ID' })
    expect(mockUpdatePayload).not.toHaveBeenCalled()
  })

  it('encrypts phone when provided', async () => {
    await updateMemberAfterSignup({ ...baseData, phone: '612345678' })
    // Bound to the row being completed (AAD member:<id>, T7b)
    expect(encrypt).toHaveBeenCalledWith('612345678', USER_ID)
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
    expect(mockEq).toHaveBeenCalledWith('id', USER_ID)
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

  describe('server-side trace of refusals', () => {
    it('logs only a fixed reason code, never ids or personal data', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockMaybeSingle.mockResolvedValue({
        data: { ...blankRow, dni_nie_encrypted: 'encrypted:old' },
        error: null,
      })
      await updateMemberAfterSignup({ ...baseData, phone: '612345678' })
      expect(warn).toHaveBeenCalledWith(
        '[signup] member details not saved reason=%s',
        'member_row_not_blank'
      )
      expect(JSON.stringify(warn.mock.calls)).not.toContain('612345678')
      warn.mockRestore()
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

  it('refuses an id that is not a UUID without calling GoTrue', async () => {
    expect(await updateMemberAfterSignup({ ...baseData, userId: 'user-1' })).toEqual(rejected)
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('is throttled per client IP before calling GoTrue', async () => {
    mockAllowRequestShared.mockResolvedValue(false)
    expect(await updateMemberAfterSignup({ ...baseData, phone: '612345678' })).toEqual(rejected)
    expect(mockAllowRequestShared).toHaveBeenCalledWith('signup-followup-ip', '203.0.113.7', 60, 600_000)
    expect(mockGetUserById).not.toHaveBeenCalled()
    expect(mockUpdatePayload).not.toHaveBeenCalled()
  })
})

describe('discardUnconfirmedSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllowRequestShared.mockResolvedValue(true)
    mockGetUserById.mockResolvedValue({ data: { user: freshUser }, error: null })
    mockDeleteUser.mockResolvedValue({ error: null })
    mockMemberDelete.mockResolvedValue({ error: null })
  })

  it('deletes a fresh unconfirmed user (member row cascades)', async () => {
    expect(await discardUnconfirmedSignup(USER_ID)).toEqual({ discarded: true })
    // The members row goes through the FK cascade, not an explicit delete.
    expect(mockMemberDelete).not.toHaveBeenCalled()
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID)
  })

  it('accepts a sign-up up to 30 minutes old', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { ...freshUser, created_at: minutesAgo(25) } },
      error: null,
    })
    expect((await discardUnconfirmedSignup(USER_ID)).discarded).toBe(true)
  })

  it.each([
    ['unknown user', { data: { user: null }, error: { message: 'nf' } }],
    ['confirmed user', { data: { user: { ...freshUser, email_confirmed_at: minutesAgo(2) } }, error: null }],
    ['old user', { data: { user: { ...freshUser, created_at: minutesAgo(45) } }, error: null }],
  ])('refuses %s', async (_name, response) => {
    mockGetUserById.mockResolvedValue(response)
    expect(await discardUnconfirmedSignup(USER_ID)).toEqual({ discarded: false })
    expect(mockDeleteUser).not.toHaveBeenCalled()
    expect(mockMemberDelete).not.toHaveBeenCalled()
  })

  it('never throws', async () => {
    mockDeleteUser.mockRejectedValue(new Error('boom'))
    expect(await discardUnconfirmedSignup(USER_ID)).toEqual({ discarded: false })
    expect(await discardUnconfirmedSignup('')).toEqual({ discarded: false })
  })

  it('refuses an id that is not a UUID without calling GoTrue', async () => {
    expect(await discardUnconfirmedSignup('user-1')).toEqual({ discarded: false })
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('is throttled per client IP before calling GoTrue', async () => {
    mockAllowRequestShared.mockResolvedValue(false)
    expect(await discardUnconfirmedSignup(USER_ID)).toEqual({ discarded: false })
    expect(mockGetUserById).not.toHaveBeenCalled()
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })
})
