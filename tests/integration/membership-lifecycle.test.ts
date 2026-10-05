import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261005100400_membership_lifecycle.sql: leaving (A-6 admin_member_leave, M-1
// member_leave_self) and returning (A-7 admin_member_rejoin), spec §4.2–§4.4.
//
// Every user here is this file's own throwaway account. Superadmin cases live in
// roles.test.ts (the only file allowed to create superadmins).

const password = 'password123'
const DOMAIN = 'lifecycle.test'
const emails = {
  board: `lc-board@${DOMAIN}`,
  member: `lc-member@${DOMAIN}`,
  leaver: `lc-leaver@${DOMAIN}`,
  selfLeaver: `lc-self@${DOMAIN}`,
  roleHolder: `lc-role@${DOMAIN}`,
  backdated: `lc-backdated@${DOMAIN}`,
  anonymised: `lc-anonymised@${DOMAIN}`,
  purged: `lc-purged@${DOMAIN}`,
  noLogin: `lc-nologin@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

// Fake ciphertexts: shapes only, never decrypted here.
const DNI_CIPHER = 'aaaa1111:bbbb2222:cccc3333dni'
const PHONE_CIPHER = 'dddd4444:eeee5555:ffff6666phone'

function madridDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

async function getRow(id: string) {
  const { data, error } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  expect(error).toBeNull()
  return data!
}

async function authState(id: string) {
  const { data, error } = await runSqlAsPostgres<{ banned_until: string | null; sessions: number; tokens: number }>(
    `select u.banned_until,
            (select count(*)::int from auth.sessions s where s.user_id = u.id) as sessions,
            (select count(*)::int from auth.refresh_tokens r where r.user_id = u.id::text) as tokens
     from auth.users u where u.id = $1`,
    [id]
  )
  expect(error).toBeNull()
  return data![0]
}

async function auditEntries(target: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('actor_id, actor_role, action, target_member_id, target_member_number, details, reason')
    .eq('target_member_id', target)
    .eq('action', action)
    .order('id')
  expect(error).toBeNull()
  return data!
}

function profileFields(id: string) {
  return update(id, {
    phone_encrypted: PHONE_CIPHER,
    dni_nie_encrypted: DNI_CIPHER,
    postal_code: '08221',
    ludoya_username: 'lc_ludoya',
    bgg_username: 'lc_bgg',
    newsletter_accepted: true,
  })
}

function leave(client: SupabaseClient, id: string, reason: string | null, leftOn?: string | null) {
  const args: Record<string, unknown> = { p_member_id: id, p_reason: reason }
  if (leftOn !== undefined) args.p_left_on = leftOn
  return client.rpc('admin_member_leave', args)
}

function rejoin(client: SupabaseClient, id: string, channel: string | null, note: string | null = null) {
  return client.rpc('admin_member_rejoin', { p_member_id: id, p_channel: channel, p_note: note })
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: key, last_name: 'Lifecycle' })
    userIds.push(users[key].id)
  }
  await update(users.board.id, { role: 'board' })
  await update(users.roleHolder.id, { role: 'board' })
  await profileFields(users.leaver.id)
  await profileFields(users.selfLeaver.id)
  await update(users.backdated.id, { current_joined_on: '2020-01-01' })

  // Former members set up directly: anonymised (S-3 deletes the login account), purged stub,
  // and a former member whose login account was deleted by other means.
  await update(users.anonymised.id, { left_on: '2026-01-10', left_by: 'self', anonymised_at: new Date().toISOString() })
  await update(users.purged.id, { left_on: '2022-01-10', left_by: 'self', purged_at: new Date().toISOString() })
  await update(users.noLogin.id, { left_on: '2026-01-10', left_by: 'self' })
  for (const key of ['anonymised', 'noLogin'] as const) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(users[key].id)
    expect(error).toBeNull()
  }

  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

describe('who may call the lifecycle functions', () => {
  it('a plain member cannot give a baixa or reinstate (42501)', async () => {
    const a = await leave(member, users.leaver.id, 'Decisió de la junta')
    expect(a.error?.code).toBe('42501')
    expect(a.error?.message).toContain('membership:forbidden')

    const b = await rejoin(member, users.noLogin.id, 'email')
    expect(b.error?.code).toBe('42501')
    expect(b.error?.message).toContain('membership:forbidden')
    expect((await getRow(users.leaver.id)).left_on).toBeNull()
  })

  it('anonymous and service-role clients have no EXECUTE grant', async () => {
    for (const client of [anon, supabaseAdmin]) {
      const a = await leave(client, users.leaver.id, 'Decisió de la junta')
      expect(a.error?.code).toBe('42501')
      expect(a.error?.message).toContain('permission denied')
      const b = await client.rpc('member_leave_self', { p_reason: null })
      expect(b.error?.code).toBe('42501')
      const c = await rejoin(client, users.noLogin.id, 'email')
      expect(c.error?.code).toBe('42501')
    }
  })
})

describe('A-6: the board gives a member baixa', () => {
  it('refuses an unknown member, the caller themselves and a role holder (BR-12)', async () => {
    const unknown = await leave(board, '00000000-0000-4000-8000-000000000000', 'Decisió de la junta')
    expect(unknown.error?.message).toContain('membership:not_found')

    const self = await leave(board, users.board.id, 'Decisió de la junta')
    expect(self.error?.message).toContain('membership:self_target')

    const role = await leave(board, users.roleHolder.id, 'Decisió de la junta')
    expect(role.error?.code).toBe('23514')
    expect(role.error?.message).toContain('membership:role_held')
    expect((await getRow(users.roleHolder.id)).left_on).toBeNull()
  })

  it('requires a reason of at least 5 characters after trimming, at most 500 (BR-8)', async () => {
    for (const reason of [null, '', '   ', ' abcd  ']) {
      const { error } = await leave(board, users.leaver.id, reason)
      expect(error?.code).toBe('22023')
      expect(error?.message).toContain('membership:reason_required')
    }
    const long = await leave(board, users.leaver.id, 'x'.repeat(501))
    expect(long.error?.message).toContain('membership:reason_too_long')
    expect((await getRow(users.leaver.id)).left_on).toBeNull()
  })

  it('refuses a date in the future, before the current alta or more than a year back', async () => {
    for (const leftOn of [madridDate(1), '2019-12-31', madridDate(-366)]) {
      const { error } = await leave(board, users.backdated.id, 'Decisió de la junta', leftOn)
      expect(error?.code).toBe('22023')
      expect(error?.message).toContain('membership:invalid_date')
    }
    // the current alta bounds it too
    const beforeAlta = await leave(board, users.leaver.id, 'Decisió de la junta', madridDate(-1))
    expect(beforeAlta.error?.message).toContain('membership:invalid_date')
    expect((await getRow(users.backdated.id)).left_on).toBeNull()
  })

  it('accepts a backdated leave within the limits and records that date', async () => {
    const leftOn = madridDate(-10)
    const { data, error } = await leave(board, users.backdated.id, 'Baixa a petició verbal', leftOn)
    expect(error).toBeNull()
    expect(data).toEqual([expect.objectContaining({ email: emails.backdated, left_on: leftOn })])
    expect((await getRow(users.backdated.id)).left_on).toBe(leftOn)
    const [entry] = await auditEntries(users.backdated.id, 'membership.leave')
    expect(entry.details).toEqual({ left_by: 'board', left_on: leftOn })
  })

  it('closes the membership: contact data cleared, card rotated, login banned, one audit entry', async () => {
    const session = await createAuthenticatedClient(emails.leaver, password)
    const before = await getRow(users.leaver.id)
    expect((await authState(users.leaver.id)).sessions).toBeGreaterThan(0)

    const { data, error } = await leave(board, users.leaver.id, '  Compte duplicat  ')
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        member_number: before.member_number,
        email: emails.leaver,
        first_name: 'leaver',
        left_on: madridDate(),
      },
    ])

    const after = await getRow(users.leaver.id)
    expect(after).toMatchObject({
      left_on: madridDate(),
      left_by: 'board',
      leave_reason: 'Compte duplicat',
      phone_encrypted: null,
      postal_code: null,
      ludoya_username: null,
      bgg_username: null,
      newsletter_accepted: false,
      // the register stays, blocked (§4.2)
      dni_nie_encrypted: DNI_CIPHER,
      first_name: 'leaver',
      member_number: before.member_number,
      membership_start_date: before.membership_start_date,
      current_joined_on: before.current_joined_on,
      role: 'member',
    })
    expect(after.card_token).not.toBe(before.card_token)
    expect(new Date(after.card_issued_at).getTime()).toBeGreaterThan(new Date(before.card_issued_at).getTime())

    const auth = await authState(users.leaver.id)
    expect(auth.banned_until).not.toBeNull()
    expect(new Date(auth.banned_until!).getFullYear()).toBeGreaterThan(new Date().getFullYear() + 50)
    expect(auth.sessions).toBe(0)
    expect(auth.tokens).toBe(0)

    const entries = await auditEntries(users.leaver.id, 'membership.leave')
    expect(entries).toEqual([
      {
        actor_id: users.board.id,
        actor_role: 'board',
        action: 'membership.leave',
        target_member_id: users.leaver.id,
        target_member_number: before.member_number,
        details: { left_by: 'board', left_on: madridDate() },
        reason: 'Compte duplicat',
      },
    ])

    // The session open at the time of the leave cannot be renewed (BR-18)
    const refresh = await session.auth.refreshSession()
    expect(refresh.error).not.toBeNull()
    // Its access token still reaches PostgREST until it expires, but as a former member
    const { data: hasRole } = await session.rpc('has_role', { p_min: 'member' })
    expect(hasRole).toBe(false)
    await session.from('members').update({ first_name: 'Hacked' }).eq('id', users.leaver.id)
    expect((await getRow(users.leaver.id)).first_name).toBe('leaver')
  })

  it('after the leave: no sign-in, no magic link, card not valid', async () => {
    await expect(createAuthenticatedClient(emails.leaver, password)).rejects.toMatchObject({ code: 'user_banned' })

    const { data: confirmed } = await supabaseAdmin.rpc('is_email_confirmed', { p_email: emails.leaver })
    expect(confirmed).toBe(false)

    const { card_token } = await getRow(users.leaver.id)
    const { data: card } = await anon.rpc('verify_card_token', { p_token: card_token })
    expect(card).toEqual([{ valid: false, member_number: null }])
  })

  it('refuses a member who is already former', async () => {
    const { error } = await leave(board, users.leaver.id, 'Decisió de la junta')
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('membership:not_active')
    expect(await auditEntries(users.leaver.id, 'membership.leave')).toHaveLength(1)
  })
})

describe('M-1: a member leaves by themselves', () => {
  it('is refused while the member holds a role (BR-12)', async () => {
    const client = await createAuthenticatedClient(emails.roleHolder, password)
    const { error } = await client.rpc('member_leave_self', { p_reason: null })
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('membership:role_held')
    expect((await getRow(users.roleHolder.id)).left_on).toBeNull()
  })

  it('closes the caller\'s own membership with left_by self and actor = target', async () => {
    const client = await createAuthenticatedClient(emails.selfLeaver, password)
    const before = await getRow(users.selfLeaver.id)

    const { data, error } = await client.rpc('member_leave_self', { p_reason: null })
    expect(error).toBeNull()
    expect(data).toEqual([{ member_number: before.member_number, left_on: madridDate() }])

    const after = await getRow(users.selfLeaver.id)
    expect(after).toMatchObject({
      left_on: madridDate(),
      left_by: 'self',
      leave_reason: null,
      phone_encrypted: null,
      postal_code: null,
      ludoya_username: null,
      bgg_username: null,
      newsletter_accepted: false,
    })
    expect(after.card_token).not.toBe(before.card_token)

    const auth = await authState(users.selfLeaver.id)
    expect(auth.banned_until).not.toBeNull()
    expect(auth.sessions).toBe(0)

    const entries = await auditEntries(users.selfLeaver.id, 'membership.leave')
    expect(entries).toEqual([
      expect.objectContaining({
        actor_id: users.selfLeaver.id,
        actor_role: 'member',
        details: { left_by: 'self', left_on: madridDate() },
        reason: null,
      }),
    ])

    // the still-valid access token cannot leave twice
    const again = await client.rpc('member_leave_self', { p_reason: null })
    expect(again.error?.message).toContain('membership:not_active')
    await expect(createAuthenticatedClient(emails.selfLeaver, password)).rejects.toMatchObject({ code: 'user_banned' })
  })
})

describe('A-7: the board reinstates a former member', () => {
  it('refuses an active member, an anonymised or purged register, and a missing login', async () => {
    const active = await rejoin(board, users.member.id, 'email')
    expect(active.error?.code).toBe('22023')
    expect(active.error?.message).toContain('membership:not_former')

    for (const key of ['anonymised', 'purged'] as const) {
      const { error } = await rejoin(board, users[key].id, 'email')
      expect(error?.message).toContain('membership:register_closed')
    }

    const noLogin = await rejoin(board, users.noLogin.id, 'email')
    expect(noLogin.error?.message).toContain('membership:no_login')

    const unknown = await rejoin(board, '00000000-0000-4000-8000-000000000000', 'email')
    expect(unknown.error?.message).toContain('membership:not_found')
  })

  it('only accepts the request channels of the dialog, and a note of at most 500 characters', async () => {
    for (const channel of [null, '', 'Correu', 'telepathy']) {
      const { error } = await rejoin(board, users.leaver.id, channel)
      expect(error?.code).toBe('22023')
      expect(error?.message).toContain('membership:invalid_channel')
    }
    const long = await rejoin(board, users.leaver.id, 'email', 'x'.repeat(501))
    expect(long.error?.message).toContain('membership:note_too_long')
    expect((await getRow(users.leaver.id)).left_on).not.toBeNull()
  })

  it('restores the membership: same number, alta actual today, new card, ban lifted, one audit entry', async () => {
    await update(users.leaver.id, { membership_start_date: '2021-03-04' })
    const before = await getRow(users.leaver.id)

    const { data, error } = await rejoin(board, users.leaver.id, 'in_person', '  Ho ha demanat a la partida  ')
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        member_number: before.member_number,
        email: emails.leaver,
        first_name: 'leaver',
        current_joined_on: madridDate(),
      },
    ])

    const after = await getRow(users.leaver.id)
    expect(after).toMatchObject({
      left_on: null,
      left_by: null,
      leave_reason: null,
      current_joined_on: madridDate(),
      membership_start_date: '2021-03-04',
      member_number: before.member_number,
      newsletter_accepted: false,
      role: 'member',
    })
    expect(after.card_token).not.toBe(before.card_token)
    expect(new Date(after.card_issued_at).getTime()).toBeGreaterThan(new Date(before.card_issued_at).getTime())

    expect((await authState(users.leaver.id)).banned_until).toBeNull()

    const { data: card } = await anon.rpc('verify_card_token', { p_token: after.card_token })
    expect(card).toEqual([{ valid: true, member_number: before.member_number }])
    const { data: oldCard } = await anon.rpc('verify_card_token', { p_token: before.card_token })
    expect(oldCard).toEqual([{ valid: false, member_number: null }])

    expect(await auditEntries(users.leaver.id, 'membership.rejoin')).toEqual([
      {
        actor_id: users.board.id,
        actor_role: 'board',
        action: 'membership.rejoin',
        target_member_id: users.leaver.id,
        target_member_number: before.member_number,
        details: { channel: 'in_person', previous_left_on: before.left_on, previous_left_by: 'board' },
        reason: 'Ho ha demanat a la partida',
      },
    ])

    // the member signs in again with the password they had before (§4.3)
    const client = await createAuthenticatedClient(emails.leaver, password)
    const { data: hasRole } = await client.rpc('has_role', { p_min: 'member' })
    expect(hasRole).toBe(true)
    const { data: confirmed } = await supabaseAdmin.rpc('is_email_confirmed', { p_email: emails.leaver })
    expect(confirmed).toBe(true)
  })

  it('a self-left member can be reinstated too', async () => {
    const { error } = await rejoin(board, users.selfLeaver.id, 'form')
    expect(error).toBeNull()
    expect((await getRow(users.selfLeaver.id)).left_on).toBeNull()
    await expect(createAuthenticatedClient(emails.selfLeaver, password)).resolves.toBeTruthy()
  })
})

// T5 follow-up fixed in the same migration: search must not confirm a former member's
// usernames (admin_get_member masks them, BR-20/21), and ŀ folds like "l".
describe('admin_list_members search and former members', () => {
  function search(q: string) {
    return board.rpc('admin_list_members', { p_state: 'all', p_q: q })
  }

  it('does not match a username still stored on a former member\'s row, but matches name and number', async () => {
    // backdated left in an earlier test; put usernames back on the row by hand
    await update(users.backdated.id, { ludoya_username: 'lcformerludoqz', bgg_username: 'lcformerbggqz' })
    const { member_number } = await getRow(users.backdated.id)

    for (const q of ['lcformerludoqz', 'lcformerbggqz']) {
      const { data, error } = await search(q)
      expect(error).toBeNull()
      expect(data).toEqual([])
    }

    const byName = await search('backdated lifecycle')
    expect(byName.data!.map((r: { id: string }) => r.id)).toEqual([users.backdated.id])
    const byNumber = await search(member_number)
    expect(byNumber.data!.map((r: { id: string }) => r.id)).toContain(users.backdated.id)
  })

  it('still matches an active member\'s usernames', async () => {
    await update(users.member.id, { ludoya_username: 'lcactiveludoqz' })
    const { data } = await search('lcactiveludoqz')
    expect(data!.map((r: { id: string }) => r.id)).toEqual([users.member.id])
  })

  it('folds the Catalan ŀ like l', async () => {
    await update(users.member.id, { last_name: 'Gaŀlqz' })
    for (const q of ['gal·lqz', 'gallqz', 'GAĿLQZ']) {
      const { data } = await search(q)
      expect(data!.map((r: { id: string }) => r.id)).toEqual([users.member.id])
    }
  })
})
