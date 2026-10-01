import { describe, it, expect, afterAll, vi } from 'vitest'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { createTestUser, cleanupUsers } from '../helpers/supabase'

// In-memory stand-in for the Next.js cookie store, shared by the "browser"
// (sign-in) and the server action (sign-out), like real cookies would be.
const jar = vi.hoisted(() => new Map<string, string>())

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      if (value === '') jar.delete(name)
      else jar.set(name, value)
    },
  }),
}))

import { signOutCurrentSession } from '@/lib/supabase/session-actions'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
const userIds: string[] = []
afterAll(() => cleanupUsers(userIds))

function ssrClient() {
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) =>
        list.forEach(({ name, value }) => {
          if (value === '') jar.delete(name)
          else jar.set(name, value)
        }),
    },
  })
}

async function refresh(refreshToken: string) {
  const anon = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  return anon.auth.refreshSession({ refresh_token: refreshToken })
}

describe('signOutCurrentSession (real Supabase)', () => {
  it('revokes the current refresh token and clears the cookies, but keeps other sessions', async () => {
    const email = 'session-signout@test.local'
    const user = await createTestUser(email, 'password123')
    userIds.push(user.id)

    // A second session of the same user (another device)
    const other = createClient(URL, KEY, { auth: { persistSession: false } })
    const otherSignIn = await other.auth.signInWithPassword({ email, password: 'password123' })
    const otherRefresh = otherSignIn.data.session!.refresh_token

    // The session being signed out, held in cookies
    jar.clear()
    const supabase = ssrClient()
    const signIn = await supabase.auth.signInWithPassword({ email, password: 'password123' })
    expect(signIn.error).toBeNull()
    const staleRefresh = signIn.data.session!.refresh_token
    expect(jar.size).toBeGreaterThan(0)

    expect(await signOutCurrentSession()).toEqual({ error: null })

    // Cookies are gone and the old refresh token no longer works
    expect(jar.size).toBe(0)
    const revoked = await refresh(staleRefresh)
    expect(revoked.error).not.toBeNull()
    expect(revoked.data.session).toBeNull()

    // scope "local": the other device stays signed in
    const still = await refresh(otherRefresh)
    expect(still.error).toBeNull()
    expect(still.data.session).not.toBeNull()
  })

  it('never throws without a session', async () => {
    jar.clear()
    expect(await signOutCurrentSession()).toEqual({ error: null })
  })
})
