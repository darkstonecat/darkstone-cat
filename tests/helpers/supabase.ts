import { createHmac } from 'node:crypto'
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
 * Create a test admin user (creates user + sets role to 'board'; the legacy 'admin' role is
 * gone since M7, 20261007100000_roles_contract.sql).
 */
export async function createTestAdmin(email: string, password: string) {
  const user = await createTestUser(email, password, {
    first_name: 'Admin',
    last_name: 'Test',
  })
  await supabaseAdmin
    .from('members')
    .update({ role: 'board' })
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

// JWT secret of the local Supabase CLI stack (the demo keys in .github/workflows/ci.yml are
// signed with it). SUPABASE_JWT_SECRET overrides it for a stack with a custom secret.
const LOCAL_JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'

function signHs256(headerAndPayload: string) {
  return createHmac('sha256', LOCAL_JWT_SECRET).update(headerAndPayload).digest('base64url')
}

/**
 * A client that runs as `service_role` (full privileges, no RLS) while `auth.uid()` returns
 * `userId`. It stands in for a SECURITY DEFINER function called by that user: the database
 * code runs with elevated privileges but still sees who the caller is. Only for database
 * guards that key on `auth.uid()` (e.g. the role guard, BR-11).
 */
export function createServiceClientAs(userId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const [header, payload, signature] = serviceKey.split('.')
  if (!signature || signHs256(`${header}.${payload}`) !== signature) {
    throw new Error(
      'createServiceClientAs: SUPABASE_SERVICE_ROLE_KEY is not signed with the local JWT secret; set SUPABASE_JWT_SECRET'
    )
  }

  const claims = {
    iss: 'supabase-demo',
    role: 'service_role',
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const token = `${header}.${body}.${signHs256(`${header}.${body}`)}`

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

/**
 * Run one SQL statement as the `postgres` role (the owner of the public schema) through the
 * local stack's postgres-meta endpoint (`/pg/query`, behind the service role key). Only for
 * tests that must reach past the API roles, e.g. to prove that a trigger also stops the
 * owner. Pass values through `parameters` ($1, $2, …), never by string interpolation.
 */
export async function runSqlAsPostgres<T = Record<string, unknown>>(
  query: string,
  parameters: unknown[] = []
): Promise<{ data: T[] | null; error: { code?: string; message: string } | null }> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, parameters }),
  })
  const body = await res.json()
  if (!res.ok) {
    return { data: null, error: { code: body?.code, message: String(body?.message ?? body?.error) } }
  }
  return { data: body as T[], error: null }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Test teardown only: make a member a plain member past the role guard. The last two
 * superadmins can never lose the role through any guarded path (BR-10), so this disables the
 * role guard inside one `DO` block run as `postgres` (the table owner). The block is a single
 * transaction: other sessions wait on the table lock and never see the trigger disabled.
 * `DO` takes no parameters, so the id is checked against a strict UUID pattern first.
 */
export async function forceDemoteForTests(userId: string) {
  if (!UUID_PATTERN.test(userId)) throw new Error(`forceDemoteForTests: not a UUID: ${userId}`)
  const { error } = await runSqlAsPostgres(
    `DO $$
     BEGIN
       ALTER TABLE public.members DISABLE TRIGGER members_role_guard;
       UPDATE public.members SET role = 'member', role_since = NULL WHERE id = '${userId}';
       ALTER TABLE public.members ENABLE TRIGGER members_role_guard;
     END
     $$`
  )
  if (error) throw new Error(`forceDemoteForTests: ${error.message}`)
}

/**
 * Delete a test user — drops any role first (the role guard refuses to delete a role holder's
 * row, BR-12; the last two superadmins go through forceDemoteForTests), removes the members
 * row (a former member's row survives deleting the auth user), then deletes the auth.users
 * entry.
 */
export async function deleteTestUser(userId: string) {
  const demote = await supabaseAdmin
    .from('members')
    .update({ role: 'member' })
    .eq('id', userId)
    .neq('role', 'member')
  if (demote.error?.message.includes('role_guard:last_superadmin')) {
    await forceDemoteForTests(userId)
  }
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
