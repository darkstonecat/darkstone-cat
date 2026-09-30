import { describe, it, expect, afterAll } from 'vitest'
import { supabaseAdmin, cleanupUsers } from '../helpers/supabase'
import { discardUnconfirmedSignup, updateMemberAfterSignup } from '@/lib/supabase/actions'

const userIds: string[] = []
afterAll(() => cleanupUsers(userIds))

/** Local Supabase auto-confirms sign-ups, so the unconfirmed state is created explicitly. */
async function createUnconfirmed(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: false,
    user_metadata: { first_name: 'Sign', last_name: 'Up' },
  })
  if (error) throw error
  userIds.push(data.user.id)
  return data.user.id
}

describe('sign-up server actions (real Supabase)', () => {
  it('completes a fresh unconfirmed sign-up once, then refuses a second write', async () => {
    const id = await createUnconfirmed('signup-actions-1@test.local')
    expect(
      await updateMemberAfterSignup({ userId: id, dni: '12345678A', postal_code: '08221', newsletter_accepted: true })
    ).toEqual({ error: null })

    const { data } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
    expect(data!.postal_code).toBe('08221')
    expect(data!.dni_nie_encrypted).toBeTruthy()

    const again = await updateMemberAfterSignup({ userId: id, postal_code: '08222', newsletter_accepted: false })
    expect(again.error).toBeTruthy()
  })

  it('refuses a confirmed user', async () => {
    const { data } = await supabaseAdmin.auth.admin.createUser({
      email: 'signup-actions-2@test.local',
      password: 'password123',
      email_confirm: true,
    })
    userIds.push(data.user!.id)
    const result = await updateMemberAfterSignup({ userId: data.user!.id, phone: '612345678', newsletter_accepted: false })
    expect(result.error).toBeTruthy()
    expect((await discardUnconfirmedSignup(data.user!.id)).discarded).toBe(false)
  })

  it('discards a fresh unconfirmed sign-up with its member row', async () => {
    const id = await createUnconfirmed('signup-actions-3@test.local')
    expect(await discardUnconfirmedSignup(id)).toEqual({ discarded: true })
    const { data: member } = await supabaseAdmin.from('members').select('id').eq('id', id).maybeSingle()
    expect(member).toBeNull()
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(id)
    expect(user.user).toBeNull()
  })
})
