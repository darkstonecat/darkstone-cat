import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  createServiceClientAs,
  cleanupUsers,
  deleteTestUser,
} from '../helpers/supabase'

// Migration 20261005100100_roles_expand.sql: board/superadmin roles, role_since, role_rank(),
// has_role(), is_admin() on top of has_role('board'), and the role guard (BR-10, BR-11, BR-12).
// Role changes are written with the service role: authenticated users have no UPDATE grant on
// `role` (T1), and the audited role functions arrive in T8.
//
// This file is the only one that creates superadmins, so the superadmin count it asserts is
// stable while the other integration files run in parallel.

const password = 'password123'
const emails = {
  member: 'roles-member@test.local',
  board: 'roles-board@test.local',
  legacy: 'roles-legacy-admin@test.local',
  superA: 'roles-super-a@test.local',
  superB: 'roles-super-b@test.local',
  superC: 'roles-super-c@test.local',
  former: 'roles-former@test.local',
  alias: 'roles-alias@test.local',
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

async function setRole(id: string, role: string) {
  return supabaseAdmin.from('members').update({ role }).eq('id', id)
}

async function getRow(id: string) {
  const { data, error } = await supabaseAdmin
    .from('members')
    .select('role, role_since, left_on')
    .eq('id', id)
    .single()
  expect(error).toBeNull()
  return data!
}

async function countActiveSuperadmins() {
  const { count, error } = await supabaseAdmin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'superadmin')
    .is('left_on', null)
  expect(error).toBeNull()
  return count!
}

async function hasRole(key: Key, min: string) {
  const client = await createAuthenticatedClient(emails[key], password)
  const { data, error } = await client.rpc('has_role', { p_min: min })
  expect(error).toBeNull()
  return data
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: key, last_name: 'Roles' })
    userIds.push(users[key].id)
  }
  expect((await setRole(users.board.id, 'board')).error).toBeNull()
  expect((await setRole(users.legacy.id, 'admin')).error).toBeNull()
  expect((await setRole(users.alias.id, 'admin')).error).toBeNull()
  expect((await setRole(users.superA.id, 'superadmin')).error).toBeNull()
  expect((await setRole(users.superB.id, 'superadmin')).error).toBeNull()
  const { error } = await supabaseAdmin
    .from('members')
    .update({ left_on: '2026-10-01', left_by: 'self' })
    .eq('id', users.former.id)
  expect(error).toBeNull()
})

afterAll(() => cleanupUsers(userIds))

describe('role values', () => {
  it('accepts member, admin, board and superadmin', async () => {
    const { role } = await getRow(users.board.id)
    expect(role).toBe('board')
    expect((await getRow(users.superA.id)).role).toBe('superadmin')
    expect((await getRow(users.legacy.id)).role).toBe('admin')
  })

  it('rejects any other role', async () => {
    const { error } = await setRole(users.member.id, 'owner')
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('members_role_check')
  })
})

describe('has_role()', () => {
  it('a member has member but not board', async () => {
    expect(await hasRole('member', 'member')).toBe(true)
    expect(await hasRole('member', 'board')).toBe(false)
  })

  it('board has board but not superadmin', async () => {
    expect(await hasRole('board', 'board')).toBe(true)
    expect(await hasRole('board', 'superadmin')).toBe(false)
  })

  it('the legacy admin role counts as board', async () => {
    expect(await hasRole('legacy', 'board')).toBe(true)
    expect(await hasRole('legacy', 'superadmin')).toBe(false)
  })

  it('superadmin has board and superadmin', async () => {
    expect(await hasRole('superA', 'board')).toBe(true)
    expect(await hasRole('superA', 'superadmin')).toBe(true)
  })

  it('a former member has no role at all', async () => {
    expect(await hasRole('former', 'member')).toBe(false)
  })

  it('an unknown role name is never satisfied', async () => {
    expect(await hasRole('superA', 'owner')).toBe(false)
  })

  it('cannot be executed by anonymous clients', async () => {
    const { error } = await anon.rpc('has_role', { p_min: 'member' })
    expect(error).not.toBeNull()
  })
})

