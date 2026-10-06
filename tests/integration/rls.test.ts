import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  createTestAdmin,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'
import { createClient } from '@supabase/supabase-js'

let userA: { id: string }
let userB: { id: string }
let admin: { id: string }
const userIds: string[] = []

beforeAll(async () => {
  userA = await createTestUser('rls-a@test.local', 'password123', {
    first_name: 'UserA',
    last_name: 'Test',
  })
  userB = await createTestUser('rls-b@test.local', 'password123', {
    first_name: 'UserB',
    last_name: 'Test',
  })
  admin = await createTestAdmin('rls-admin@test.local', 'password123')
  userIds.push(userA.id, userB.id, admin.id)
})

afterAll(() => cleanupUsers(userIds))

describe('SELECT policies', () => {
  it('member sees only their own profile', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { data } = await client.from('members').select('*')

    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(userA.id)
  })

  it('member cannot see other profiles', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { data } = await client
      .from('members')
      .select('*')
      .eq('id', userB.id)

    expect(data).toHaveLength(0)
  })

  it('member reads their own card_token but not another member\'s', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { data: own } = await client
      .from('members')
      .select('card_token')
      .eq('id', userA.id)
      .single()
    expect(own!.card_token).toMatch(/^[0-9a-f]{32}$/)

    const { data: other } = await client
      .from('members')
      .select('card_token')
      .eq('id', userB.id)
    expect(other).toHaveLength(0)
  })

  // T7b dropped admins_select_all: an admin reads only its own row directly, like any member
  // (board screens use SECURITY DEFINER functions or the service role after a role check).
  it('admin sees only its own row', async () => {
    const client = await createAuthenticatedClient(
      'rls-admin@test.local',
      'password123'
    )
    const { data, error } = await client.from('members').select('id')

    expect(error).toBeNull()
    expect(data).toEqual([{ id: admin.id }])
  })

  it('anonymous client sees nothing', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const { data } = await anon.from('members').select('*')

    expect(data).toHaveLength(0)
  })
})

describe('UPDATE policies', () => {
  it('member can update their own profile', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ postal_code: '08221' })
      .eq('id', userA.id)

    expect(error).toBeNull()

    const { data } = await client
      .from('members')
      .select('postal_code')
      .eq('id', userA.id)
      .single()

    expect(data!.postal_code).toBe('08221')
  })

  it('member cannot update other profiles (0 rows affected)', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { data } = await client
      .from('members')
      .update({ postal_code: 'HACKED' })
      .eq('id', userB.id)
      .select()

    // RLS silently filters — returns empty result
    expect(data).toHaveLength(0)
  })

  it('member cannot change their own role', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ role: 'board' })
      .eq('id', userA.id)

    expect(error).not.toBeNull()
  })

  it('member cannot change their own member_number', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ member_number: 'XXX-999' })
      .eq('id', userA.id)

    expect(error).not.toBeNull()
  })

  it('member cannot change their own card_token', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ card_token: 'forged-token' })
      .eq('id', userA.id)

    expect(error).not.toBeNull()
  })

  it('member cannot change their own membership_start_date', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { data } = await client
      .from('members')
      .update({ membership_start_date: '2000-01-01' })
      .eq('id', userA.id)
      .select()

    expect(data ?? []).toHaveLength(0)
    const { data: row } = await supabaseAdmin
      .from('members')
      .select('membership_start_date')
      .eq('id', userA.id)
      .single()
    expect(row!.membership_start_date).not.toBe('2000-01-01')
  })

  it('member cannot change their own created_at', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { data } = await client
      .from('members')
      .update({ created_at: '2000-01-01T00:00:00Z' })
      .eq('id', userA.id)
      .select()

    expect(data ?? []).toHaveLength(0)
  })

  it('admin cannot set a card_token directly', async () => {
    const client = await createAuthenticatedClient(
      'rls-admin@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ card_token: 'guessable' })
      .eq('id', userB.id)

    expect(error).not.toBeNull()
  })

  // admins_update_all was dropped (20261005100000_membership_state.sql): board changes to
  // another member go through audited SECURITY DEFINER functions, never a direct UPDATE.
  it('admin can no longer update another member through PostgREST', async () => {
    const client = await createAuthenticatedClient(
      'rls-admin@test.local',
      'password123'
    )
    const { data, error } = await client
      .from('members')
      .update({ postal_code: '08001' })
      .eq('id', userA.id)
      .select('id')

    expect(error).toBeNull()
    expect(data).toEqual([])
    const { data: row } = await supabaseAdmin
      .from('members')
      .select('postal_code')
      .eq('id', userA.id)
      .single()
    expect(row!.postal_code).not.toBe('08001')
  })

  it('admin cannot change another member\'s role', async () => {
    const client = await createAuthenticatedClient(
      'rls-admin@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ role: 'board' })
      .eq('id', userA.id)

    expect(error).not.toBeNull()
    const { data: row } = await supabaseAdmin
      .from('members')
      .select('role')
      .eq('id', userA.id)
      .single()
    expect(row!.role).toBe('member')
  })
})

describe('regenerate_card_token()', () => {
  it('admin regenerates a member token', async () => {
    const { data: before } = await supabaseAdmin
      .from('members')
      .select('card_token')
      .eq('id', userB.id)
      .single()

    const client = await createAuthenticatedClient(
      'rls-admin@test.local',
      'password123'
    )
    const { data: newToken, error } = await client.rpc('regenerate_card_token', {
      target_member_id: userB.id,
    })

    expect(error).toBeNull()
    expect(newToken).toMatch(/^[0-9a-f]{32}$/)
    expect(newToken).not.toBe(before!.card_token)

    const { data: after } = await supabaseAdmin
      .from('members')
      .select('card_token')
      .eq('id', userB.id)
      .single()
    expect(after!.card_token).toBe(newToken)
  })

  it('anonymous client cannot execute regenerate_card_token', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const { error } = await anon.rpc('regenerate_card_token', {
      target_member_id: userB.id,
    })

    expect(error).not.toBeNull()
  })

  it('raises for an unknown member id', async () => {
    const client = await createAuthenticatedClient(
      'rls-admin@test.local',
      'password123'
    )
    const { error } = await client.rpc('regenerate_card_token', {
      target_member_id: '00000000-0000-0000-0000-000000000000',
    })

    expect(error?.code).toBe('22023')
    expect(error!.message).toContain('admin:not_found')
  })

  it('non-admin cannot regenerate a token', async () => {
    const client = await createAuthenticatedClient(
      'rls-a@test.local',
      'password123'
    )
    const { error } = await client.rpc('regenerate_card_token', {
      target_member_id: userB.id,
    })

    expect(error?.code).toBe('42501')
    expect(error!.message).toContain('admin:forbidden')
  })
})
