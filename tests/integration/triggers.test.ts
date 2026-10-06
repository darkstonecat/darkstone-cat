import { describe, it, expect, afterAll } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  cleanupUsers,
} from '../helpers/supabase'

const userIds: string[] = []

afterAll(() => cleanupUsers(userIds))

describe('handle_new_user() trigger', () => {
  it('creates member row when auth user is created', async () => {
    const user = await createTestUser('trigger-1@test.local', 'password123')
    userIds.push(user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', user.id)
      .single()

    expect(data).not.toBeNull()
    expect(data!.id).toBe(user.id)
    expect(data!.role).toBe('member')
  })

  it('copies first_name and last_name from user_metadata', async () => {
    const user = await createTestUser('trigger-2@test.local', 'password123', {
      first_name: 'Joan',
      last_name: 'García',
    })
    userIds.push(user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    expect(data!.first_name).toBe('Joan')
    expect(data!.last_name).toBe('García')
  })

  it('defaults to empty strings when no metadata provided', async () => {
    const user = await createTestUser('trigger-3@test.local', 'password123')
    userIds.push(user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    expect(data!.first_name).toBe('')
    expect(data!.last_name).toBe('')
  })
})

describe('generate_member_number()', () => {
  it('generates member number in 000-NNN format', async () => {
    const user = await createTestUser('trigger-num-1@test.local', 'password123')
    userIds.push(user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('member_number')
      .eq('id', user.id)
      .single()

    expect(data!.member_number).toMatch(/^000-\d{3,}$/)
  })

  it('auto-increments for consecutive users', async () => {
    const user1 = await createTestUser(
      'trigger-num-2@test.local',
      'password123'
    )
    const user2 = await createTestUser(
      'trigger-num-3@test.local',
      'password123'
    )
    userIds.push(user1.id, user2.id)

    const { data: d1 } = await supabaseAdmin
      .from('members')
      .select('member_number')
      .eq('id', user1.id)
      .single()

    const { data: d2 } = await supabaseAdmin
      .from('members')
      .select('member_number')
      .eq('id', user2.id)
      .single()

    const num1 = parseInt(d1!.member_number.split('-')[1])
    const num2 = parseInt(d2!.member_number.split('-')[1])
    expect(num2).toBeGreaterThan(num1)
  })
})


describe('members.card_token', () => {
  it('assigns a URL-safe token to a new member', async () => {
    const user = await createTestUser('trigger-token-1@test.local', 'password123')
    userIds.push(user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('card_token')
      .eq('id', user.id)
      .single()

    expect(data!.card_token).toMatch(/^[0-9a-f]{32}$/)
  })

  it('assigns a different token to each member', async () => {
    const user1 = await createTestUser('trigger-token-2@test.local', 'password123')
    const user2 = await createTestUser('trigger-token-3@test.local', 'password123')
    userIds.push(user1.id, user2.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('card_token')
      .in('id', [user1.id, user2.id])

    expect(data).toHaveLength(2)
    expect(data![0].card_token).not.toBe(data![1].card_token)
  })
})
