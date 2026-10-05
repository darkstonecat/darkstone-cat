import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261005100300_admin_read_rpcs.sql: the read-only functions behind the admin
// screens V-1 (admin_stats), V-2 (admin_list_members), V-3 (admin_get_member) and V-4
// (admin_list_activity).
//
// Integration files run in parallel on one database, so nothing here counts the whole table:
// lists are narrowed to this file's fixtures (their e-mail domain or names), period stats use
// a reference date in 1999 that no other test touches, and the "now" stats are measured as a
// delta around a change to this file's own users (retried when another file interferes).
// Superadmins are never created here (roles.test.ts asserts their global count).

const password = 'password123'
const DOMAIN = 'admin-read.test'
const emails = {
  member: `rpc-member@${DOMAIN}`,
  board: `rpc-board@${DOMAIN}`,
  legacy: `rpc-legacy@${DOMAIN}`,
  angel: `rpc-angel@${DOMAIN}`,
  bruna: `rpc-bruna@${DOMAIN}`,
  percent: `rpc-percent@${DOMAIN}`,
  former: `rpc-former@${DOMAIN}`,
  stub: `rpc-stub@${DOMAIN}`,
  purged: `rpc-purged@${DOMAIN}`,
  flip1: `rpc-flip1@${DOMAIN}`,
  flip2: `rpc-flip2@${DOMAIN}`,
  flip3: `rpc-flip3@${DOMAIN}`,
}
const names: Record<keyof typeof emails, [string, string]> = {
  member: ['Carles', 'Ruixqvt'],
  board: ['Dolors', 'Ruixqvt'],
  legacy: ['Enric', 'Ruixqvt'],
  angel: ['Àngel', 'Ruixqvt'],
  bruna: ['Bruna', 'Ruixqvt'],
  percent: ['Pere', 'Ruix%vt'],
  former: ['Fina', 'Ruixqvt'],
  stub: ['Gil', 'Stubqvt'],
  purged: ['Hug', 'Purgqvt'],
  flip1: ['Flip', 'Uno'],
  flip2: ['Flip', 'Dos'],
  flip3: ['Flip', 'Tres'],
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string; member_number: string }>
const clients = {} as Record<'member' | 'board' | 'legacy', SupabaseClient>
const userIds: string[] = []
let unconfirmed: { id: string; member_number: string }

// Fake ciphertexts: they must never come back from any of these functions.
const DNI_CIPHER = 'aaaa1111:bbbb2222:cccc3333dni'
const PHONE_CIPHER = 'dddd4444:eeee5555:ffff6666phone'

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

async function memberNumber(id: string) {
  const { data } = await supabaseAdmin.from('members').select('member_number').eq('id', id).single()
  return data!.member_number as string
}

type ListArgs = {
  p_state?: string | null
  p_role?: string | null
  p_q?: string | null
  p_sort?: string | null
  p_limit?: number | null
  p_offset?: number | null
}
type ListRow = {
  id: string
  member_number: string
  first_name: string
  last_name: string
  email: string | null
  state: 'active' | 'former'
  left_on: string | null
  role: string
  current_joined_on: string
  total_count: number
  [key: string]: unknown
}

