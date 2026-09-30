import { describe, it, expect, afterAll } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  cleanupUsers,
} from '../helpers/supabase'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'

const userIds: string[] = []

afterAll(() => cleanupUsers(userIds))

describe('signup → member creation', () => {
  it('creates auth user and member row via trigger', async () => {
    const user = await createTestUser('auth-signup@test.local', 'password123', {
      first_name: 'Signup',
      last_name: 'Test',
    })
    userIds.push(user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', user.id)
      .single()

    expect(data).not.toBeNull()
    expect(data!.first_name).toBe('Signup')
    expect(data!.last_name).toBe('Test')
    expect(data!.role).toBe('member')
    expect(data!.member_number).toMatch(/^000-\d{3}$/)
    expect(data!.membership_start_date).toBeTruthy()
  })
})

describe('updateMemberAfterSignup with real DB', () => {
  it('encrypts phone/DNI and sets acceptance flags', async () => {
    // The action only completes a fresh, unconfirmed sign-up
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: 'auth-after@test.local',
      password: 'password123',
      email_confirm: false,
    })
    if (createError) throw createError
    const user = created.user
    userIds.push(user.id)

    const { updateMemberAfterSignup } = await import(
      '@/lib/supabase/actions'
    )
    const result = await updateMemberAfterSignup({
      userId: user.id,
      phone: '612345678',
      dni: '12345678A',
      postal_code: '08221',
      ludoya_username: 'testuser',
      newsletter_accepted: false,
    })

    expect(result.error).toBeNull()

    const { data } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('id', user.id)
      .single()

    // Plain fields
    expect(data!.postal_code).toBe('08221')
    expect(data!.ludoya_username).toBe('testuser')
    expect(data!.newsletter_accepted).toBe(false)

    // Encrypted fields — stored encrypted, decryptable
    expect(data!.phone_encrypted).not.toBe('612345678')
    expect(data!.dni_nie_encrypted).not.toBe('12345678A')
    expect(decrypt(data!.phone_encrypted!)).toBe('612345678')
    expect(decrypt(data!.dni_nie_encrypted!)).toBe('12345678A')
  })
})

describe('login flow', () => {
  it('signInWithPassword returns valid session', async () => {
    const user = await createTestUser('auth-login@test.local', 'password123')
    userIds.push(user.id)

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const { data, error } = await client.auth.signInWithPassword({
      email: 'auth-login@test.local',
      password: 'password123',
    })

    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    expect(data.session!.access_token).toBeTruthy()
    expect(data.user!.id).toBe(user.id)
  })

  it('rejects invalid credentials', async () => {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const { error } = await client.auth.signInWithPassword({
      email: 'auth-login@test.local',
      password: 'wrong-password',
    })

    expect(error).not.toBeNull()
  })
})

describe('encrypt → DB → decrypt roundtrip', () => {
  it('encrypted data survives DB storage and is recoverable', async () => {
    const user = await createTestUser('auth-crypt@test.local', 'password123')
    userIds.push(user.id)

    const originalPhone = '+34 612 345 678'
    const encrypted = encrypt(originalPhone)

    await supabaseAdmin
      .from('members')
      .update({ phone_encrypted: encrypted })
      .eq('id', user.id)

    const { data } = await supabaseAdmin
      .from('members')
      .select('phone_encrypted')
      .eq('id', user.id)
      .single()

    expect(decrypt(data!.phone_encrypted!)).toBe(originalPhone)
  })
})
