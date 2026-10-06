import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client for E2E test user management.
 * Uses service role key to bypass RLS.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.\n' +
      'Ensure .env.test.local is loaded and Supabase local is running.'
    )
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Create a test user with confirmed email (skips email verification).
 * Also creates the corresponding member row.
 */
export async function createTestUser(opts: {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: 'member' | 'board'
}) {
  const supabase = getAdminClient()

  // Create auth user with confirmed email
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: opts.email,
      password: opts.password,
      email_confirm: true,
      user_metadata: {
        first_name: opts.firstName,
        last_name: opts.lastName,
      },
    })

  let userId: string
  if (authError) {
    // If the user already exists (left over by a previous run), reuse it
    const existing = authError.message.includes('already been registered')
      ? (await supabase.auth.admin.listUsers()).data?.users?.find((u) => u.email === opts.email)
      : undefined
    if (!existing) throw new Error(`Failed to create user ${opts.email}: ${authError.message}`)
    userId = existing.id
  } else {
    userId = authData.user.id
  }

  // Board role (the legacy 'admin' role is gone since M7). Also set on a reused user: a previous
  // teardown may have demoted it before failing to delete it.
  if (opts.role === 'board') {
    const { error: updateError } = await supabase
      .from('members')
      .update({ role: 'board' })
      .eq('id', userId)
      .neq('role', 'board')

    if (updateError) {
      console.warn(`Warning: Could not set the board role for ${opts.email}: ${updateError.message}`)
    }
  }

  return userId
}

/**
 * Drop any role first: the database refuses to delete a role holder's row (BR-12,
 * members_role_delete_guard), and e2e-admin holds the board role. E2E never creates
 * superadmins, so the last-superadmin rule never applies here.
 */
async function demoteToMember(supabase: ReturnType<typeof getAdminClient>, userId: string) {
  const { error } = await supabase
    .from('members')
    .update({ role: 'member' })
    .eq('id', userId)
    .neq('role', 'member')
  if (error) console.warn(`Warning: Could not remove the role of ${userId}: ${error.message}`)
}

/**
 * Delete a test user and its member row.
 * The member row is auto-deleted by the trigger (or we delete manually).
 */
export async function deleteTestUser(email: string) {
  const supabase = getAdminClient()

  // Find user by email
  const { data: list } = await supabase.auth.admin.listUsers()
  const user = list?.users?.find((u) => u.email === email)
  if (!user) return

  await demoteToMember(supabase, user.id)

  // Delete member row first (FK constraint)
  await supabase.from('members').delete().eq('id', user.id)

  // Delete auth user
  const { error } = await supabase.auth.admin.deleteUser(user.id)
  if (error) {
    console.warn(`Warning: Could not delete user ${email}: ${error.message}`)
  }
}

/**
 * Delete a user by their ID (for register test cleanup).
 */
export async function deleteTestUserById(userId: string) {
  const supabase = getAdminClient()
  await demoteToMember(supabase, userId)
  await supabase.from('members').delete().eq('id', userId)
  await supabase.auth.admin.deleteUser(userId)
}

/**
 * Find a user by email and return their ID.
 */
export async function findUserByEmail(email: string): Promise<string | null> {
  const supabase = getAdminClient()
  const { data: list } = await supabase.auth.admin.listUsers()
  const user = list?.users?.find((u) => u.email === email)
  return user?.id ?? null
}

/**
 * Create a user whose email was never confirmed: what a stranger leaves behind when
 * they pre-register someone else's email with their own password.
 */
export async function createUnconfirmedUser(email: string, password: string): Promise<string> {
  const supabase = getAdminClient()
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: false })
  if (error) throw new Error(`Failed to create unconfirmed user ${email}: ${error.message}`)
  return data.user.id
}

/**
 * Member number (e.g. `000-203`) of a user, read with the service role.
 */
export async function getMemberNumber(email: string): Promise<string> {
  const id = await findUserByEmail(email)
  if (!id) throw new Error(`No user ${email}`)
  const { data, error } = await getAdminClient().from('members').select('member_number').eq('id', id).single()
  if (error || !data) throw new Error(`No member row for ${email}: ${error?.message}`)
  return data.member_number as string
}
