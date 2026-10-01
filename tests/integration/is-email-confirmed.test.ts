import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, cleanupUsers } from '../helpers/supabase'

const userIds: string[] = []
afterAll(() => cleanupUsers(userIds))

const anon = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false } }
  )

describe('public.is_email_confirmed()', () => {
  it('is true for a confirmed account, whatever the case or padding of the email', async () => {
    const user = await createTestUser('is-confirmed@test.local', 'password123')
    userIds.push(user.id)
    for (const email of ['is-confirmed@test.local', ' Is-Confirmed@Test.Local ']) {
      const { data, error } = await supabaseAdmin.rpc('is_email_confirmed', { p_email: email })
      expect(error).toBeNull()
      expect(data).toBe(true)
    }
  })

  it('is false for an unconfirmed account (pre-registered email)', async () => {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'is-unconfirmed@test.local',
      password: 'password123',
      email_confirm: false,
    })
    if (createError) throw createError
    userIds.push(created.user.id)
    const { data, error } = await supabaseAdmin.rpc('is_email_confirmed', {
      p_email: 'is-unconfirmed@test.local',
    })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('is false for an unknown email', async () => {
    const { data, error } = await supabaseAdmin.rpc('is_email_confirmed', {
      p_email: 'nobody-here@test.local',
    })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('is not callable by anon (no enumeration from the browser)', async () => {
    const { data, error } = await anon().rpc('is_email_confirmed', { p_email: 'is-confirmed@test.local' })
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('is not callable by an authenticated member', async () => {
    const user = await createTestUser('is-confirmed-auth@test.local', 'password123')
    userIds.push(user.id)
    const client = anon()
    await client.auth.signInWithPassword({ email: 'is-confirmed-auth@test.local', password: 'password123' })
    const { data, error } = await client.rpc('is_email_confirmed', { p_email: 'is-confirmed@test.local' })
    expect(data).toBeNull()
    expect(error?.code).toBe('42501')
  })
})
