import { describe, it, expect, vi } from 'vitest'
import {
  getCurrentUser,
  getCurrentMember,
  getProfileData,
} from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const mockUser = {
  id: 'user-123',
  email: 'test@darkstone.cat',
  aud: 'authenticated',
}

const mockMember = {
  id: 'user-123',
  first_name: 'Test',
  last_name: 'User',
  member_number: 'DS-001',
  role: 'member' as 'member' | 'admin' | 'board' | 'superadmin',
  phone_encrypted: null,
  dni_nie_encrypted: null,
  postal_code: null,
  ludoya_username: null,
  bgg_username: null,
  newsletter_accepted: false,
  membership_start_date: '2026-01-01',
  created_at: '2026-01-01',
  left_on: null as string | null,
}

// A former member whose access token GoTrue still accepts (issued before the leave).
const formerMember = { ...mockMember, left_on: '2026-10-01' }

function setupMock(opts: {
  user?: typeof mockUser | null
  userError?: { message: string } | null
  member?: typeof mockMember | null
  memberError?: { message: string } | null
}) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
        error: opts.userError ?? null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: opts.member ?? null,
            error: opts.memberError ?? null,
          }),
        }),
      }),
    }),
  }
  vi.mocked(createClient).mockResolvedValue(client as any)
  return client
}

describe('getCurrentUser', () => {
  it('returns user when authenticated', async () => {
    setupMock({ user: mockUser })
    expect(await getCurrentUser()).toEqual(mockUser)
  })

  it('returns null when not authenticated', async () => {
    setupMock({ user: null })
    expect(await getCurrentUser()).toBeNull()
  })
})

describe('getCurrentMember', () => {
  it('returns member when user exists', async () => {
    setupMock({ user: mockUser, member: mockMember })
    expect(await getCurrentMember()).toEqual(mockMember)
  })

  it('returns null when user is not authenticated', async () => {
    setupMock({ user: null })
    expect(await getCurrentMember()).toBeNull()
  })

  it('returns null when member row not found', async () => {
    setupMock({ user: mockUser, member: null })
    expect(await getCurrentMember()).toBeNull()
  })

  it('treats a former member as no member (spec §4.4)', async () => {
    setupMock({ user: mockUser, member: formerMember })
    expect(await getCurrentMember()).toBeNull()
  })
})

describe('getProfileData', () => {
  it('returns email and member on success', async () => {
    setupMock({ user: mockUser, member: mockMember })
    const data = await getProfileData()
    expect(data).toEqual({
      email: 'test@darkstone.cat',
      emailConfirmed: false,
      member: mockMember,
    })
  })

  it('reports a confirmed email from email_confirmed_at', async () => {
    setupMock({
      user: { ...mockUser, email_confirmed_at: '2026-09-01T10:00:00Z' } as any,
      member: mockMember,
    })
    expect((await getProfileData())?.emailConfirmed).toBe(true)
  })

  it('returns null on auth error', async () => {
    setupMock({ user: null, userError: { message: 'invalid token' } })
    expect(await getProfileData()).toBeNull()
  })

  it('returns null when member query fails', async () => {
    setupMock({
      user: mockUser,
      member: null,
      memberError: { message: 'not found' },
    })
    expect(await getProfileData()).toBeNull()
  })

  it('returns null for a former member, whose old access token still validates', async () => {
    setupMock({ user: mockUser, member: formerMember })
    expect(await getProfileData()).toBeNull()
  })

  it('returns empty string for missing email', async () => {
    setupMock({
      user: { ...mockUser, email: undefined } as any,
      member: mockMember,
    })
    const data = await getProfileData()
    expect(data?.email).toBe('')
  })
})