async function list(args: ListArgs, client: SupabaseClient = clients.board) {
  const { data, error } = await client.rpc('admin_list_members', {
    p_state: null,
    p_role: null,
    p_q: null,
    p_sort: null,
    p_limit: null,
    p_offset: null,
    ...args,
  })
  expect(error).toBeNull()
  return data as ListRow[]
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

async function stats(client: SupabaseClient = clients.board, reference: string | null = null) {
  const { data, error } = await client.rpc('admin_stats', { p_reference_date: reference })
  expect(error).toBeNull()
  expect(data).toHaveLength(1)
  return (data as Record<string, number>[])[0]
}

type ActivityArgs = {
  p_action?: string | null
  p_actor?: string | null
  p_actor_kind?: string | null
  p_target?: string | null
  p_target_number?: string | null
  p_from?: string | null
  p_to?: string | null
  p_limit?: number | null
  p_before_id?: number | null
}
type ActivityRow = {
  id: number
  created_at: string
  actor_id: string | null
  actor_role: string | null
  actor_name: string | null
  action: string
  target_member_id: string | null
  target_member_number: string | null
  target_name: string | null
  details: Record<string, unknown>
  reason: string | null
  total_count: number
}

async function activity(args: ActivityArgs, client: SupabaseClient = clients.board) {
  const { data, error } = await client.rpc('admin_list_activity', {
    p_action: null,
    p_actor: null,
    p_actor_kind: null,
    p_target: null,
    p_target_number: null,
    p_from: null,
    p_to: null,
    p_limit: null,
    p_before_id: null,
    ...args,
  })
  expect(error).toBeNull()
  return data as ActivityRow[]
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    const [first_name, last_name] = names[key]
    const user = await createTestUser(emails[key], password, { first_name, last_name })
    users[key] = { id: user.id, member_number: await memberNumber(user.id) }
    userIds.push(user.id)
  }

  await update(users.board.id, { role: 'board' })
  await update(users.legacy.id, { role: 'admin' })
  await update(users.member.id, {
    postal_code: '08221',
    ludoya_username: 'carlesq',
    bgg_username: 'carlesbgg',
    newsletter_accepted: true,
    dni_nie_encrypted: DNI_CIPHER,
    phone_encrypted: PHONE_CIPHER,
  })
  // A former member whose leave left data behind (the leave function of T6 deletes it): the
  // admin file must still not show it (BR-20, BR-21).
  await update(users.former.id, {
    left_on: '2026-09-15',
    left_by: 'board',
    leave_reason: 'Compte duplicat',
    postal_code: '08222',
    ludoya_username: 'finaq',
    dni_nie_encrypted: DNI_CIPHER,
    phone_encrypted: PHONE_CIPHER,
  })
  // A former member whose login account was deleted (anonymisation): the stub survives.
  await update(users.stub.id, { left_on: '2026-08-01', left_by: 'self', anonymised_at: new Date().toISOString() })
  expect((await supabaseAdmin.auth.admin.deleteUser(users.stub.id)).error).toBeNull()
  // A purged stub: never listed, never shown.
  await update(users.purged.id, { left_on: '2023-01-01', left_by: 'self', purged_at: new Date().toISOString() })

  // A sign-up whose e-mail was never confirmed is not a member (BR-22).
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: `rpc-unconfirmed@${DOMAIN}`,
    password,
    email_confirm: false,
    user_metadata: { first_name: 'Ivet', last_name: 'Ruixqvt' },
  })
  expect(error).toBeNull()
  unconfirmed = { id: created.user!.id, member_number: await memberNumber(created.user!.id) }
  userIds.push(unconfirmed.id)

  clients.member = await createAuthenticatedClient(emails.member, password)
  clients.board = await createAuthenticatedClient(emails.board, password)
  clients.legacy = await createAuthenticatedClient(emails.legacy, password)
})

afterAll(async () => {
  // Entries older than 3 years are the only ones the owner may delete (the 1999 fixtures).
  await runSqlAsPostgres(
    `delete from public.audit_log where created_at < '2000-06-01' and target_member_id = any($1::uuid[])`,
    [userIds]
  )
  await cleanupUsers(userIds)
})

