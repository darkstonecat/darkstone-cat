import { describe, it, expect } from 'vitest'
import { supabaseAdmin, createTestUser } from '../helpers/supabase'

describe('account deletion', () => {
  it('deleting only the auth user removes the member row (ON DELETE CASCADE)', async () => {
    const user = await createTestUser('delete-1@test.local', 'password123')

    const { data: before } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('id', user.id)
      .single()
    expect(before).not.toBeNull()

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    expect(error).toBeNull()

    const { data: afterMember } = await supabaseAdmin
      .from('members')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    expect(afterMember).toBeNull()
  })

  it('also removes the member badges through the members cascade', async () => {
    const user = await createTestUser('delete-badges@test.local', 'password123')
    const { error: insertError } = await supabaseAdmin
      .from('member_badges')
      .insert({ member_id: user.id, badge_key: 'ludoteca_donor' })
    expect(insertError).toBeNull()

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    expect(error).toBeNull()

    const { data: remaining } = await supabaseAdmin
      .from('member_badges')
      .select('member_id')
      .eq('member_id', user.id)
    expect(remaining).toEqual([])
  })

  it('auth.users entry is removed after deletion', async () => {
    const user = await createTestUser('delete-2@test.local', 'password123')

    await supabaseAdmin.auth.admin.deleteUser(user.id)

    const { data } = await supabaseAdmin.auth.admin.getUserById(user.id)
    expect(data.user).toBeNull()
  })

  it('deleting non-existent user returns error', async () => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(
      '00000000-0000-0000-0000-000000000000'
    )
    expect(error).not.toBeNull()
  })
})