describe('is_admin() accepts board and superadmin', () => {
  it.each(['board', 'superA', 'legacy'] as const)('%s is admin and reads other members', async (key) => {
    const client = await createAuthenticatedClient(emails[key], password)
    expect((await client.rpc('is_admin')).data).toBe(true)

    const { data, error } = await client.from('members').select('id').eq('id', users.member.id)
    expect(error).toBeNull()
    expect(data).toEqual([{ id: users.member.id }])
  })

  it('a plain member is not admin and reads only their own row', async () => {
    const client = await createAuthenticatedClient(emails.member, password)
    expect((await client.rpc('is_admin')).data).toBe(false)

    const { data } = await client.from('members').select('id').eq('id', users.board.id)
    expect(data ?? []).toHaveLength(0)
  })

  it.each(['board', 'superA'] as const)('%s can list members and regenerate a card', async (key) => {
    const client = await createAuthenticatedClient(emails[key], password)

    const list = await client.rpc('get_all_members_for_admin')
    expect(list.error).toBeNull()
    expect(list.data!.some((m: { id: string }) => m.id === users.member.id)).toBe(true)

    const card = await client.rpc('regenerate_card_token', { target_member_id: users.member.id })
    expect(card.error).toBeNull()
    expect(card.data).toMatch(/^[0-9a-f]{32}$/)
  })

  it('a plain member still cannot regenerate a card', async () => {
    const client = await createAuthenticatedClient(emails.member, password)
    const { error } = await client.rpc('regenerate_card_token', { target_member_id: users.board.id })
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('admin:forbidden')
  })
})

describe('role_since', () => {
  it('is empty for a plain member', async () => {
    expect((await getRow(users.member.id)).role_since).toBeNull()
  })

  it('is set when a role is granted and cleared when it is removed', async () => {
    const before = Date.now()
    expect((await setRole(users.member.id, 'board')).error).toBeNull()
    const granted = await getRow(users.member.id)
    expect(granted.role_since).not.toBeNull()
    expect(new Date(granted.role_since!).getTime()).toBeGreaterThanOrEqual(before - 60_000)

    expect((await setRole(users.member.id, 'member')).error).toBeNull()
    expect((await getRow(users.member.id)).role_since).toBeNull()
  })

  it('moves when the rank changes', async () => {
    const { role_since: asBoard } = await getRow(users.board.id)
    expect((await setRole(users.board.id, 'superadmin')).error).toBeNull()
    const { role_since: asSuper } = await getRow(users.board.id)
    expect(asSuper).not.toBe(asBoard)
    // back to board (3 superadmins at this point, so BR-10 allows it)
    expect((await setRole(users.board.id, 'board')).error).toBeNull()
  })

  it('stays when the legacy admin alias becomes board (same rank)', async () => {
    const { role_since: asAdmin } = await getRow(users.alias.id)
    expect(asAdmin).not.toBeNull()
    expect((await setRole(users.alias.id, 'board')).error).toBeNull()
    const row = await getRow(users.alias.id)
    expect(row.role).toBe('board')
    expect(row.role_since).toBe(asAdmin)
  })
})

describe('BR-11: nobody changes their own role', () => {
  // createServiceClientAs runs with service-role privileges while auth.uid() is the user, the
  // way the SECURITY DEFINER role functions of T8 will run.
  it('a board member cannot change their own role, even with elevated privileges', async () => {
    const asBoard = createServiceClientAs(users.board.id)
    for (const role of ['member', 'superadmin']) {
      const { error } = await asBoard.from('members').update({ role }).eq('id', users.board.id)
      expect(error?.code).toBe('23514')
      expect(error?.message).toContain('role_guard:self_role_change')
    }
    expect((await getRow(users.board.id)).role).toBe('board')
  })

  it('the same caller can change another member\'s role', async () => {
    const asSuper = createServiceClientAs(users.superA.id)
    expect((await asSuper.from('members').update({ role: 'board' }).eq('id', users.member.id)).error).toBeNull()
    expect((await asSuper.from('members').update({ role: 'member' }).eq('id', users.member.id)).error).toBeNull()
  })

  it('a change of other columns of the own row is not a role change', async () => {
    const asBoard = createServiceClientAs(users.board.id)
    const { error } = await asBoard
      .from('members')
      .update({ role: 'board', postal_code: '08221' })
      .eq('id', users.board.id)
    expect(error).toBeNull()
  })
})

describe('BR-12: a former member cannot hold a role', () => {
  it('a role cannot be granted to a former member', async () => {
    const { error } = await setRole(users.former.id, 'board')
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:former_member_role')
    expect((await getRow(users.former.id)).role).toBe('member')
  })

  it('a member who holds a role cannot leave before losing it', async () => {
    const { error } = await supabaseAdmin
      .from('members')
      .update({ left_on: '2026-10-01', left_by: 'self' })
      .eq('id', users.board.id)
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:former_member_role')
    expect((await getRow(users.board.id)).left_on).toBeNull()
  })
})

describe('BR-10: at least two superadmins', () => {
  it('with two superadmins, neither can be demoted', async () => {
    expect(await countActiveSuperadmins()).toBe(2)
    const { error } = await setRole(users.superA.id, 'board')
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:last_superadmin')
    expect((await getRow(users.superA.id)).role).toBe('superadmin')
  })

  it('a promotion is always allowed, and with three one can step down', async () => {
    expect((await setRole(users.superC.id, 'superadmin')).error).toBeNull()
    expect(await countActiveSuperadmins()).toBe(3)

    expect((await setRole(users.superA.id, 'board')).error).toBeNull()
    expect(await countActiveSuperadmins()).toBe(2)
  })

  it('with a single superadmin, demoting them is blocked too (it would leave fewer than two)', async () => {
    await deleteTestUser(users.superC.id)
    expect(await countActiveSuperadmins()).toBe(1)

    const { error } = await setRole(users.superB.id, 'member')
    expect(error?.message).toContain('role_guard:last_superadmin')

    // bootstrap: promoting a second superadmin works with only one left
    expect((await setRole(users.superA.id, 'superadmin')).error).toBeNull()
    expect(await countActiveSuperadmins()).toBe(2)
  })
})