describe('who may call the admin read functions', () => {
  const calls: [string, Record<string, unknown>][] = [
    ['admin_list_members', { p_state: null, p_role: null, p_q: null, p_sort: null, p_limit: null, p_offset: null }],
    ['admin_get_member', { p_member_number: '000-001' }],
    ['admin_stats', { p_reference_date: null }],
    [
      'admin_list_activity',
      {
        p_action: null,
        p_actor: null,
        p_actor_kind: null,
        p_target: null,
        p_target_number: null,
        p_from: null,
        p_to: null,
        p_limit: 1,
        p_before_id: null,
      },
    ],
  ]

  it.each(calls)('%s refuses a plain member with admin:forbidden', async (fn, args) => {
    const { error } = await clients.member.rpc(fn, args)
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('admin:forbidden')
  })

  it.each(calls)('%s is not executable by anon or the service role', async (fn, args) => {
    for (const client of [anon, supabaseAdmin]) {
      const { error } = await client.rpc(fn, args)
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('permission denied')
    }
  })

  it.each(calls)('%s answers a board member and a legacy admin', async (fn, args) => {
    for (const client of [clients.board, clients.legacy]) {
      const { error } = await client.rpc(fn, args)
      expect(error).toBeNull()
    }
  })

  it('refuses a board member once they have left (has_role needs an active membership)', async () => {
    await update(users.legacy.id, { role: 'member' })
    await update(users.legacy.id, { left_on: '2026-10-01', left_by: 'self' })
    try {
      const { error } = await clients.legacy.rpc('admin_stats', { p_reference_date: null })
      expect(error?.message).toContain('admin:forbidden')
    } finally {
      await update(users.legacy.id, { left_on: null, left_by: null })
      await update(users.legacy.id, { role: 'admin' })
    }
  })
})

