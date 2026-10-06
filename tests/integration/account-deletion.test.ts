import { describe, it, expect } from 'vitest'
import { supabaseAdmin, createTestUser } from '../helpers/supabase'

describe('account deletion', () => {
  it('deleting only the auth user removes the member row of an active member', async () => {
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

  it('deleting the auth user of a former member keeps the member row (register stub)', async () => {
    const user = await createTestUser('delete-former@test.local', 'password123')
    try {
      const { error: leaveError } = await supabaseAdmin
        .from('members')
        .update({ left_on: '2026-10-01', left_by: 'self' })
        .eq('id', user.id)
      expect(leaveError).toBeNull()
      await supabaseAdmin
        .from('member_badges')
        .insert({ member_id: user.id, badge_key: 'ludoteca_donor' })

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      expect(error).toBeNull()

      const { data: stub } = await supabaseAdmin
        .from('members')
        .select('id, member_number, left_on')
        .eq('id', user.id)
        .maybeSingle()
      expect(stub).toMatchObject({ id: user.id, left_on: '2026-10-01' })
      expect(stub!.member_number).toMatch(/^000-\d{3,}$/)

      // Badges stay with the blocked register (BR-7); only the purge removes them.
      const { data: badges } = await supabaseAdmin
        .from('member_badges')
        .select('badge_key')
        .eq('member_id', user.id)
      expect(badges).toEqual([{ badge_key: 'ludoteca_donor' }])
    } finally {
      await supabaseAdmin.from('members').delete().eq('id', user.id)
      await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined)
    }
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
