import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  createTestAdmin,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

let userA: { id: string }
let userB: { id: string }
let admin: { id: string }
const userIds: string[] = []

beforeAll(async () => {
  userA = await createTestUser('badge-a@test.local', 'password123')
  userB = await createTestUser('badge-b@test.local', 'password123')
  admin = await createTestAdmin('badge-admin@test.local', 'password123')
  userIds.push(userA.id, userB.id, admin.id)

  const { error } = await supabaseAdmin.from('member_badges').insert([
    { member_id: userA.id, badge_key: 'volunteer_egara_joga' },
    { member_id: userB.id, badge_key: 'ludoteca_donor' },
  ])
  if (error) throw error
})

afterAll(() => cleanupUsers(userIds))

describe('member_badges constraints', () => {
  it('rejects unknown badge keys', async () => {
    const { error } = await supabaseAdmin
      .from('member_badges')
      .insert({ member_id: userA.id, badge_key: 'made_up' })
    expect(error).not.toBeNull()
  })

  it('rejects a duplicate (member, badge) pair', async () => {
    const { error } = await supabaseAdmin
      .from('member_badges')
      .insert({ member_id: userA.id, badge_key: 'volunteer_egara_joga' })
    expect(error).not.toBeNull()
  })

  it('cascades when the member is deleted', async () => {
    const temp = await createTestUser('badge-temp@test.local', 'password123')
    await supabaseAdmin
      .from('member_badges')
      .insert({ member_id: temp.id, badge_key: 'ludoteca_donor' })
    await cleanupUsers([temp.id])

    const { data } = await supabaseAdmin
      .from('member_badges')
      .select('id')
      .eq('member_id', temp.id)
    expect(data).toHaveLength(0)
  })
})

describe('member_badges RLS', () => {
  it('member sees only their own badges', async () => {
    const client = await createAuthenticatedClient('badge-a@test.local', 'password123')
    const { data } = await client.from('member_badges').select('*')

    expect(data).toHaveLength(1)
    expect(data![0].member_id).toBe(userA.id)
    expect(data![0].badge_key).toBe('volunteer_egara_joga')
  })

  // T7b dropped member_badges_admins_select_all: board screens read badges through SECURITY
  // DEFINER functions, never directly.
  it("admin no longer reads other members' badges directly", async () => {
    const client = await createAuthenticatedClient('badge-admin@test.local', 'password123')
    const { data, error } = await client.from('member_badges').select('member_id')

    expect(error).toBeNull()
    const ids = data!.map((b) => b.member_id)
    expect(ids).not.toContain(userA.id)
    expect(ids).not.toContain(userB.id)
  })

  it('member cannot insert a badge for themselves', async () => {
    const client = await createAuthenticatedClient('badge-a@test.local', 'password123')
    const { error } = await client
      .from('member_badges')
      .insert({ member_id: userA.id, badge_key: 'ludoteca_donor' })
    expect(error).not.toBeNull()
  })

  it('member cannot update or delete badges (0 rows affected)', async () => {
    const client = await createAuthenticatedClient('badge-a@test.local', 'password123')
    const { data: updated } = await client
      .from('member_badges')
      .update({ badge_key: 'ludoteca_donor' })
      .eq('member_id', userA.id)
      .select()
    expect(updated ?? []).toHaveLength(0)

    const { data: deleted } = await client
      .from('member_badges')
      .delete()
      .eq('member_id', userA.id)
      .select()
    expect(deleted ?? []).toHaveLength(0)

    const { data: still } = await supabaseAdmin
      .from('member_badges')
      .select('id')
      .eq('member_id', userA.id)
    expect(still).toHaveLength(1)
  })

  it('admin cannot insert badges through the API either (service role only)', async () => {
    const client = await createAuthenticatedClient('badge-admin@test.local', 'password123')
    const { error } = await client
      .from('member_badges')
      .insert({ member_id: userB.id, badge_key: 'volunteer_egara_joga' })
    expect(error).not.toBeNull()
  })
})