describe('admin_list_members()', () => {
  it('defaults to active members and hides unconfirmed sign-ups and purged stubs', async () => {
    const rows = await list({ p_q: 'qvt' })
    const found = ids(rows)
    expect(found).toEqual(
      expect.arrayContaining([users.member.id, users.board.id, users.legacy.id, users.angel.id, users.bruna.id])
    )
    expect(found).not.toContain(users.former.id)
    expect(found).not.toContain(users.stub.id)
    expect(found).not.toContain(users.purged.id)
    expect(found).not.toContain(unconfirmed.id)
    expect(rows.every((r) => r.state === 'active' && r.left_on === null)).toBe(true)

    const all = ids(await list({ p_state: 'all', p_q: 'qvt' }))
    expect(all).not.toContain(users.purged.id)
    expect(all).not.toContain(unconfirmed.id)
  })

  it('filters by state', async () => {
    const former = await list({ p_state: 'former', p_q: 'qvt' })
    expect(ids(former)).toEqual(expect.arrayContaining([users.former.id, users.stub.id]))
    expect(ids(former)).not.toContain(users.member.id)
    expect(former.every((r) => r.state === 'former' && r.left_on !== null)).toBe(true)

    const all = ids(await list({ p_state: 'all', p_q: 'qvt' }))
    expect(all).toEqual(expect.arrayContaining([users.member.id, users.former.id, users.stub.id]))
  })

  it('lists a former member whose login account was deleted, with no e-mail', async () => {
    const [row] = await list({ p_state: 'former', p_q: 'stubqvt' })
    expect(row).toMatchObject({
      id: users.stub.id,
      member_number: users.stub.member_number,
      first_name: 'Gil',
      email: null,
      has_login: false,
      state: 'former',
      left_on: '2026-08-01',
    })
  })

  it('filters by role; board includes the legacy admin role', async () => {
    const board = ids(await list({ p_role: 'board', p_q: DOMAIN }))
    expect(board.sort()).toEqual([users.board.id, users.legacy.id].sort())

    const members = ids(await list({ p_role: 'member', p_q: DOMAIN }))
    expect(members).toContain(users.member.id)
    expect(members).not.toContain(users.board.id)

    expect(await list({ p_role: 'superadmin', p_q: DOMAIN })).toEqual([])
  })

  it('searches names (accent-insensitive), member number and e-mail', async () => {
    expect(ids(await list({ p_q: 'angel ruixqvt' }))).toEqual([users.angel.id])
    expect(ids(await list({ p_q: 'ÀNGEL' }))).toContain(users.angel.id)
    expect(ids(await list({ p_q: users.bruna.member_number }))).toEqual([users.bruna.id])
    expect(ids(await list({ p_q: 'rpc-bruna@' }))).toEqual([users.bruna.id])
    expect(ids(await list({ p_q: 'carlesq' }))).toEqual([users.member.id])
  })

  it('treats % and _ in the search as literal characters', async () => {
    expect(ids(await list({ p_q: 'ruix%vt' }))).toEqual([users.percent.id])
    expect(await list({ p_q: 'ruix_vt' })).toEqual([])
  })

  it('sorts by a whitelisted key and rejects anything else', async () => {
    const byNumber = await list({ p_q: DOMAIN, p_sort: 'number_asc' })
    const numbers = byNumber.map((r) => Number(r.member_number.replace(/\D/g, '')))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))

    const desc = await list({ p_q: DOMAIN, p_sort: 'number_desc' })
    expect(ids(desc)).toEqual(ids(byNumber).reverse())

    // Àngel sorts before Bruna once accents are folded
    const byName = (await list({ p_q: 'ruixqvt', p_sort: 'name_asc' })).map((r) => r.first_name)
    expect(byName.slice(0, 2)).toEqual(['Àngel', 'Bruna'])
    const byNameDesc = (await list({ p_q: 'ruixqvt', p_sort: 'name_desc' })).map((r) => r.first_name)
    expect(byNameDesc).toEqual([...byName].reverse())

    for (const sort of ['joined_asc', 'joined_desc', 'left_asc', 'left_desc']) {
      expect((await list({ p_state: 'all', p_q: DOMAIN, p_sort: sort })).length).toBeGreaterThan(0)
    }

    const { error } = await clients.board.rpc('admin_list_members', {
      p_state: null,
      p_role: null,
      p_q: null,
      p_sort: 'member_number; drop table public.members',
      p_limit: null,
      p_offset: null,
    })
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:invalid_argument')
  })

  it('rejects an unknown state or role', async () => {
    for (const args of [{ p_state: 'deleted' }, { p_role: 'owner' }]) {
      const { error } = await clients.board.rpc('admin_list_members', {
        p_state: null,
        p_role: null,
        p_q: null,
        p_sort: null,
        p_limit: null,
        p_offset: null,
        ...args,
      })
      expect(error?.code).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
    }
  })

  it('paginates with a total count and caps the page size', async () => {
    const everything = await list({ p_state: 'all', p_q: DOMAIN })
    // confirmed fixtures with an e-mail in this domain: all but the stub (no login), the purged
    // stub and the unconfirmed sign-up
    expect(everything).toHaveLength(Object.keys(emails).length - 2)
    expect(everything.every((r) => r.total_count === everything.length)).toBe(true)

    const first = await list({ p_state: 'all', p_q: DOMAIN, p_limit: 2 })
    const second = await list({ p_state: 'all', p_q: DOMAIN, p_limit: 2, p_offset: 2 })
    expect(ids(first)).toEqual(ids(everything).slice(0, 2))
    expect(ids(second)).toEqual(ids(everything).slice(2, 4))
    expect(first[0].total_count).toBe(everything.length)

    const huge = await list({ p_state: 'all', p_limit: 100000 })
    expect(huge.length).toBeLessThanOrEqual(200)
    if (huge.length > 0) expect(huge[0].total_count).toBeGreaterThanOrEqual(huge.length)
  })

  it('never returns DNI or phone values or ciphertext', async () => {
    const rows = await list({ p_state: 'all', p_q: DOMAIN })
    const json = JSON.stringify(rows)
    expect(json).not.toContain(DNI_CIPHER)
    expect(json).not.toContain(PHONE_CIPHER)
    expect(Object.keys(rows[0])).not.toEqual(expect.arrayContaining(['dni_nie_encrypted']))
    expect(Object.keys(rows[0])).not.toEqual(expect.arrayContaining(['phone_encrypted']))
  })
})

