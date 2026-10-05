import { createClient } from '@supabase/supabase-js'

// Admin client — bypasses RLS, full access.
// persistSession: false prevents auth state from leaking to other clients
// sharing the same storage key in vitest.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

/**
 * Create a test user via Admin API.
 * The `handle_new_user()` trigger auto-creates a `members` row.
 * If user already exists (stale from a previous run), deletes and retries.
 */
export async function createTestUser(
  email: string,
  password: string,
  metadata?: { first_name?: string; last_name?: string }
) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (error?.message?.includes('already been registered')) {
    // Stale user from a previous run — find, delete, retry
    const { data: list } = await supabaseAdmin.auth.admin.listUsers()
    const existing = list.users.find((u) => u.email === email)
    if (existing) {
      await deleteTestUser(existing.id)
    }
    const retry = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (retry.error) throw retry.error
    return retry.data.user
  }

  if (error) throw error
  return data.user
}

/**
 * Create a test admin user (creates user + sets role to 'admin').
 */
export async function createTestAdmin(email: string, password: string) {
  const user = await createTestUser(email, password, {
    first_name: 'Admin',
    last_name: 'Test',
  })
  await supabaseAdmin
    .from('members')
    .update({ role: 'admin' })
    .eq('id', user.id)
  return user
}

/**
 * Create an authenticated Supabase client (subject to RLS).
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false } }
  )
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

/**
 * Delete a test user — removes the members row first (a former member's row
 * survives deleting the auth user), then deletes the auth.users entry.
 */
export async function deleteTestUser(userId: string) {
  await supabaseAdmin.from('members').delete().eq('id', userId)
  await supabaseAdmin.auth.admin.deleteUser(userId)
}

/**
 * Cleanup helper — deletes a list of test users, ignoring errors.
 */
export async function cleanupUsers(userIds: string[]) {
  for (const id of userIds) {
    try {
      await deleteTestUser(id)
    } catch {
      // Ignore cleanup errors (user may already be deleted)
    }
  }
}
