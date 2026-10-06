import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

// Migration 20261005100600_roles_and_anonymise.sql: who may call admin_set_role (S-1, S-2) and
// admin_anonymise_member (S-3), and the role guard on DELETE (BR-10, BR-12, BR-16).
//
// No superadmin is created here: superadmin callers and the BR-10 delete cases live in
// roles.test.ts, the only file allowed to create superadmins.

const password = 'password123'
const DOMAIN = 'roles-anon.test'
const emails = {
  board: `ra-board@${DOMAIN}`,
  member: `ra-member@${DOMAIN}`,
  target: `ra-target@${DOMAIN}`,
  former: `ra-former@${DOMAIN}`,
  holder: `ra-holder@${DOMAIN}`,
  legacy: `ra-legacy@${DOMAIN}`,
  plain: `ra-plain@${DOMAIN}`,
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

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

async function getRow(id: string) {
  const { data, error } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  expect(error).toBeNull()
  return data!
}

async function entriesFor(target: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('action')
    .eq('target_member_id', target)
    .in('action', ['role.grant', 'role.revoke', 'member.anonymise'])
  expect(error).toBeNull()
  return data!
}

async function authUserExists(id: string) {
  return (await supabaseAdmin.auth.admin.getUserById(id)).data.user?.id === id
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: key, last_name: 'Anon' })
    userIds.push(users[key].id)
  }
  await update(users.board.id, { role: 'board' })
  await update(users.holder.id, { role: 'board' })
  await update(users.legacy.id, { role: 'board' }) // pre-M7 this was the legacy 'admin' role
  await update(users.former.id, { left_on: '2026-09-01', left_by: 'self' })

  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

describe('admin_set_role is superadmin only (BR-9)', () => {
  it('a board member cannot grant or revoke a role', async () => {
    for (const [target, role] of [
      [users.target.id, 'board'],
      [users.holder.id, 'member'],
    ] as const) {
      const { data, error } = await board.rpc('admin_set_role', { p_member_id: target, p_role: role })
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('admin:forbidden')
      expect(data).toBeNull()
    }
    expect((await getRow(users.target.id)).role).toBe('member')
    expect((await getRow(users.holder.id)).role).toBe('board')
    expect(await entriesFor(users.target.id)).toEqual([])
    expect(await entriesFor(users.holder.id)).toEqual([])
  })

  it('a plain member cannot change anyone\'s role, their own included', async () => {
    for (const target of [users.target.id, users.member.id]) {
      const { error } = await member.rpc('admin_set_role', { p_member_id: target, p_role: 'board' })
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('admin:forbidden')
    }
    expect((await getRow(users.member.id)).role).toBe('member')
  })

  it('anon and the service role cannot execute it (they have no caller)', async () => {
    for (const client of [anon, supabaseAdmin]) {
      const { error } = await client.rpc('admin_set_role', { p_member_id: users.target.id, p_role: 'board' })
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('permission denied')
    }
    expect((await getRow(users.target.id)).role).toBe('member')
  })
})

describe('admin_anonymise_member is superadmin only', () => {
  it('a board member and a plain member are refused and nothing changes', async () => {
    const { member_number } = await getRow(users.former.id)
    for (const client of [board, member]) {
      const { error } = await client.rpc('admin_anonymise_member', {
        p_member_id: users.former.id,
        p_confirm_number: member_number,
      })
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('admin:forbidden')
    }
    expect((await getRow(users.former.id)).anonymised_at).toBeNull()
    expect(await entriesFor(users.former.id)).toEqual([])
  })

  it('anon and the service role cannot execute it', async () => {
    for (const client of [anon, supabaseAdmin]) {
      const { error } = await client.rpc('admin_anonymise_member', {
        p_member_id: users.former.id,
        p_confirm_number: 'x',
      })
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('permission denied')
    }
  })
})

describe('the role guard on DELETE (BR-12, BR-16)', () => {
  it.each(['holder', 'legacy'] as const)(
    'deleting the login account of a %s role holder fails and nothing is deleted',
    async (key) => {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(users[key].id)
      expect(error).not.toBeNull()
      expect(await authUserExists(users[key].id)).toBe(true)
      expect((await getRow(users[key].id)).role).not.toBe('member')
    }
  )

  it('a direct DELETE of a role holder\'s row fails with role_guard:role_held', async () => {
    const { error } = await supabaseAdmin.from('members').delete().eq('id', users.holder.id)
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('role_guard:role_held')
    expect((await getRow(users.holder.id)).role).toBe('board')
  })

  it('once the role is removed, the account can be deleted', async () => {
    await update(users.holder.id, { role: 'member' })
    const { error } = await supabaseAdmin.auth.admin.deleteUser(users.holder.id)
    expect(error).toBeNull()
    expect(await authUserExists(users.holder.id)).toBe(false)
    const { data } = await supabaseAdmin.from('members').select('id').eq('id', users.holder.id).maybeSingle()
    expect(data).toBeNull()
  })

  it('deleting a plain active member still deletes the account and the row', async () => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(users.plain.id)
    expect(error).toBeNull()
    const { data } = await supabaseAdmin.from('members').select('id').eq('id', users.plain.id).maybeSingle()
    expect(data).toBeNull()
  })

  it('deleting an unconfirmed sign-up still works (prepareSignup, retention)', async () => {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `ra-unconfirmed@${DOMAIN}`,
      password,
      email_confirm: false,
    })
    expect(createError).toBeNull()
    const id = created.user!.id
    userIds.push(id) // cleanup if an assertion below fails
    expect((await getRow(id)).role).toBe('member')

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    expect(error).toBeNull()
    expect(await authUserExists(id)).toBe(false)
    const { data } = await supabaseAdmin.from('members').select('id').eq('id', id).maybeSingle()
    expect(data).toBeNull()
  })

  it('a former member\'s login account can still be deleted (the stub stays)', async () => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(users.former.id)
    expect(error).toBeNull()
    expect((await getRow(users.former.id)).left_on).toBe('2026-09-01')
  })
})