describe('admin_get_member()', () => {
  async function getMember(number: string) {
    const { data, error } = await clients.board.rpc('admin_get_member', { p_member_number: number })
    expect(error).toBeNull()
    return data as Record<string, unknown>[]
  }

  beforeAll(async () => {
    const { error } = await supabaseAdmin.from('member_badges').insert([
      { member_id: users.member.id, badge_key: 'ludoteca_donor', awarded_by: users.board.id },
      { member_id: users.former.id, badge_key: 'volunteer_egara_joga', awarded_by: users.board.id },
    ])
    expect(error).toBeNull()
  })

  it('returns the full file of an active member, with only whether DNI/phone exist', async () => {
    const rows = await getMember(users.member.member_number)
    expect(rows).toHaveLength(1)
    const m = rows[0]
    expect(m).toMatchObject({
      id: users.member.id,
      member_number: users.member.member_number,
      state: 'active',
      first_name: 'Carles',
      last_name: 'Ruixqvt',
      email: emails.member,
      has_login: true,
      role: 'member',
      role_since: null,
      postal_code: '08221',
      ludoya_username: 'carlesq',
      bgg_username: 'carlesbgg',
      newsletter_accepted: true,
      has_dni: true,
      has_phone: true,
      left_on: null,
      left_by: null,
      leave_reason: null,
      purge_on: null,
      card_valid: true,
    })
    expect(m.membership_start_date).toEqual(expect.any(String))
    expect(m.current_joined_on).toEqual(expect.any(String))
    expect(m.card_issued_at).toEqual(expect.any(String))
    expect(m.badges).toEqual([
      expect.objectContaining({
        badge_key: 'ludoteca_donor',
        awarded_by: users.board.id,
        awarded_by_name: 'Dolors Ruixqvt',
      }),
    ])
  })

  it('returns only the register fields of a former member (BR-20, BR-21)', async () => {
    const [m] = await getMember(users.former.member_number)
    expect(m).toMatchObject({
      id: users.former.id,
      state: 'former',
      first_name: 'Fina',
      email: emails.former,
      has_login: true,
      role: 'member',
      left_on: '2026-09-15',
      left_by: 'board',
      leave_reason: 'Compte duplicat',
      purge_on: '2029-09-15',
      has_dni: true,
      card_valid: false,
      postal_code: null,
      ludoya_username: null,
      bgg_username: null,
      newsletter_accepted: null,
      has_phone: null,
    })
    expect(m.badges).toEqual([expect.objectContaining({ badge_key: 'volunteer_egara_joga' })])
  })

  it('shows an anonymised stub without a login account', async () => {
    const [m] = await getMember(users.stub.member_number)
    expect(m).toMatchObject({ state: 'former', email: null, has_login: false, purge_on: '2029-08-01' })
    expect(m.anonymised_at).toEqual(expect.any(String))
  })

  it('returns nothing for an unknown number, a purged stub or an unconfirmed sign-up', async () => {
    expect(await getMember('999-999')).toEqual([])
    expect(await getMember(users.purged.member_number)).toEqual([])
    expect(await getMember(unconfirmed.member_number)).toEqual([])
  })

  it('never returns DNI or phone values or ciphertext', async () => {
    const json = JSON.stringify([
      ...(await getMember(users.member.member_number)),
      ...(await getMember(users.former.member_number)),
    ])
    expect(json).not.toContain(DNI_CIPHER)
    expect(json).not.toContain(PHONE_CIPHER)
    expect(json).not.toContain('_encrypted')
  })
})

