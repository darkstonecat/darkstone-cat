import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

// A-15 · sendAccessLink against the real database with a real board SESSION client. Only
// `createClient` (the session), `revalidatePath` and the magic-link sender (no mail leaves the
// test) are mocked; the shared limiter writes real `rate_limit_hits` rows. Every user is this
// file's own throwaway account; no superadmins.

const session = vi.hoisted(() => ({ client: null as unknown }))
const sender = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/magic-link', () => ({ sendMagicLinkOtp: sender.send }))

import { sendAccessLink } from '@/lib/admin/access-actions'

const password = 'password123'
const DOMAIN = 'access-link-action.test'
const emails = {
  board: `alink-board@${DOMAIN}`,
  member: `alink-member@${DOMAIN}`,
  target: `alink-target@${DOMAIN}`,
  former: `alink-former@${DOMAIN}`,
}
type Key = keyof typeof emails
const UNCONFIRMED_EMAIL = `alink-unconfirmed@${DOMAIN}`
const users = {} as Record<Key | 'unconfirmed', { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient

async function linkEntries(target: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('actor_id, actor_role, action, details, reason')
    .eq('target_member_id', target)
    .eq('action', 'member.send_access_link')
    .order('id')
  expect(error).toBeNull()
  return data!
}

async function bucketHits(target: string) {
  const { count, error } = await supabaseAdmin
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket', `access-link:${target}`)
  expect(error).toBeNull()
  return count!
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Enllac' })
    userIds.push(users[key].id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  const former = await supabaseAdmin
    .from('members')
    .update({ left_on: '2026-09-01', left_by: 'self' })
    .eq('id', users.former.id)
  expect(former.error).toBeNull()
  // An unconfirmed sign-up: hidden from the panel (BR-22), never sent a link.
  const created = await supabaseAdmin.auth.admin.createUser({
    email: UNCONFIRMED_EMAIL,
    password,
    email_confirm: false,
  })
  expect(created.error).toBeNull()
  users.unconfirmed = { id: created.data.user!.id }
  userIds.push(users.unconfirmed.id)
  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

beforeEach(() => {
  sender.send.mockReset()
  sender.send.mockResolvedValue({ ok: true })
  session.client = board
})

describe('sendAccessLink (A-15)', () => {
  it('a plain member session is refused; nothing is logged, limited or sent', async () => {
    session.client = member
    expect(await sendAccessLink(users.target.id)).toEqual({ error: 'forbidden' })
    expect(sender.send).not.toHaveBeenCalled()
    expect(await linkEntries(users.target.id)).toEqual([])
    expect(await bucketHits(users.target.id)).toBe(0)
  })

  it('refuses a former member and an unconfirmed sign-up', async () => {
    expect(await sendAccessLink(users.former.id)).toEqual({ error: 'not_active' })
    expect(await sendAccessLink(users.unconfirmed.id)).toEqual({ error: 'not_found' })
    expect(await sendAccessLink('00000000-0000-4000-8000-000000000000')).toEqual({ error: 'not_found' })
    expect(sender.send).not.toHaveBeenCalled()
    expect(await linkEntries(users.former.id)).toEqual([])
    expect(await bucketHits(users.former.id)).toBe(0)
  })

  it('sends to the account e-mail, writes one entry with the board actor and uses the member bucket', async () => {
    expect(await sendAccessLink(users.target.id)).toEqual({ ok: true })
    expect(sender.send).toHaveBeenCalledOnce()
    expect(sender.send).toHaveBeenCalledWith(emails.target)

    expect(await linkEntries(users.target.id)).toEqual([
      {
        actor_id: users.board.id,
        actor_role: 'board',
        action: 'member.send_access_link',
        details: {},
        reason: null,
      },
    ])
    expect(await bucketHits(users.target.id)).toBe(1)
  })

  it('a second link within 10 minutes is rate_limited with the time left; no entry, no mail', async () => {
    const res = await sendAccessLink(users.target.id)
    expect(res).toMatchObject({ error: 'rate_limited' })
    const retryAfter = (res as { retryAfter: number | null }).retryAfter
    expect(retryAfter).toBeGreaterThan(9 * 60 - 30)
    expect(retryAfter).toBeLessThanOrEqual(10 * 60)

    expect(sender.send).not.toHaveBeenCalled()
    expect(await linkEntries(users.target.id)).toHaveLength(1)
    expect(await bucketHits(users.target.id)).toBe(1)
  })

  it('the limit is per member: another member still gets a link', async () => {
    expect(await sendAccessLink(users.member.id)).toEqual({ ok: true })
    expect(sender.send).toHaveBeenCalledWith(emails.member)
    expect(await linkEntries(users.member.id)).toHaveLength(1)
  })
})
