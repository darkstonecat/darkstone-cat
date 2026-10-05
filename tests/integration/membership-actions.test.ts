import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

// The T10 actions against the real database: leaveMember / rejoinMember (A-6, A-7) with a real
// board SESSION client and leaveAssociation (M-1) with the member's own session. Only
// `createClient`, `revalidatePath` (no Next.js request here) and the mail module are mocked.
// Every user is this file's own throwaway account; no superadmins.

const session = vi.hoisted(() => ({ client: null as unknown }))
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/mail', () => ({ sendMail: mail.sendMail }))

import { leaveMember, rejoinMember } from '@/lib/admin/membership-actions'
import { leaveAssociation } from '@/lib/profile/leave-actions'

const password = 'password123'
const DOMAIN = 'membership-actions.test'
const emails = {
  board: `mact-board@${DOMAIN}`,
  member: `mact-member@${DOMAIN}`,
  target: `mact-target@${DOMAIN}`,
  selfLeaver: `mact-self@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient

const REASON = 'Incompliment reiterat de les pautes de conducta'

function anonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false } }
  )
}

function madridToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

async function getRow(id: string) {
  const { data, error } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  expect(error).toBeNull()
  return data!
}

async function auditEntries(target: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('actor_id, action, details, reason')
    .eq('target_member_id', target)
    .eq('action', action)
    .order('id')
  expect(error).toBeNull()
  return data!
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Baixa' })
    userIds.push(users[key].id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

beforeEach(() => {
  mail.sendMail.mockReset()
  mail.sendMail.mockResolvedValue({ ok: true })
  session.client = board
})

describe('leaveMember (A-6)', () => {
  it('a plain member session is refused; nothing changes and nothing is sent', async () => {
    session.client = member
    expect(await leaveMember(users.target.id, REASON)).toEqual({ error: 'forbidden' })
    expect((await getRow(users.target.id)).left_on).toBeNull()
    expect(mail.sendMail).not.toHaveBeenCalled()
  })

  it('maps the database rules: short reason, future date, self target', async () => {
    expect(await leaveMember(users.target.id, 'ok')).toEqual({ error: 'reason_required' })
    expect(await leaveMember(users.target.id, REASON, '2999-01-01')).toEqual({ error: 'invalid_date' })
    expect(await leaveMember(users.board.id, REASON)).toEqual({ error: 'self_target' })
    expect(mail.sendMail).not.toHaveBeenCalled()
  })

  it('closes the membership, writes one audit entry and e-mails the reason to the account address', async () => {
    const res = await leaveMember(users.target.id, `  ${REASON}  `)
    expect(res).toEqual({ ok: true, emailSent: true })

    const row = await getRow(users.target.id)
    expect(row).toMatchObject({ left_on: madridToday(), left_by: 'board', leave_reason: REASON })

    const entries = await auditEntries(users.target.id, 'membership.leave')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      actor_id: users.board.id,
      reason: REASON,
      details: { left_by: 'board', left_on: madridToday() },
    })

    expect(mail.sendMail).toHaveBeenCalledOnce()
    const [message, options] = mail.sendMail.mock.calls[0]
    expect(message.to).toBe(emails.target)
    expect(message.subject).toBe('Baixa de Darkstone Catalunya')
    expect(message.text).toContain('Hola, Nomtarget:')
    expect(message.text).toContain(REASON)
    expect(message.text).toContain(row.member_number)
    expect(options).toEqual({ logTag: 'membership-mail' })

    const { error } = await anonClient().auth.signInWithPassword({ email: emails.target, password })
    expect(error).not.toBeNull()
  })

  it('refuses a second leave of a former member before any e-mail', async () => {
    expect(await leaveMember(users.target.id, REASON)).toEqual({ error: 'not_active' })
    expect(mail.sendMail).not.toHaveBeenCalled()
  })
})

describe('rejoinMember (A-7)', () => {
  it('refuses an active member (not_former) and an unknown channel', async () => {
    expect(await rejoinMember(users.member.id, 'email')).toEqual({ error: 'not_former' })
    expect(await rejoinMember(users.target.id, 'phone' as never)).toEqual({ error: 'invalid_channel' })
    expect(mail.sendMail).not.toHaveBeenCalled()
  })

  it('reinstates the member, writes one audit entry and sends the welcome-back e-mail even if SMTP fails', async () => {
    mail.sendMail.mockResolvedValueOnce({ ok: false, code: 'ETIMEDOUT' })
    const before = await getRow(users.target.id)

    expect(await rejoinMember(users.target.id, 'email', ' Petició des del correu del compte ')).toEqual({
      ok: true,
      emailSent: false,
    })

    const row = await getRow(users.target.id)
    expect(row).toMatchObject({ left_on: null, left_by: null, current_joined_on: madridToday() })
    expect(row.member_number).toBe(before.member_number)
    expect(row.card_token).not.toBe(before.card_token)

    const entries = await auditEntries(users.target.id, 'membership.rejoin')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      actor_id: users.board.id,
      reason: 'Petició des del correu del compte',
      details: { channel: 'email', previous_left_by: 'board' },
    })

    expect(mail.sendMail).toHaveBeenCalledOnce()
    const [message] = mail.sendMail.mock.calls[0]
    expect(message.to).toBe(emails.target)
    expect(message.subject).toBe('Tornes a ser soci de Darkstone Catalunya')

    // The ban is lifted: the old password works again.
    const { error } = await anonClient().auth.signInWithPassword({ email: emails.target, password })
    expect(error).toBeNull()
  })
})

describe('leaveAssociation (M-1)', () => {
  it('a role holder is refused (BR-12)', async () => {
    session.client = board
    expect(await leaveAssociation()).toEqual({ error: 'role_held' })
    expect((await getRow(users.board.id)).left_on).toBeNull()
  })

  it('closes the caller\'s own membership (left_by self, actor = target), ends the session, sends nothing', async () => {
    const own = await createAuthenticatedClient(emails.selfLeaver, password)
    session.client = own

    expect(await leaveAssociation('  Em trasllado  ')).toEqual({ ok: true })

    const row = await getRow(users.selfLeaver.id)
    expect(row).toMatchObject({ left_on: madridToday(), left_by: 'self', leave_reason: 'Em trasllado' })

    const entries = await auditEntries(users.selfLeaver.id, 'membership.leave')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actor_id: users.selfLeaver.id, details: { left_by: 'self' } })

    expect(mail.sendMail).not.toHaveBeenCalled()
    expect((await own.auth.getSession()).data.session).toBeNull()
    expect(await leaveAssociation()).toEqual({ error: 'unauthenticated' })
  })
})
