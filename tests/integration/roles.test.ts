import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  createServiceClientAs,
  cleanupUsers,
  forceDemoteForTests,
} from '../helpers/supabase'
import { fakeMemberCipher } from '../helpers/cipher'

// The T11b server actions run here too (they need superadmins): only the session client factory
// and next/cache are mocked, so the actions call the T8 functions with a real user JWT.
const session = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { anonymiseMember, setMemberRole } from '@/lib/admin/superadmin-actions'

// Migration 20261005100100_roles_expand.sql: board/superadmin roles, role_since, role_rank(),
// has_role(), is_admin() on top of has_role('board'), and the role guard (BR-10, BR-11, BR-12).
// Fixture role changes are written with the service role: authenticated users have no UPDATE
// grant on `role` (T1). The audited role functions (T8) are tested at the end of the file.
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
  target: 'roles-target@test.local',
  erased: 'roles-erased@test.local',
  purged: 'roles-purged@test.local',
  actBoard: 'roles-action-board@test.local',
  actTarget: 'roles-action-target@test.local',
  actFormer: 'roles-action-former@test.local',
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

  // A former member who asked for erasure (S-3): board leave with a reason, a DNI, badges and a
  // leftover username (a legacy row; a leave normally clears it).
  const erased = await supabaseAdmin
    .from('members')
    .update({
      left_on: '2026-09-15',
      left_by: 'board',
      leave_reason: 'Sol·licitud de supressió',
      dni_nie_encrypted: fakeMemberCipher(users.erased.id),
      ludoya_username: 'erased_player',
    })
    .eq('id', users.erased.id)
  expect(erased.error).toBeNull()
  // A purged stub (§4.5): never in the llibre de socis (S-4).
  const purged = await supabaseAdmin
    .from('members')
    .update({ left_on: '2022-03-01', left_by: 'self', purged_at: '2025-03-02T03:00:00Z' })
    .eq('id', users.purged.id)
  expect(purged.error).toBeNull()
  const badges = await supabaseAdmin.from('member_badges').insert([
    { member_id: users.erased.id, badge_key: 'ludoteca_donor' },
    { member_id: users.erased.id, badge_key: 'volunteer_egara_joga' },
  ])
  expect(badges.error).toBeNull()
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
  // T7b: being admin no longer opens other members' rows to direct reads (admins_select_all is
  // gone); board screens read through SECURITY DEFINER functions.
  it.each(['board', 'superA', 'legacy'] as const)('%s is admin but reads only its own row directly', async (key) => {
    const client = await createAuthenticatedClient(emails[key], password)
    expect((await client.rpc('is_admin')).data).toBe(true)

    const { data, error } = await client.from('members').select('id').eq('id', users.member.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('a plain member is not admin and reads only their own row', async () => {
    const client = await createAuthenticatedClient(emails.member, password)
    expect((await client.rpc('is_admin')).data).toBe(false)

    const { data } = await client.from('members').select('id').eq('id', users.board.id)
    expect(data ?? []).toHaveLength(0)
  })

  it.each(['board', 'superA'] as const)('%s can regenerate a card but not call the service-role member list', async (key) => {
    const client = await createAuthenticatedClient(emails[key], password)

    const list = await client.rpc('get_all_members_for_admin')
    expect(list.error?.code).toBe('42501')

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

  // Migration 20261005100600_roles_and_anonymise.sql: the role guard also covers DELETE (BR-10,
  // BR-12, BR-16). superB and superC are the two active superadmins here.
  it('deleting a superadmin\'s account is blocked while it would leave fewer than two', async () => {
    expect(await countActiveSuperadmins()).toBe(2)

    const viaAuth = await supabaseAdmin.auth.admin.deleteUser(users.superC.id)
    expect(viaAuth.error).not.toBeNull()
    // the whole auth.users DELETE rolled back with the member row
    expect((await supabaseAdmin.auth.admin.getUserById(users.superC.id)).data.user?.id).toBe(users.superC.id)

    const direct = await supabaseAdmin.from('members').delete().eq('id', users.superC.id)
    expect(direct.error?.code).toBe('23514')
    expect(direct.error?.message).toContain('role_guard:last_superadmin')

    expect(await getRow(users.superC.id)).toMatchObject({ role: 'superadmin', left_on: null })
    expect(await countActiveSuperadmins()).toBe(2)
  })

  it('with a single superadmin, demoting them is blocked too (it would leave fewer than two)', async () => {
    // No guarded path leaves fewer than two superadmins, so the test fixture forces it.
    await forceDemoteForTests(users.superC.id)
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
  it('not even a superadmin can log the register export directly (admin_export_register logs it)', async () => {
    const client = await createAuthenticatedClient(emails.superA, password)
    const { data, error } = await client.rpc('log_admin_event', {
      p_action: 'export.member_register',
      p_target: null,
      p_details: { rows: 12 },
      p_reason: null,
    })
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('audit:action_not_allowed')
    expect(data).toBeNull()
  })

  // admin_reveal_sensitive() (20261005100500_member_admin_mutations.sql): the rest of A-5 is in
  // member-admin-mutations.test.ts.
  it('a superadmin reveals a former member\'s DNI only with a reason of 10+ characters (BR-21)', async () => {
    const cipher = fakeMemberCipher(users.former.id)
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

// Role management (S-1, S-2) and anonymisation (S-3) through the audited functions of
// 20261005100600_roles_and_anonymise.sql, called with a real superadmin session so auth.uid()
// is the caller. Board/member callers and the delete guard for non-superadmins are in
// roles-and-anonymise.test.ts. superA and superB are the two active superadmins here.
async function roleEntries(target: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('actor_id, actor_role, action, details, reason')
    .eq('target_member_id', target)
    .in('action', ['role.grant', 'role.revoke'])
    .order('id')
  expect(error).toBeNull()
  return data!
}

describe('admin_set_role (S-1, S-2)', () => {
  const setRoleAs = async (key: Key, target: string, role: string, reason: string | null = null) => {
    const client = await createAuthenticatedClient(emails[key], password)
    return client.rpc('admin_set_role', { p_member_id: target, p_role: role, p_reason: reason })
  }

  it('a superadmin grants board and the grant is logged once', async () => {
    const { data, error } = await setRoleAs('superA', users.target.id, 'board', '  Elegida a l\'assemblea  ')
    expect(error).toBeNull()
    expect(data).toEqual([{ action: 'role.grant', role: 'board', role_since: expect.any(String) }])
    expect(await getRow(users.target.id)).toMatchObject({ role: 'board', role_since: data![0].role_since })
    expect(await roleEntries(users.target.id)).toEqual([
      {
        actor_id: users.superA.id,
        actor_role: 'superadmin',
        action: 'role.grant',
        details: { from: 'member', to: 'board' },
        reason: 'Elegida a l\'assemblea',
      },
    ])
  })

  it('granting the role the member already holds is refused and logs nothing', async () => {
    const { data, error } = await setRoleAs('superA', users.target.id, 'board')
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:role_unchanged')
    expect(data).toBeNull()
    expect(await roleEntries(users.target.id)).toHaveLength(1)
  })

  it('the legacy admin role ranks like board, so admin → board is unchanged too', async () => {
    const { error } = await setRoleAs('superA', users.legacy.id, 'board')
    expect(error?.message).toContain('admin:role_unchanged')
    expect((await getRow(users.legacy.id)).role).toBe('admin')
  })

  it('only member, board and superadmin can be assigned (never the legacy admin)', async () => {
    for (const role of ['admin', 'owner', '']) {
      const { error } = await setRoleAs('superA', users.member.id, role)
      expect(error?.code, role).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
    }
    expect((await getRow(users.member.id)).role).toBe('member')
  })

  it('refuses an unknown member and a reason over 500 characters', async () => {
    const unknown = await setRoleAs('superA', '00000000-0000-0000-0000-000000000000', 'board')
    expect(unknown.error?.message).toContain('admin:not_found')

    const long = await setRoleAs('superA', users.member.id, 'board', 'x'.repeat(501))
    expect(long.error?.message).toContain('admin:reason_too_long')
    expect((await getRow(users.member.id)).role).toBe('member')
  })

  it('a superadmin promotes board to superadmin (role.grant)', async () => {
    const { data, error } = await setRoleAs('superB', users.target.id, 'superadmin')
    expect(error).toBeNull()
    expect(data![0]).toMatchObject({ action: 'role.grant', role: 'superadmin' })
    expect(await countActiveSuperadmins()).toBe(3)
    expect((await roleEntries(users.target.id)).at(-1)).toEqual({
      actor_id: users.superB.id,
      actor_role: 'superadmin',
      action: 'role.grant',
      details: { from: 'board', to: 'superadmin' },
      reason: null,
    })
  })

  it('a role holder\'s account cannot be deleted while they hold the role (BR-12)', async () => {
    // three superadmins: BR-10 would allow it, BR-12 does not
    const viaAuth = await supabaseAdmin.auth.admin.deleteUser(users.target.id)
    expect(viaAuth.error).not.toBeNull()
    expect((await supabaseAdmin.auth.admin.getUserById(users.target.id)).data.user?.id).toBe(users.target.id)

    const direct = await supabaseAdmin.from('members').delete().eq('id', users.target.id)
    expect(direct.error?.code).toBe('23514')
    expect(direct.error?.message).toContain('role_guard:role_held')
    expect((await getRow(users.target.id)).role).toBe('superadmin')
  })

  it('with three superadmins one can be revoked straight to member (role.revoke)', async () => {
    const { data, error } = await setRoleAs('superA', users.target.id, 'member', 'Deixa la junta')
    expect(error).toBeNull()
    expect(data).toEqual([{ action: 'role.revoke', role: 'member', role_since: null }])
    expect(await getRow(users.target.id)).toMatchObject({ role: 'member', role_since: null })
    expect(await countActiveSuperadmins()).toBe(2)
    expect((await roleEntries(users.target.id)).at(-1)).toEqual({
      actor_id: users.superA.id,
      actor_role: 'superadmin',
      action: 'role.revoke',
      details: { from: 'superadmin', to: 'member' },
      reason: 'Deixa la junta',
    })
  })

  it('BR-10: revoking one of the last two superadmins is refused and logs nothing', async () => {
    for (const role of ['board', 'member']) {
      const { error } = await setRoleAs('superA', users.superB.id, role)
      expect(error?.code).toBe('23514')
      expect(error?.message).toContain('role_guard:last_superadmin')
    }
    expect((await getRow(users.superB.id)).role).toBe('superadmin')
    expect(await roleEntries(users.superB.id)).toEqual([])
  })

  it('BR-11: a superadmin cannot change their own role', async () => {
    const { error } = await setRoleAs('superA', users.superA.id, 'board')
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:self_role_change')
    expect((await getRow(users.superA.id)).role).toBe('superadmin')
    expect(await roleEntries(users.superA.id)).toEqual([])
  })

  it('BR-12: a former member cannot be granted a role', async () => {
    const { error } = await setRoleAs('superA', users.former.id, 'board')
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:former_member_role')
    expect((await getRow(users.former.id)).role).toBe('member')
    expect(await roleEntries(users.former.id)).toEqual([])
  })

  it('revoking board and the legacy admin role is a role.revoke', async () => {
    for (const key of ['board', 'legacy'] as const) {
      const from = (await getRow(users[key].id)).role
      const { error } = await setRoleAs('superB', users[key].id, 'member')
      expect(error, key).toBeNull()
      expect((await getRow(users[key].id)).role).toBe('member')
      expect((await roleEntries(users[key].id)).at(-1)).toMatchObject({
        action: 'role.revoke',
        details: { from, to: 'member' },
      })
    }
  })
})

describe('admin_anonymise_member (S-3)', () => {
  const anonymiseAs = async (key: Key, target: string, confirm: string, reason: string | null = null) => {
    const client = await createAuthenticatedClient(emails[key], password)
    return client.rpc('admin_anonymise_member', { p_member_id: target, p_confirm_number: confirm, p_reason: reason })
  }
  const anonymiseEntries = async (target: string) =>
    (
      await supabaseAdmin
        .from('audit_log')
        .select('actor_id, actor_role, details, reason, target_member_number')
        .eq('target_member_id', target)
        .eq('action', 'member.anonymise')
        .order('id')
    ).data!

  it('refuses an active member (erasure of an active member starts with the baixa)', async () => {
    const number = (await supabaseAdmin.from('members').select('member_number').eq('id', users.member.id).single()).data!.member_number
    const { error } = await anonymiseAs('superA', users.member.id, number)
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:not_former')
    expect((await getRow(users.member.id)).left_on).toBeNull()
    expect(await anonymiseEntries(users.member.id)).toEqual([])
  })

  it('refuses a confirmation that is not the member number', async () => {
    for (const confirm of ['', '000-000', 'erased']) {
      const { error } = await anonymiseAs('superA', users.erased.id, confirm)
      expect(error?.code, confirm).toBe('22023')
      expect(error?.message).toContain('admin:confirm_mismatch')
    }
    const { data: badges } = await supabaseAdmin.from('member_badges').select('badge_key').eq('member_id', users.erased.id)
    expect(badges).toHaveLength(2)
    expect(await anonymiseEntries(users.erased.id)).toEqual([])
  })

  it('anonymises a former member: badges go, the blocked register stays, one entry', async () => {
    const { data: before } = await supabaseAdmin.from('members').select('*').eq('id', users.erased.id).single()
    const { data, error } = await anonymiseAs('superA', users.erased.id, `  ${before!.member_number} `, 'Petició per correu')
    expect(error).toBeNull()
    expect(data).toEqual([{ member_number: before!.member_number, purge_on: '2029-09-15' }])

    const { data: after } = await supabaseAdmin.from('members').select('*').eq('id', users.erased.id).single()
    expect(after!.anonymised_at).not.toBeNull()
    // kept until the purge (spec §4.5): register fields
    expect(after).toMatchObject({
      member_number: before!.member_number,
      first_name: before!.first_name,
      last_name: before!.last_name,
      dni_nie_encrypted: before!.dni_nie_encrypted,
      membership_start_date: before!.membership_start_date,
      current_joined_on: before!.current_joined_on,
      left_on: '2026-09-15',
      left_by: 'board',
      leave_reason: 'Sol·licitud de supressió',
      role: 'member',
    })
    // deleted now: badges, any leftover contact/profile data; the old card token is gone
    expect(after).toMatchObject({
      phone_encrypted: null,
      postal_code: null,
      ludoya_username: null,
      bgg_username: null,
      newsletter_accepted: false,
    })
    expect(after!.card_token).not.toBe(before!.card_token)
    const { data: badges } = await supabaseAdmin.from('member_badges').select('badge_key').eq('member_id', users.erased.id)
    expect(badges).toEqual([])

    expect(await anonymiseEntries(users.erased.id)).toEqual([
      {
        actor_id: users.superA.id,
        actor_role: 'superadmin',
        details: { badges_deleted: 2, purge_on: '2029-09-15' },
        reason: 'Petició per correu',
        target_member_number: before!.member_number,
      },
    ])
  })

  it('a second call answers admin:already_anonymised and logs nothing (retry path)', async () => {
    const number = (await getRowNumber(users.erased.id))
    const { error } = await anonymiseAs('superB', users.erased.id, number)
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:already_anonymised')
    expect(await anonymiseEntries(users.erased.id)).toHaveLength(1)
  })

  it('deleting the login account afterwards keeps the anonymised stub', async () => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(users.erased.id)
    expect(error).toBeNull()
    const { data } = await supabaseAdmin
      .from('members')
      .select('id, left_on, anonymised_at, first_name')
      .eq('id', users.erased.id)
      .single()
    expect(data).toMatchObject({ id: users.erased.id, left_on: '2026-09-15', first_name: 'erased' })
    expect(data!.anonymised_at).not.toBeNull()

    // still refused, without a login account too
    const again = await anonymiseAs('superA', users.erased.id, await getRowNumber(users.erased.id))
    expect(again.error?.message).toContain('admin:already_anonymised')
  })
})

// A-11 on a former member (20261005100800_admin_exports.sql): superadmin only (D-D, provisional).
// The board refusal and the active-member cases are in admin-exports.test.ts. superA is still an
// active superadmin here; `erased` is anonymised and its login account deleted by now.
// A former member's file holds the blocked DNI, so the export needs the same written reason as
// revealing it (BR-21, 20261005100900): at least admin_reveal_reason_min_length() characters.
describe('admin_export_member_data on a former member (A-11, D-D, BR-21)', () => {
  const REASON = 'Petició d\'accés per correu'
  const exportAs = async (key: Key, target: string, reason: string | null = REASON) => {
    const client = await createAuthenticatedClient(emails[key], password)
    return client.rpc('admin_export_member_data', { p_member_id: target, p_reason: reason })
  }
  const exportEntries = async (target: string) =>
    (
      await supabaseAdmin
        .from('audit_log')
        .select('actor_id, actor_role, details, reason')
        .eq('target_member_id', target)
        .eq('action', 'export.member_data')
        .order('id')
    ).data!

  it('a superadmin without a reason, or with one under 10 characters, is refused and nothing is logged', async () => {
    const client = await createAuthenticatedClient(emails.superA, password)
    const noReasonArg = await client.rpc('admin_export_member_data', { p_member_id: users.former.id })
    expect(noReasonArg.error?.code).toBe('22023')
    expect(noReasonArg.error?.message).toContain('admin:reason_required')
    expect(noReasonArg.data).toBeNull()

    for (const reason of [null, '', '   ', '  123456789  ']) {
      const { data, error } = await exportAs('superA', users.former.id, reason)
      expect(error?.code, String(reason)).toBe('22023')
      expect(error?.message).toContain('admin:reason_required')
      expect(data).toBeNull()
    }
    const long = await exportAs('superA', users.former.id, 'x'.repeat(501))
    expect(long.error?.message).toContain('admin:reason_too_long')
    expect(await exportEntries(users.former.id)).toEqual([])
  })

  it("a superadmin exports a former member's data with a reason, logged with the state and the reason", async () => {
    const { data: row } = await supabaseAdmin
      .from('members')
      .select('member_number, dni_nie_encrypted')
      .eq('id', users.former.id)
      .single()
    const { data, error } = await exportAs('superA', users.former.id)
    expect(error).toBeNull()
    expect(data).toEqual([
      expect.objectContaining({
        id: users.former.id,
        member_number: row!.member_number,
        state: 'former',
        email: emails.former,
        dni_nie_encrypted: row!.dni_nie_encrypted,
        phone_encrypted: null,
        left_on: '2026-10-01',
        left_by: 'self',
        badges: [],
      }),
    ])
    expect(await exportEntries(users.former.id)).toEqual([
      { actor_id: users.superA.id, actor_role: 'superadmin', details: { state: 'former' }, reason: REASON },
    ])
  })

  it('also an anonymised former member without a login account: whatever is still held', async () => {
    const { data, error } = await exportAs('superA', users.erased.id)
    expect(error).toBeNull()
    expect(data).toEqual([
      expect.objectContaining({
        id: users.erased.id,
        state: 'former',
        email: null,
        first_name: 'erased',
        left_by: 'board',
        leave_reason: 'Sol·licitud de supressió',
        ludoya_username: null,
        badges: [],
      }),
    ])
    expect(await exportEntries(users.erased.id)).toHaveLength(1)
  })
})

// S-4, the llibre de socis (20261005100900): superadmin only, every member active or former
// (blocked records included, BR-21's one exception), never a purged stub or an unconfirmed
// sign-up, with the D-B fields and the DNI as stored ciphertext; a written reason is required
// (it carries former members' DNI). Board and member refusals are in admin-exports.test.ts.
// superA is an active superadmin here; `erased` is anonymised without a login account.
describe('admin_export_register (S-4)', () => {
  type Row = {
    id: string
    member_number: string
    first_name: string | null
    last_name: string | null
    dni_nie_encrypted: string | null
    membership_start_date: string | null
    current_joined_on: string | null
    left_on: string | null
    left_by: string | null
    total_rows: number
  }
  const REASON = 'Requeriment del Registre d\'Associacions'
  let unconfirmedId: string

  beforeAll(async () => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: 'roles-unconfirmed@test.local',
      password,
      email_confirm: false,
      user_metadata: { first_name: 'Pendent', last_name: 'Roles' },
    })
    expect(error).toBeNull()
    unconfirmedId = data.user!.id
    userIds.push(unconfirmedId)
  })

  const exportAs = async (key: Key, reason: string | null) => {
    const client = await createAuthenticatedClient(emails[key], password)
    return client.rpc('admin_export_register', { p_reason: reason })
  }
  const registerEntries = async (actor: string) =>
    (
      await supabaseAdmin
        .from('audit_log')
        .select('id, actor_role, target_member_id, details, reason')
        .eq('actor_id', actor)
        .eq('action', 'export.member_register')
        .order('id')
    ).data!

  it('refuses a missing, blank, short or too long reason and logs nothing', async () => {
    const before = await registerEntries(users.superA.id)
    const client = await createAuthenticatedClient(emails.superA, password)
    const noArg = await client.rpc('admin_export_register', {})
    expect(noArg.error?.code).toBe('22023')
    expect(noArg.error?.message).toContain('admin:reason_required')

    for (const reason of [null, '', '   ', '  123456789  ']) {
      const { data, error } = await exportAs('superA', reason)
      expect(error?.code, String(reason)).toBe('22023')
      expect(error?.message).toContain('admin:reason_required')
      expect(data).toBeNull()
    }
    const long = await exportAs('superA', 'x'.repeat(501))
    expect(long.error?.message).toContain('admin:reason_too_long')
    expect(await registerEntries(users.superA.id)).toHaveLength(before.length)
  })

  it('returns active and former members with the D-B fields, never a purged stub or an unconfirmed sign-up', async () => {
    const { data, error } = await exportAs('superA', REASON)
    expect(error).toBeNull()
    const rows = data as Row[]
    const ids = rows.map((r) => r.id)

    for (const key of ['member', 'board', 'legacy', 'superA', 'superB', 'former', 'erased'] as const) {
      expect(ids, key).toContain(users[key].id)
    }
    expect(ids).not.toContain(users.purged.id)
    expect(ids).not.toContain(unconfirmedId)

    const { data: former } = await supabaseAdmin
      .from('members')
      .select('member_number, dni_nie_encrypted, membership_start_date, current_joined_on')
      .eq('id', users.former.id)
      .single()
    expect(former!.dni_nie_encrypted).toMatch(/^v2:/)
    expect(rows.find((r) => r.id === users.former.id)).toEqual({
      id: users.former.id,
      member_number: former!.member_number,
      first_name: 'former',
      last_name: 'Roles',
      dni_nie_encrypted: former!.dni_nie_encrypted,
      membership_start_date: former!.membership_start_date,
      current_joined_on: former!.current_joined_on,
      left_on: '2026-10-01',
      left_by: 'self',
      total_rows: rows.length,
    })
    // anonymised: login account gone, name and DNI still held until the purge
    expect(rows.find((r) => r.id === users.erased.id)).toMatchObject({
      first_name: 'erased',
      left_on: '2026-09-15',
      left_by: 'board',
      dni_nie_encrypted: expect.stringMatching(/^v2:/),
    })
    expect(rows.find((r) => r.id === users.member.id)).toMatchObject({ left_on: null, left_by: null })
    expect(rows.every((r) => r.total_rows === rows.length)).toBe(true)
    const numbers = rows.map((r) => r.member_number)
    expect(numbers).toEqual([...numbers].sort())
  })

  it('writes one export.member_register entry with the row count and the reason, readable by the superadmin', async () => {
    const before = await registerEntries(users.superA.id)
    const { data, error } = await exportAs('superA', `  ${REASON}  `)
    expect(error).toBeNull()
    const rows = data as Row[]

    const added = (await registerEntries(users.superA.id)).slice(before.length)
    expect(added).toEqual([
      {
        id: expect.any(Number),
        actor_role: 'superadmin',
        target_member_id: null,
        details: { rows: rows.length },
        reason: REASON,
      },
    ])

    const client = await createAuthenticatedClient(emails.superA, password)
    const read = await client.from('audit_log').select('action, details').eq('id', added[0].id)
    expect(read.error).toBeNull()
    expect(read.data).toEqual([{ action: 'export.member_register', details: added[0].details }])
  })
})

async function getRowNumber(id: string) {
  const { data, error } = await supabaseAdmin.from('members').select('member_number').eq('id', id).single()
  expect(error).toBeNull()
  return data!.member_number as string
}

// T11b · setMemberRole / anonymiseMember (src/lib/admin/superadmin-actions.ts) with real session
// clients. superA and superB are the only two active superadmins here.
describe('superadmin actions (S-1, S-2, S-3)', () => {
  const as = async (key: Key) => {
    session.client = await createAuthenticatedClient(emails[key], password)
  }
  const auditFor = async (target: string, actions: string[]) =>
    (
      await supabaseAdmin
        .from('audit_log')
        .select('actor_id, action, details')
        .eq('target_member_id', target)
        .in('action', actions)
        .order('id')
    ).data!

  beforeAll(async () => {
    expect((await setRole(users.actBoard.id, 'board')).error).toBeNull()
    const former = await supabaseAdmin
      .from('members')
      .update({ left_on: '2026-09-20', left_by: 'board', leave_reason: 'Sol·licitud de supressió' })
      .eq('id', users.actFormer.id)
    expect(former.error).toBeNull()
    expect((await supabaseAdmin.from('member_badges').insert({ member_id: users.actFormer.id, badge_key: 'ludoteca_donor' })).error).toBeNull()
  })

  it('a board session can neither set roles nor anonymise', async () => {
    await as('actBoard')
    expect(await setMemberRole(users.actTarget.id, 'board')).toEqual({ error: 'forbidden' })
    expect(await anonymiseMember(users.actFormer.id, await getRowNumber(users.actFormer.id))).toEqual({ error: 'forbidden' })
    expect((await getRow(users.actTarget.id)).role).toBe('member')
    expect((await supabaseAdmin.auth.admin.getUserById(users.actFormer.id)).data.user?.id).toBe(users.actFormer.id)
  })

  it('a superadmin grants board and revokes it; one entry each, with the superadmin as actor', async () => {
    await as('superA')
    expect(await setMemberRole(users.actTarget.id, 'board')).toEqual({
      ok: true,
      action: 'role.grant',
      role: 'board',
      roleSince: expect.any(String),
    })
    expect((await getRow(users.actTarget.id)).role).toBe('board')
    expect(await setMemberRole(users.actTarget.id, 'board')).toEqual({ error: 'role_unchanged' })

    expect(await setMemberRole(users.actTarget.id, 'member', 'Deixa la junta')).toEqual({
      ok: true,
      action: 'role.revoke',
      role: 'member',
      roleSince: null,
    })
    expect(await auditFor(users.actTarget.id, ['role.grant', 'role.revoke'])).toEqual([
      { actor_id: users.superA.id, action: 'role.grant', details: { from: 'member', to: 'board' } },
      { actor_id: users.superA.id, action: 'role.revoke', details: { from: 'board', to: 'member' } },
    ])
  })

  it('BR-11 through the real JWT: a superadmin cannot change their own role', async () => {
    await as('superA')
    expect(await setMemberRole(users.superA.id, 'board')).toEqual({ error: 'self_role_change' })
    expect((await getRow(users.superA.id)).role).toBe('superadmin')
  })

  it('BR-10: revoking one of the last two superadmins is last_superadmin', async () => {
    expect(await countActiveSuperadmins()).toBe(2)
    await as('superA')
    expect(await setMemberRole(users.superB.id, 'member')).toEqual({ error: 'last_superadmin' })
    expect(await countActiveSuperadmins()).toBe(2)
  })

  it('BR-12: a former member cannot be granted a role', async () => {
    await as('superB')
    expect(await setMemberRole(users.former.id, 'board')).toEqual({ error: 'former_member_role' })
    expect((await getRow(users.former.id)).role).toBe('member')
  })

  it('anonymise refuses an active member and a wrong confirmation, touching nothing', async () => {
    await as('superA')
    expect(await anonymiseMember(users.actTarget.id, await getRowNumber(users.actTarget.id))).toEqual({ error: 'not_former' })
    expect(await anonymiseMember(users.actFormer.id, '999-999')).toEqual({ error: 'confirm_mismatch' })
    expect(await auditFor(users.actFormer.id, ['member.anonymise'])).toEqual([])
    expect((await supabaseAdmin.auth.admin.getUserById(users.actFormer.id)).data.user?.id).toBe(users.actFormer.id)
  })

  it('anonymises a former member: login account deleted, stub kept, one entry', async () => {
    await as('superA')
    const number = await getRowNumber(users.actFormer.id)
    expect(await anonymiseMember(users.actFormer.id, ` ${number} `, 'Petició per correu')).toEqual({
      ok: true,
      accountDeleted: true,
      alreadyAnonymised: false,
      purgeOn: '2029-09-20',
    })

    const { data: user } = await supabaseAdmin.auth.admin.getUserById(users.actFormer.id)
    expect(user.user).toBeNull()
    const { data: stub } = await supabaseAdmin
      .from('members')
      .select('member_number, first_name, left_on, anonymised_at')
      .eq('id', users.actFormer.id)
      .single()
    expect(stub).toMatchObject({ member_number: number, first_name: 'actFormer', left_on: '2026-09-20' })
    expect(stub!.anonymised_at).not.toBeNull()
    const { data: badges } = await supabaseAdmin.from('member_badges').select('badge_key').eq('member_id', users.actFormer.id)
    expect(badges).toEqual([])
    expect(await auditFor(users.actFormer.id, ['member.anonymise'])).toEqual([
      { actor_id: users.superA.id, action: 'member.anonymise', details: { badges_deleted: 1, purge_on: '2029-09-20' } },
    ])
  })

  it('a retry is idempotent: ok, already anonymised, account counted as deleted, no new entry', async () => {
    await as('superB')
    expect(await anonymiseMember(users.actFormer.id, await getRowNumber(users.actFormer.id))).toEqual({
      ok: true,
      accountDeleted: true,
      alreadyAnonymised: true,
      purgeOn: null,
    })
    expect(await auditFor(users.actFormer.id, ['member.anonymise'])).toHaveLength(1)
    // the confirmation is still checked on a retry
    expect(await anonymiseMember(users.actFormer.id, '999-999')).toEqual({ error: 'confirm_mismatch' })
  })
})