// Audit log cases that need a superadmin (migration 20261005100200_audit_log.sql). They live here
// because this is the only file allowed to create superadmins; the rest is in audit-log.test.ts.
// At this point superA and superB are the two active superadmins.
describe('audit log as a superadmin', () => {
  it('a superadmin logs the register export (superadmin only) and reads the log', async () => {
    const client = await createAuthenticatedClient(emails.superA, password)
    const { data: id, error } = await client.rpc('log_admin_event', {
      p_action: 'export.member_register',
      p_target: null,
      p_details: { rows: 12 },
      p_reason: null,
    })
    expect(error).toBeNull()

    const { data, error: readError } = await client
      .from('audit_log')
      .select('action, actor_id, actor_role, details')
      .eq('id', id)
    expect(readError).toBeNull()
    expect(data).toEqual([
      { action: 'export.member_register', actor_id: users.superA.id, actor_role: 'superadmin', details: { rows: 12 } },
    ])
  })

  // admin_reveal_sensitive() (20261005100500_member_admin_mutations.sql): the rest of A-5 is in
  // member-admin-mutations.test.ts.
  it('a superadmin reveals a former member\'s DNI only with a reason of 10+ characters (BR-21)', async () => {
    const cipher = 'AAAAAAAAAAAAAAAA:BBBBBBBBBBBBBBBBBBBBBB==:Q0lQSEVS'
    expect((await supabaseAdmin.from('members').update({ dni_nie_encrypted: cipher }).eq('id', users.former.id)).error).toBeNull()
    const client = await createAuthenticatedClient(emails.superA, password)
    const reveal = (field: string, reason: string | null) =>
      client.rpc('admin_reveal_sensitive', { p_member_id: users.former.id, p_field: field, p_reason: reason })
    const entries = async () =>
      (
        await supabaseAdmin
          .from('audit_log')
          .select('actor_id, actor_role, details, reason')
          .eq('target_member_id', users.former.id)
          .eq('action', 'member.reveal_sensitive')
          .order('id')
      ).data!

    for (const reason of [null, '   ', '  123456789  ']) {
      const { data, error } = await reveal('dni', reason)
      expect(error?.code, String(reason)).toBe('22023')
      expect(error?.message).toContain('admin:reason_required')
      expect(data).toBeNull()
    }

    const phone = await reveal('phone', 'Requeriment escrit del jutjat')
    expect(phone.error?.code).toBe('22023')
    expect(phone.error?.message).toContain('admin:invalid_argument')
    expect(await entries()).toEqual([])

    const { data, error } = await reveal('dni', '  Requeriment escrit  ')
    expect(error).toBeNull()
    expect(data).toBe(cipher)
    expect(await entries()).toEqual([
      { actor_id: users.superA.id, actor_role: 'superadmin', details: { field: 'dni' }, reason: 'Requeriment escrit' },
    ])
  })
})

// Leave cases that need a superadmin (migration 20261005100400_membership_lifecycle.sql). The
// rest is in membership-lifecycle.test.ts. superA and superB are still the two active
// superadmins here.
describe('a superadmin cannot leave (BR-10, BR-12)', () => {
  it('dropping the role and leaving in one UPDATE is blocked by BR-10', async () => {
    expect(await countActiveSuperadmins()).toBe(2)
    const { error } = await supabaseAdmin
      .from('members')
      .update({ role: 'member', left_on: '2026-10-01', left_by: 'self' })
      .eq('id', users.superB.id)
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:last_superadmin')
    expect(await getRow(users.superB.id)).toMatchObject({ role: 'superadmin', left_on: null })
  })

  it('member_leave_self and admin_member_leave refuse a superadmin (role_held)', async () => {
    const superB = await createAuthenticatedClient(emails.superB, password)
    const self = await superB.rpc('member_leave_self', { p_reason: null })
    expect(self.error?.message).toContain('membership:role_held')

    const superA = await createAuthenticatedClient(emails.superA, password)
    const other = await superA.rpc('admin_member_leave', { p_member_id: users.superB.id, p_reason: 'Decisió de la junta' })
    expect(other.error?.message).toContain('membership:role_held')

    expect(await getRow(users.superB.id)).toMatchObject({ role: 'superadmin', left_on: null })
    expect(await countActiveSuperadmins()).toBe(2)
  })
})
