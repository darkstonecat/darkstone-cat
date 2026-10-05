import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'
import { fakeMemberCipher } from '../helpers/cipher'

// Migration 20261005100800_admin_exports.sql: the audited exports A-10 (admin_export_members,
// member CSV) and A-11 (admin_export_member_data, one member's data). Each function writes its
// audit entry in the same transaction as the read, so no export is ever served without one,
// and log_admin_event() no longer accepts the two keys.
//
// The member CSV covers every active member in the database, also other files' users running
// in parallel: assertions look only at this file's own ids. Superadmin cases (A-11 on a former
// member) live in roles.test.ts, the only file allowed to create superadmins.

const password = 'password123'
const DOMAIN = 'admin-exports.test'
const emails = {
  board: `ax-board@${DOMAIN}`,
  legacy: `ax-legacy@${DOMAIN}`,
  member: `ax-member@${DOMAIN}`,
  active: `ax-active@${DOMAIN}`,
  former: `ax-former@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string; member_number: string }>
const userIds: string[] = []
let unconfirmedId: string
let board: SupabaseClient
let legacy: SupabaseClient
let member: SupabaseClient
const ciphers = {} as { activePhone: string; activeDni: string; formerDni: string }

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000'

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

/** Entries written by `actor` with `action`, oldest first. */
async function entriesBy(actor: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id, actor_id, actor_role, action, target_member_id, target_member_number, details, reason')
    .eq('actor_id', actor)
    .eq('action', action)
    .order('id')
  expect(error).toBeNull()
  return data!
}

async function entriesFor(target: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id, actor_id, actor_role, details')
    .eq('target_member_id', target)
    .eq('action', action)
    .order('id')
  expect(error).toBeNull()
  return data!
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    const user = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Exports' })
    const { data } = await supabaseAdmin.from('members').select('member_number').eq('id', user.id).single()
    users[key] = { id: user.id, member_number: data!.member_number }
    userIds.push(user.id)
  }

  const { data: pending, error } = await supabaseAdmin.auth.admin.createUser({
    email: `ax-unconfirmed@${DOMAIN}`,
    password,
    email_confirm: false,
    user_metadata: { first_name: 'Pendent', last_name: 'Exports' },
  })
  expect(error).toBeNull()
  unconfirmedId = pending.user!.id
  userIds.push(unconfirmedId)

  await update(users.board.id, { role: 'board' })
  await update(users.legacy.id, { role: 'admin' })

  ciphers.activePhone = fakeMemberCipher(users.active.id)
  ciphers.activeDni = fakeMemberCipher(users.active.id)
  ciphers.formerDni = fakeMemberCipher(users.former.id)
  await update(users.active.id, {
    phone_encrypted: ciphers.activePhone,
    dni_nie_encrypted: ciphers.activeDni,
    postal_code: '08221',
    ludoya_username: 'ax_ludoya',
    bgg_username: 'ax_bgg',
    newsletter_accepted: true,
    membership_start_date: '2020-03-01',
    current_joined_on: '2024-05-10',
  })
  await update(users.former.id, { left_on: '2026-09-20', left_by: 'self', dni_nie_encrypted: ciphers.formerDni })
  expect(
    (await supabaseAdmin.from('member_badges').insert({ member_id: users.active.id, badge_key: 'ludoteca_donor' })).error
  ).toBeNull()

  board = await createAuthenticatedClient(emails.board, password)
  legacy = await createAuthenticatedClient(emails.legacy, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

// ---------------------------------------------------------------------------------------------
describe('admin_export_members() (A-10)', () => {
  type Row = Record<string, unknown> & { id: string; member_number: string; total_rows: number }
  const exportAs = (client: SupabaseClient, role?: string | null) =>
    client.rpc('admin_export_members', role === undefined ? {} : { p_role: role })

  it('returns the active members with the CSV columns and logs one entry with the row count', async () => {
    const before = await entriesBy(users.board.id, 'export.members_csv')
    const { data, error } = await exportAs(board)
    expect(error).toBeNull()
    const rows = data as Row[]

    const own = rows.filter((r) => userIds.includes(r.id))
    expect(own.map((r) => r.id).sort()).toEqual(
      [users.board.id, users.legacy.id, users.member.id, users.active.id].sort()
    )
    expect(rows.find((r) => r.id === users.active.id)).toEqual({
      id: users.active.id,
      member_number: users.active.member_number,
      first_name: 'Nomactive',
      last_name: 'Exports',
      email: emails.active,
      phone_encrypted: ciphers.activePhone,
      dni_nie_encrypted: ciphers.activeDni,
      postal_code: '08221',
      ludoya_username: 'ax_ludoya',
      bgg_username: 'ax_bgg',
      role: 'member',
      newsletter_accepted: true,
      membership_start_date: '2020-03-01',
      current_joined_on: '2024-05-10',
      created_at: expect.any(String),
      total_rows: rows.length,
    })
    // every row carries the full count, so a caller can detect a truncated response
    expect(rows.every((r) => r.total_rows === rows.length)).toBe(true)
    // ordered by member number
    const numbers = rows.map((r) => r.member_number)
    expect(numbers).toEqual([...numbers].sort())

    const after = await entriesBy(users.board.id, 'export.members_csv')
    expect(after).toHaveLength(before.length + 1)
    expect(after.at(-1)).toMatchObject({
      actor_role: 'board',
      target_member_id: null,
      target_member_number: null,
      details: { filter: { state: 'active', role: 'all' }, rows: rows.length },
      reason: null,
    })
  })

  it('never includes a former member (BR-21) or an unconfirmed sign-up (BR-22)', async () => {
    const { data, error } = await exportAs(board, 'all')
    expect(error).toBeNull()
    const ids = (data as Row[]).map((r) => r.id)
    expect(ids).not.toContain(users.former.id)
    expect(ids).not.toContain(unconfirmedId)
  })

  it('filters by role, the legacy admin role counting as board, and logs the filter', async () => {
    const { data, error } = await exportAs(legacy, 'board')
    expect(error).toBeNull()
    const rows = data as Row[]
    const own = rows.filter((r) => userIds.includes(r.id)).map((r) => r.id).sort()
    expect(own).toEqual([users.board.id, users.legacy.id].sort())
    expect(rows.every((r) => r.role === 'board' || r.role === 'admin')).toBe(true)

    const members = (await exportAs(board, 'member')).data as Row[]
    expect(members.filter((r) => userIds.includes(r.id)).map((r) => r.id).sort()).toEqual(
      [users.member.id, users.active.id].sort()
    )

    const [entry] = (await entriesBy(users.legacy.id, 'export.members_csv')).slice(-1)
    expect(entry).toMatchObject({ actor_role: 'admin', details: { filter: { state: 'active', role: 'board' }, rows: rows.length } })
  })

  it('every export leaves its own entry', async () => {
    const before = await entriesBy(users.board.id, 'export.members_csv')
    const first = await exportAs(board)
    const second = await exportAs(board, 'superadmin')
    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    const added = (await entriesBy(users.board.id, 'export.members_csv')).slice(before.length)
    expect(added.map((e) => e.details)).toEqual([
      { filter: { state: 'active', role: 'all' }, rows: (first.data as Row[]).length },
      { filter: { state: 'active', role: 'superadmin' }, rows: (second.data as Row[]).length },
    ])
  })

  it('rejects an unknown role filter without logging', async () => {
    const before = await entriesBy(users.board.id, 'export.members_csv')
    for (const role of ['admin', 'former', 'Board', '']) {
      const { data, error } = await exportAs(board, role)
      expect(error?.code, role).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
      expect(data).toBeNull()
    }
    expect(await entriesBy(users.board.id, 'export.members_csv')).toHaveLength(before.length)
  })

  it('refuses a plain member, an anonymous caller and the service role, without logging', async () => {
    const asMember = await exportAs(member)
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toContain('admin:forbidden')
    expect(asMember.data).toBeNull()
    expect(await entriesBy(users.member.id, 'export.members_csv')).toEqual([])

    for (const client of [anon, supabaseAdmin]) {
      const { data, error } = await exportAs(client)
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('permission denied for function admin_export_members')
      expect(data).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_export_member_data() (A-11)', () => {
  const exportAs = (client: SupabaseClient, id: string) =>
    client.rpc('admin_export_member_data', { p_member_id: id })

  it('returns what the association holds about an active member and logs export.member_data', async () => {
    const { data, error } = await exportAs(board, users.active.id)
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        id: users.active.id,
        member_number: users.active.member_number,
        state: 'active',
        email: emails.active,
        first_name: 'Nomactive',
        last_name: 'Exports',
        phone_encrypted: ciphers.activePhone,
        dni_nie_encrypted: ciphers.activeDni,
        postal_code: '08221',
        ludoya_username: 'ax_ludoya',
        bgg_username: 'ax_bgg',
        role: 'member',
        newsletter_accepted: true,
        membership_start_date: '2020-03-01',
        current_joined_on: '2024-05-10',
        left_on: null,
        left_by: null,
        leave_reason: null,
        created_at: expect.any(String),
        badges: [{ key: 'ludoteca_donor', awarded_at: expect.any(String) }],
      },
    ])

    expect(await entriesFor(users.active.id, 'export.member_data')).toEqual([
      { id: expect.any(Number), actor_id: users.board.id, actor_role: 'board', details: { state: 'active' } },
    ])
  })

  it('a board member cannot export a former member\'s data (D-D, superadmin only)', async () => {
    const { data, error } = await exportAs(board, users.former.id)
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('admin:forbidden')
    expect(data).toBeNull()

    const asLegacy = await exportAs(legacy, users.former.id)
    expect(asLegacy.error?.code).toBe('42501')
    expect(await entriesFor(users.former.id, 'export.member_data')).toEqual([])
  })

  it('answers admin:not_found for an unknown member or an unconfirmed sign-up (BR-22), without logging', async () => {
    for (const id of [UNKNOWN_ID, unconfirmedId]) {
      const { data, error } = await exportAs(board, id)
      expect(error?.code, id).toBe('22023')
      expect(error?.message).toContain('admin:not_found')
      expect(data).toBeNull()
    }
    expect(await entriesFor(unconfirmedId, 'export.member_data')).toEqual([])
  })

  it('refuses a plain member, an anonymous caller and the service role', async () => {
    const asMember = await exportAs(member, users.active.id)
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toContain('admin:forbidden')

    for (const client of [anon, supabaseAdmin]) {
      const { error } = await exportAs(client, users.active.id)
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('permission denied for function admin_export_member_data')
    }
    expect(await entriesFor(users.active.id, 'export.member_data')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------------------------
describe('log_admin_event() no longer logs these exports', () => {
  it.each([
    ['export.members_csv', null, { filter: { state: 'active' }, rows: 3 }],
    ['export.member_data', 'active', {}],
  ] as const)('rejects %s (the export functions log it)', async (action, target, details) => {
    const { error } = await board.rpc('log_admin_event', {
      p_action: action,
      p_target: target ? users[target].id : null,
      p_details: details,
      p_reason: null,
    })
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('audit:action_not_allowed')
  })
})