describe('admin_stats()', () => {
  it('counts the current membership, ignoring unconfirmed sign-ups', async () => {
    const keys = ['active_members', 'former_members', 'newsletter_members', 'board_members', 'superadmins']
    const expected = { active_members: -1, former_members: 1, newsletter_members: 1, board_members: 1, superadmins: 0 }
    let delta: Record<string, number> = {}
    let pending: string | null = null

    // Other files create and delete users in parallel; retry when they land inside the window.
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = await stats()
      await update(users.flip1.id, { newsletter_accepted: true })
      await update(users.flip2.id, { role: 'board' })
      await update(users.flip3.id, { left_on: '2026-10-02', left_by: 'self' })
      const { data } = await supabaseAdmin.auth.admin.createUser({
        email: `rpc-unconfirmed-stats@${DOMAIN}`,
        password,
        email_confirm: false,
      })
      pending = data.user?.id ?? null
      const after = await stats()

      await update(users.flip1.id, { newsletter_accepted: false })
      await update(users.flip2.id, { role: 'member' })
      await update(users.flip3.id, { left_on: null, left_by: null })
      if (pending) await cleanupUsers([pending])

      delta = Object.fromEntries(keys.map((k) => [k, after[k] - before[k]]))
      if (keys.every((k) => delta[k] === expected[k as keyof typeof expected])) break
    }
    expect(delta).toEqual(expected)
  })

  it('counts joins, leaves and rejoins of the reference month and year (Madrid time)', async () => {
    const reference = '1999-07-15'
    const before = await stats(clients.board, reference)

    await update(users.flip1.id, { membership_start_date: '1999-07-03', current_joined_on: '1999-07-03' })
    // a purged stub keeps its dates, so it still counts as a join of that month
    await update(users.purged.id, { membership_start_date: '1999-07-20' })
    // not a member: never counted (BR-22)
    await update(unconfirmed.id, { membership_start_date: '1999-07-05' })
    await update(users.stub.id, { left_on: '1999-07-10', left_by: 'self' })
    await update(users.former.id, { left_on: '1999-07-11' }) // left_by board
    // rejoins come from the audit log: the year starts at midnight in Madrid
    const rejoins = [
      '1999-03-01T10:00:00+01:00',
      '1999-01-01T00:30:00+01:00', // 1998-12-31 23:30 UTC, already 1999 in Madrid
      '1998-12-31T23:30:00+01:00', // still 1998 in Madrid
    ]
    for (const at of rejoins) {
      const { error } = await runSqlAsPostgres(
        `insert into public.audit_log (created_at, action, target_member_id, target_member_number)
         values ($1::timestamptz, 'membership.rejoin', $2::uuid, $3)`,
        [at, users.flip1.id, users.flip1.member_number]
      )
      expect(error).toBeNull()
    }

    try {
      const after = await stats(clients.board, reference)
      expect(after.joined_this_month - before.joined_this_month).toBe(2)
      expect(after.left_this_month - before.left_this_month).toBe(2)
      expect(after.left_this_month_self - before.left_this_month_self).toBe(1)
      expect(after.left_this_month_board - before.left_this_month_board).toBe(1)
      expect(after.rejoined_this_year - before.rejoined_this_year).toBe(2)
    } finally {
      await update(users.flip1.id, { membership_start_date: '2026-10-05', current_joined_on: '2026-10-05' })
      await update(users.stub.id, { left_on: '2026-08-01' })
      await update(users.former.id, { left_on: '2026-09-15' })
    }
  })
})

