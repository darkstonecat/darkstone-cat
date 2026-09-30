import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, createAuthenticatedClient, cleanupUsers, deleteTestUser } from '../helpers/supabase'
import { verifyCardToken } from '@/lib/supabase/verify-card'

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

let member: { id: string }
let memberNumber: string
let token: string
const userIds: string[] = []

beforeAll(async () => {
  member = await createTestUser('verify-card@test.local', 'password123', {
    first_name: 'Verify',
    last_name: 'Secret',
  })
  userIds.push(member.id)
  const { data } = await supabaseAdmin
    .from('members')
    .select('member_number, card_token')
    .eq('id', member.id)
    .single()
  memberNumber = data!.member_number
  token = data!.card_token
})

afterAll(() => cleanupUsers(userIds))

describe('verify_card_token', () => {
  it('lets an anonymous client verify a valid token and returns only validity + member number', async () => {
    const { data, error } = await anon.rpc('verify_card_token', { p_token: token })

    expect(error).toBeNull()
    expect(data).toEqual([{ valid: true, member_number: memberNumber }])
    expect(JSON.stringify(data)).not.toContain('Secret')
    expect(JSON.stringify(data)).not.toContain('verify-card@test.local')
  })

  it('is callable by an authenticated member too', async () => {
    const client = await createAuthenticatedClient('verify-card@test.local', 'password123')
    const { data, error } = await client.rpc('verify_card_token', { p_token: token })
    expect(error).toBeNull()
    expect(data).toEqual([{ valid: true, member_number: memberNumber }])
  })

  it('reports an unknown token as not valid without a member number', async () => {
    const { data, error } = await anon.rpc('verify_card_token', { p_token: 'f'.repeat(32) })
    expect(error).toBeNull()
    expect(data).toEqual([{ valid: false, member_number: null }])
  })

  const SHAPE = 'abcdef0123456789abcdef0123456789'
  it.each([
    ['too short', SHAPE.slice(1)],
    ['too long', `${SHAPE}0`],
    ['uppercase', SHAPE.toUpperCase()],
    ['a member number', '000-001'],
    ['SQL-like input', "' OR '1'='1"],
    ['empty', ''],
  ])('reports a malformed token (%s) as not valid', async (_label, value) => {
    const { data, error } = await anon.rpc('verify_card_token', { p_token: value })
    expect(error).toBeNull()
    expect(data).toEqual([{ valid: false, member_number: null }])
  })

  it('stops verifying a token once the member is removed', async () => {
    const gone = await createTestUser('verify-card-gone@test.local', 'password123')
    const { data: row } = await supabaseAdmin.from('members').select('card_token').eq('id', gone.id).single()
    expect((await anon.rpc('verify_card_token', { p_token: row!.card_token })).data).toEqual([
      expect.objectContaining({ valid: true }),
    ])

    await deleteTestUser(gone.id)

    const { data } = await anon.rpc('verify_card_token', { p_token: row!.card_token })
    expect(data).toEqual([{ valid: false, member_number: null }])
  })

  it('stops verifying the old token after an admin regenerates it', async () => {
    const admin = await createTestUser('verify-card-admin@test.local', 'password123')
    userIds.push(admin.id)
    await supabaseAdmin.from('members').update({ role: 'admin' }).eq('id', admin.id)
    const client = await createAuthenticatedClient('verify-card-admin@test.local', 'password123')
    const { data: fresh } = await client.rpc('regenerate_card_token', { target_member_id: member.id })

    expect((await anon.rpc('verify_card_token', { p_token: token })).data).toEqual([{ valid: false, member_number: null }])
    expect((await anon.rpc('verify_card_token', { p_token: fresh as string })).data).toEqual([
      { valid: true, member_number: memberNumber },
    ])
    token = fresh as string
  })

  it('does not open the members table to anonymous clients', async () => {
    const { data } = await anon.from('members').select('card_token')
    expect(data ?? []).toHaveLength(0)
  })
})

describe('verifyCardToken (server helper)', () => {
  it('returns the member number for a valid token', async () => {
    expect(await verifyCardToken(token)).toEqual({ valid: true, memberNumber })
  })

  it('returns not valid for unknown and malformed tokens', async () => {
    expect(await verifyCardToken('0'.repeat(32))).toEqual({ valid: false })
    expect(await verifyCardToken('nope')).toEqual({ valid: false })
  })
})
