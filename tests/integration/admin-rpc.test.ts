import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  createTestAdmin,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'
import { createClient } from '@supabase/supabase-js'
import { encrypt } from '@/lib/encryption'

let member: { id: string }
let admin: { id: string }
const userIds: string[] = []

beforeAll(async () => {
  member = await createTestUser('rpc-member@test.local', 'password123', {
    first_name: 'RPCMember',
    last_name: 'Test',
  })
  admin = await createTestAdmin('rpc-admin@test.local', 'password123')
  userIds.push(member.id, admin.id)

  // Set encrypted phone on member for later verification
  await supabaseAdmin
    .from('members')
    .update({ phone_encrypted: encrypt('612345678', member.id) })
    .eq('id', member.id)
})

afterAll(() => cleanupUsers(userIds))

// Since 20261005100700_lock_down_member_secrets.sql the function is executable by the service
// role only: the admin screens call it through the admin client after checking the role.
describe('get_all_members_for_admin()', () => {
  it('the service role gets all members with emails', async () => {
    const { data, error } = await supabaseAdmin.rpc('get_all_members_for_admin')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(2)

    const memberRow = data!.find((m: { id: string }) => m.id === member.id)
    expect(memberRow).toBeDefined()
    expect(memberRow!.email).toBe('rpc-member@test.local')
    expect(memberRow!.first_name).toBe('RPCMember')
  })

  it('an admin session gets permission denied', async () => {
    const client = await createAuthenticatedClient(
      'rpc-admin@test.local',
      'password123'
    )
    const { data, error } = await client.rpc('get_all_members_for_admin')

    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })

  it('a non-admin session gets permission denied', async () => {
    const client = await createAuthenticatedClient(
      'rpc-member@test.local',
      'password123'
    )
    const { error } = await client.rpc('get_all_members_for_admin')

    expect(error?.code).toBe('42501')
  })

  it('anonymous client gets exception', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const { error } = await anon.rpc('get_all_members_for_admin')

    expect(error?.code).toBe('42501')
  })

  it('returns encrypted fields as-is (not decrypted by DB)', async () => {
    const { data } = await supabaseAdmin.rpc('get_all_members_for_admin')

    const row = data!.find((m: { id: string }) => m.id === member.id)
    expect(row!.phone_encrypted).toBeTruthy()
    // DB returns the encrypted value, not plaintext
    expect(row!.phone_encrypted).not.toBe('612345678')
  })
})
