import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

const userIds: string[] = []
const email = 'member-hardening@test.local'
const password = 'password123'

beforeAll(async () => {
  const user = await createTestUser(email, password, {
    first_name: 'Hard',
    last_name: 'Ening',
  })
  userIds.push(user.id)
})

afterAll(() => cleanupUsers(userIds))

describe('generate_member_number() privileges', () => {
  it('is not callable by anon through PostgREST', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const { data, error } = await anon.rpc('generate_member_number')
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('is not callable by an authenticated member', async () => {
    const client = await createAuthenticatedClient(email, password)
    const { data, error } = await client.rpc('generate_member_number')
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('still assigns a member number to a new auth user (trigger path)', async () => {
    const user = await createTestUser('member-hardening-2@test.local', password)
    userIds.push(user.id)
    const { data } = await supabaseAdmin
      .from('members')
      .select('member_number')
      .eq('id', user.id)
      .single()
    expect(data!.member_number).toMatch(/^000-\d{3}$/)
  })
})

describe('members length constraints (members_update_own)', () => {
  async function patch(values: Record<string, string>) {
    const client = await createAuthenticatedClient(email, password)
    const { data: me } = await client.auth.getUser()
    return client.from('members').update(values).eq('id', me.user!.id)
  }

  it('rejects a 200-char first_name', async () => {
    const { error } = await patch({ first_name: 'a'.repeat(200) })
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('members_first_name_length')
  })

  it.each([
    ['last_name', 101, 'members_last_name_length'],
    ['postal_code', 11, 'members_postal_code_length'],
    ['ludoya_username', 65, 'members_ludoya_username_length'],
    ['bgg_username', 65, 'members_bgg_username_length'],
    ['phone_encrypted', 513, 'members_phone_encrypted_length'],
    ['dni_nie_encrypted', 513, 'members_dni_nie_encrypted_length'],
  ])('rejects an oversized %s', async (column, length, constraint) => {
    const { error } = await patch({ [column]: 'a'.repeat(length) })
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain(constraint)
  })

  it('accepts values at the limits', async () => {
    const { error } = await patch({
      first_name: 'a'.repeat(100),
      last_name: 'b'.repeat(100),
      postal_code: '0'.repeat(10),
      ludoya_username: 'u'.repeat(64),
    })
    expect(error).toBeNull()
  })
})
