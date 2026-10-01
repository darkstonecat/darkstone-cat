import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, cleanupUsers } from '../helpers/supabase'
import { countMessagesTo, waitForConfirmationLink } from '../../e2e/helpers/mailpit'

// Every test gets its own client IP so the shared limiter never carries over.
let ip = '203.0.113.1'
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': ip }),
}))

import { prepareSignup } from '@/lib/supabase/actions'

const userIds: string[] = []
const emails: string[] = []
afterAll(async () => {
  await cleanupUsers(userIds)
  for (const email of emails) {
    const { data } = await supabaseAdmin.rpc('unconfirmed_user_id', { p_email: email })
    if (typeof data === 'string') await supabaseAdmin.auth.admin.deleteUser(data)
  }
})
beforeEach(() => {
  ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}-${Date.now()}-${Math.random()}`
})

const anon = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false } }
  )

const unique = (tag: string) => `prepare-${tag}-${Date.now()}@test.local`

async function waitForMessageCount(email: string, atLeast: number) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if ((await countMessagesTo(email)) >= atLeast) return
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`mail ${atLeast} for ${email} never arrived`)
}

describe('public.unconfirmed_user_id()', () => {
  it('returns the id of an unconfirmed user only, whatever the case of the email', async () => {
    const email = unique('fn')
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: false,
    })
    if (error) throw error
    userIds.push(created.user.id)
    const { data } = await supabaseAdmin.rpc('unconfirmed_user_id', { p_email: ` ${email.toUpperCase()} ` })
    expect(data).toBe(created.user.id)

    const confirmed = await createTestUser('prepare-confirmed-fn@test.local', 'password123')
    userIds.push(confirmed.id)
    const { data: none } = await supabaseAdmin.rpc('unconfirmed_user_id', { p_email: 'prepare-confirmed-fn@test.local' })
    expect(none).toBeNull()
    const { data: unknown } = await supabaseAdmin.rpc('unconfirmed_user_id', { p_email: 'nobody-here@test.local' })
    expect(unknown).toBeNull()
  })

  it('is not callable by anon or an authenticated member', async () => {
    const anonResult = await anon().rpc('unconfirmed_user_id', { p_email: 'x@test.local' })
    expect(anonResult.data).toBeNull()
    expect(anonResult.error?.code).toBe('42501')

    const user = await createTestUser('prepare-authenticated@test.local', 'password123')
    userIds.push(user.id)
    const client = anon()
    await client.auth.signInWithPassword({ email: 'prepare-authenticated@test.local', password: 'password123' })
    const result = await client.rpc('unconfirmed_user_id', { p_email: 'x@test.local' })
    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('42501')
  })
})

describe('prepareSignup() against GoTrue', () => {
  it('last sign-up wins: the attacker password dies, the victim password works after confirming', async () => {
    const email = unique('hijack')
    emails.push(email)

    // The attacker pre-registers the victim's email and never confirms it.
    const attacker = await anon().auth.signUp({ email, password: 'attacker-pass-1' })
    expect(attacker.error).toBeNull()
    const attackerId = attacker.data.user!.id
    await waitForMessageCount(email, 1)

    // The victim signs up for real: prepare first, then the browser's signUp.
    expect(await prepareSignup(email)).toEqual({ ok: true })
    const { data: gone } = await supabaseAdmin.auth.admin.getUserById(attackerId)
    expect(gone.user).toBeNull()
    const { data: row } = await supabaseAdmin.from('members').select('id').eq('id', attackerId).maybeSingle()
    expect(row).toBeNull()

    const victim = await anon().auth.signUp({ email, password: 'victim-pass-2' })
    expect(victim.error).toBeNull()
    expect(victim.data.user!.id).not.toBe(attackerId)
    userIds.push(victim.data.user!.id)
    await waitForMessageCount(email, 2)

    // The victim confirms the email from the mail they received.
    const link = await waitForConfirmationLink(email)
    const verify = await fetch(link, { redirect: 'manual' })
    expect([302, 303]).toContain(verify.status)

    const attackerLogin = await anon().auth.signInWithPassword({ email, password: 'attacker-pass-1' })
    expect(attackerLogin.error).not.toBeNull()
    expect(attackerLogin.data.session).toBeNull()
    const victimLogin = await anon().auth.signInWithPassword({ email, password: 'victim-pass-2' })
    expect(victimLogin.error).toBeNull()
    expect(victimLogin.data.session).not.toBeNull()
  })

  it('never deletes a confirmed account', async () => {
    const email = 'prepare-confirmed@test.local'
    const user = await createTestUser(email, 'password123')
    userIds.push(user.id)
    expect(await prepareSignup(email)).toEqual({ ok: true })
    const { data } = await supabaseAdmin.auth.admin.getUserById(user.id)
    expect(data.user?.id).toBe(user.id)
    const { data: row } = await supabaseAdmin.from('members').select('id').eq('id', user.id).maybeSingle()
    expect(row?.id).toBe(user.id)
  })

  it('answers the same for an unknown email and creates nothing', async () => {
    expect(await prepareSignup('prepare-nobody@test.local')).toEqual({ ok: true })
    const { data } = await supabaseAdmin.rpc('unconfirmed_user_id', { p_email: 'prepare-nobody@test.local' })
    expect(data).toBeNull()
  })
})