describe('admin_list_activity()', () => {
  const written: number[] = []

  async function log(client: SupabaseClient, action: string, target: string | null, details = {}) {
    const { data, error } = await client.rpc('log_admin_event', {
      p_action: action,
      p_target: target,
      p_details: details,
      p_reason: null,
    })
    expect(error).toBeNull()
    written.push(data as number)
    return data as number
  }

  beforeAll(async () => {
    await log(clients.board, 'export.member_data', users.angel.id)
    await log(clients.board, 'export.member_data', users.angel.id)
    await log(clients.board, 'member.reveal_sensitive', users.angel.id, { field: 'dni' })
    await log(clients.board, 'export.member_data', users.angel.id)
    await log(clients.legacy, 'export.member_data', users.bruna.id)
    await log(clients.board, 'export.member_data', users.former.id)

    // A system entry and a member acting on themselves, backdated so they can be deleted later
    for (const [at, actor, action] of [
      ['1999-05-01T10:00:00Z', null, 'member.purge'],
      ['1999-05-02T10:00:00Z', users.angel.id, 'membership.leave'],
    ] as const) {
      const { error } = await runSqlAsPostgres(
        `insert into public.audit_log (created_at, actor_id, action, target_member_id, target_member_number)
         values ($1::timestamptz, $2::uuid, $3, $4::uuid, $5)`,
        [at, actor, action, users.angel.id, users.angel.member_number]
      )
      expect(error).toBeNull()
    }
  })

  it('filters by target member and orders newest first', async () => {
    const rows = await activity({ p_target: users.angel.id })
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => r.target_member_id === users.angel.id)).toBe(true)
    const keys = rows.map((r) => [new Date(r.created_at).getTime(), r.id])
    const sorted = [...keys].sort((a, b) => b[0] - a[0] || b[1] - a[1])
    expect(keys).toEqual(sorted)
    expect(rows[0]).toMatchObject({
      actor_id: users.board.id,
      actor_role: 'board',
      actor_name: 'Dolors Ruixqvt',
      target_member_number: users.angel.member_number,
      target_name: 'Àngel Ruixqvt',
      total_count: 6,
    })

    expect(await activity({ p_target_number: users.angel.member_number })).toHaveLength(6)
  })

  it('filters by action key or action group', async () => {
    const reveal = await activity({ p_target: users.angel.id, p_action: 'member.reveal_sensitive' })
    expect(reveal).toHaveLength(1)
    expect(reveal[0].details).toEqual({ field: 'dni' })

    expect(await activity({ p_target: users.angel.id, p_action: 'export.*' })).toHaveLength(3)
    expect(await activity({ p_target: users.angel.id, p_action: 'membership.*' })).toHaveLength(1)
    expect(await activity({ p_target: users.angel.id, p_action: 'export.%' })).toEqual([])
  })

  it('filters by actor, system and self', async () => {
    const legacy = await activity({ p_actor: users.legacy.id, p_target: users.bruna.id })
    expect(legacy).toHaveLength(1)
    expect(legacy[0]).toMatchObject({ actor_role: 'admin', action: 'export.member_data' })

    const system = await activity({ p_actor_kind: 'system', p_target: users.angel.id })
    expect(system.map((r) => r.action)).toEqual(['member.purge'])
    expect(system[0].actor_id).toBeNull()

    const self = await activity({ p_actor_kind: 'self', p_target: users.angel.id })
    expect(self.map((r) => r.action)).toEqual(['membership.leave'])

    const { error } = await clients.board.rpc('admin_list_activity', {
      p_action: null,
      p_actor: null,
      p_actor_kind: 'robot',
      p_target: null,
      p_target_number: null,
      p_from: null,
      p_to: null,
      p_limit: null,
      p_before_id: null,
    })
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:invalid_argument')
  })

  it('filters by a half-open date range', async () => {
    const old = await activity({ p_target: users.angel.id, p_from: '1999-01-01T00:00:00Z', p_to: '2000-01-01T00:00:00Z' })
    expect(old).toHaveLength(2)
    const exact = await activity({ p_target: users.angel.id, p_from: '1999-05-01T10:00:00Z', p_to: '1999-05-02T10:00:00Z' })
    expect(exact.map((r) => r.action)).toEqual(['member.purge'])
    expect(await activity({ p_target: users.angel.id, p_from: new Date(Date.now() + 3600_000).toISOString() })).toEqual([])
  })

  it('pages with a keyset cursor on (created_at desc, id desc)', async () => {
    const all = await activity({ p_target: users.angel.id })
    const page1 = await activity({ p_target: users.angel.id, p_limit: 4 })
    const page2 = await activity({ p_target: users.angel.id, p_limit: 4, p_before_id: page1[3].id })
    expect(page1.map((r) => r.id)).toEqual(all.slice(0, 4).map((r) => r.id))
    expect(page2.map((r) => r.id)).toEqual(all.slice(4).map((r) => r.id))
    expect(page2[0].total_count).toBe(6)
  })

  it('shows an anonymised target by member number only', async () => {
    const rows = await activity({ p_target: users.former.id })
    expect(rows[0].target_name).toBe('Fina Ruixqvt')
    await update(users.former.id, { anonymised_at: new Date().toISOString() })
    try {
      const [anonymised] = await activity({ p_target: users.former.id })
      expect(anonymised).toMatchObject({ target_member_number: users.former.member_number, target_name: null })
    } finally {
      await update(users.former.id, { anonymised_at: null })
    }
  })

  it('caps the page size', async () => {
    const rows = await activity({ p_limit: 100000 })
    expect(rows.length).toBeLessThanOrEqual(200)
  })
})
