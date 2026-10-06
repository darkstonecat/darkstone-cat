import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, createAuthenticatedClient, cleanupUsers } from '../helpers/supabase'
import { countMessagesTo } from '../../e2e/helpers/mailpit'

// Spec §4.4 / BR-18 (T26): once a member leaves, no entry point lets them back in. GoTrue's ban
// refuses the password grant and every link; the app refuses the member area for a token issued
// before the leave and sends no recovery mail. Only the session client and next/headers are
// mocked (no Next.js request here). Every user is this file's own throwaway account.

const session = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ 'x-real-ip': '198.51.100.26', origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }),
}))

import { getCurrentMember, getProfileData } from '@/lib/supabase/auth'
import { leaveAssociation } from '@/lib/profile/leave-actions'
import { requestPasswordReset } from '@/lib/supabase/password-reset-actions'

const password = 'password123'
const DOMAIN = 'former-access.test'
const emails = {
  leaver: `fa-leaver@${DOMAIN}`,
  active: `fa-active@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let leaverSession: SupabaseClient
let oldAccessToken: string

function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false } }
  )
}

/** Stands in for the SSR client of a browser that still holds `token` (no refresh). */
function clientWithToken(token: string) {
  const raw = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  return {
    auth: { getUser: () => raw.auth.getUser(token) },
    from: (table: string) => raw.from(table),
  }
}

/** A link GoTrue would mail, verified as if the person clicked it. */
async function verifyGeneratedLink(type: 'magiclink' | 'recovery', email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type, email })
  if (error) return { refused: true, code: error.code ?? null }
  const verified = await anonClient().auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: type === 'magiclink' ? 'email' : 'recovery',
  })
  return { refused: verified.error !== null, code: verified.error?.code ?? null }
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: key, last_name: 'Former' })
    userIds.push(users[key].id)
  }
  leaverSession = await createAuthenticatedClient(emails.leaver, password)
  oldAccessToken = (await leaverSession.auth.getSession()).data.session!.access_token
})

afterAll(async () => {
  await cleanupUsers(userIds)
})

describe('before the leave', () => {
  it('the member area reads the member and the links work (control)', async () => {
    session.client = leaverSession
    expect((await getCurrentMember())?.id).toBe(users.leaver.id)
    expect((await getProfileData())?.member.id).toBe(users.leaver.id)

    expect(await verifyGeneratedLink('magiclink', emails.active)).toEqual({ refused: false, code: null })
    expect(await verifyGeneratedLink('recovery', emails.active)).toEqual({ refused: false, code: null })
  })
})

describe('after the member leaves (M-1)', () => {
  beforeAll(async () => {
    session.client = leaverSession
    expect(await leaveAssociation(null)).toEqual({ ok: true })
  })

  it('a token issued before the leave no longer opens the member area', async () => {
    // The leave signed `leaverSession` out; a browser that kept its cookie still sends this token.
    session.client = clientWithToken(oldAccessToken)
    // GoTrue refuses the token (its session is gone), so the proxy sends the browser to /login;
    // the left_on check in auth.ts covers a token GoTrue would still accept (tests/lib/auth-former-member).
    const probe = await (session.client as ReturnType<typeof clientWithToken>).auth.getUser()
    expect(probe.data.user).toBeNull()
    expect(await getCurrentMember()).toBeNull()
    expect(await getProfileData()).toBeNull()
  })

  it('password sign-in is refused by the ban', async () => {
    await expect(createAuthenticatedClient(emails.leaver, password)).rejects.toMatchObject({ code: 'user_banned' })
  })

  it('a magic link and a recovery link are refused', async () => {
    expect((await verifyGeneratedLink('magiclink', emails.leaver)).refused).toBe(true)
    expect((await verifyGeneratedLink('recovery', emails.leaver)).refused).toBe(true)
  })

  it('the neutral password reset answers as always and sends nothing', async () => {
    const before = await countMessagesTo(emails.leaver)
    expect(await requestPasswordReset(emails.leaver)).toEqual({ error: null })
    await new Promise((r) => setTimeout(r, 1500))
    expect(await countMessagesTo(emails.leaver)).toBe(before)
  })
})
