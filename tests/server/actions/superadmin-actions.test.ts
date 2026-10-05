import { format } from 'node:util'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

// S-1/S-2 setMemberRole and S-3 anonymiseMember (src/lib/admin/superadmin-actions.ts). The
// guard, the session client, the service-role client (only its Auth admin API may be used, for
// the account deletion) and next/cache are mocked.

type DbResult = { data: unknown; error: { code?: string; message: string } | null }

const db = vi.hoisted(() => ({
  access: { status: 'ok', actor: { id: 'actor-id', role: 'superadmin' } } as
    | { status: 'ok'; actor: { id: string; role: string } }
    | { status: 'unauthenticated' }
    | { status: 'forbidden' },
  getAdminAccess: vi.fn(),
  rpc: vi.fn(),
  result: { data: null, error: null } as DbResult,
  adminRpc: vi.fn(),
  adminFrom: vi.fn(),
  deleteUser: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: db.revalidatePath }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminAccess: async (min: string) => (db.getAdminAccess(min), db.access),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: unknown) => (db.rpc(fn, args), db.result),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: db.adminRpc,
    from: db.adminFrom,
    auth: { admin: { deleteUser: db.deleteUser } },
  }),
}))

import { anonymiseMember, setMemberRole } from '@/lib/admin/superadmin-actions'

const TARGET = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const NUMBER = '000-154'
const REASON = 'Petició de supressió per correu'

let consoleSpies: MockInstance[]
function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .map((call) => format(...(call as [unknown, ...unknown[]])))
    .join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'superadmin' } }
  db.result = { data: null, error: null }
  db.deleteUser.mockResolvedValue({ data: {}, error: null })
  consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {})
  )
})

const lastRpc = () => db.rpc.mock.calls.at(-1) as [string, Record<string, unknown>]

describe('guard (both actions need superadmin)', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['setMemberRole', () => setMemberRole(TARGET, 'board')],
    ['anonymiseMember', () => anonymiseMember(TARGET, NUMBER)],
  ]

  it.each(calls)('%s asks for the superadmin level', async (_name, call) => {
    await call()
    expect(db.getAdminAccess).toHaveBeenCalledWith('superadmin')
  })

  it.each(calls)('%s refuses a board member (forbidden) without touching the database', async (_name, call) => {
    db.access = { status: 'forbidden' }
    expect(await call()).toEqual({ error: 'forbidden' })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.deleteUser).not.toHaveBeenCalled()
  })

  it.each(calls)('%s requires a session', async (_name, call) => {
    db.access = { status: 'unauthenticated' }
    expect(await call()).toEqual({ error: 'unauthenticated' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('a malformed member id is invalid', async () => {
    expect(await setMemberRole('000-154', 'board')).toEqual({ error: 'invalid' })
    expect(await anonymiseMember(42 as unknown as string, NUMBER)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

describe('setMemberRole (S-1, S-2)', () => {
  it('calls admin_set_role with the SESSION client and returns the change', async () => {
    db.result = { data: [{ action: 'role.grant', role: 'board', role_since: '2026-10-05T10:00:00+00:00' }], error: null }
    expect(await setMemberRole(TARGET.toUpperCase(), 'board', '  Elegida a l\'assemblea  ')).toEqual({
      ok: true,
      action: 'role.grant',
      role: 'board',
      roleSince: '2026-10-05T10:00:00+00:00',
    })
    expect(lastRpc()).toEqual([
      'admin_set_role',
      { p_member_id: TARGET, p_role: 'board', p_reason: 'Elegida a l\'assemblea' },
    ])
    expect(db.adminRpc).not.toHaveBeenCalled()
    expect(db.adminFrom).not.toHaveBeenCalled()
  })

  it('a revoke returns role.revoke and a null role_since; a blank reason is null', async () => {
    db.result = { data: [{ action: 'role.revoke', role: 'member', role_since: null }], error: null }
    expect(await setMemberRole(TARGET, 'member', '   ')).toEqual({
      ok: true,
      action: 'role.revoke',
      role: 'member',
      roleSince: null,
    })
    expect(lastRpc()[1].p_reason).toBeNull()
  })

  it('revalidates the member pages and the roles page', async () => {
    db.result = { data: [{ action: 'role.grant', role: 'superadmin', role_since: null }], error: null }
    await setMemberRole(TARGET, 'superadmin')
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members', 'page')
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/roles', 'page')
  })

  it.each([['admin'], ['owner'], [''], [null], [42]])('refuses the role %j before the database', async (role) => {
    expect(await setMemberRole(TARGET, role as 'board')).toEqual({ error: 'invalid_role' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('refuses a reason over 500 characters or of the wrong type before the database', async () => {
    expect(await setMemberRole(TARGET, 'board', 'x'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(await setMemberRole(TARGET, 'board', 7 as unknown as string)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['role_guard:self_role_change: nobody can change their own role', '23514', 'self_role_change'],
    ['role_guard:last_superadmin: at least two superadmins must remain', '23514', 'last_superadmin'],
    ['role_guard:former_member_role: a former member cannot hold a role', '23514', 'former_member_role'],
    ['role_guard:role_held: remove the role first', '23514', 'role_held'],
    ['admin:role_unchanged: the member already holds this role', '22023', 'role_unchanged'],
    ['admin:not_found: no such member', '22023', 'not_found'],
    ['admin:forbidden: superadmin role required', '42501', 'forbidden'],
    ['admin:reason_too_long: at most 500', '22023', 'reason_too_long'],
    ['admin:isolation: role changes need READ COMMITTED', '25000', 'failed'],
  ])('maps %s to %s, without revalidating', async (message, code, expected) => {
    db.result = { data: null, error: { code, message } }
    expect(await setMemberRole(TARGET, 'member')).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
    expect(consoleOutput()).toContain(`set_member_role failed code=${code}`)
    expect(consoleOutput()).not.toContain(message)
  })
})

describe('anonymiseMember (S-3)', () => {
  const anonymised = { data: [{ member_number: NUMBER, purge_on: '2029-09-15' }], error: null }
  const already = {
    data: null,
    error: { code: '22023', message: 'admin:already_anonymised: this record was anonymised already' },
  }

  it('anonymises with the SESSION client, then deletes the login account with the Auth admin API', async () => {
    db.result = anonymised
    expect(await anonymiseMember(TARGET, `  ${NUMBER} `, REASON)).toEqual({
      ok: true,
      accountDeleted: true,
      alreadyAnonymised: false,
      purgeOn: '2029-09-15',
    })
    expect(lastRpc()).toEqual([
      'admin_anonymise_member',
      { p_member_id: TARGET, p_confirm_number: NUMBER, p_reason: REASON },
    ])
    expect(db.adminRpc).not.toHaveBeenCalled()
    expect(db.deleteUser).toHaveBeenCalledWith(TARGET)
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
  })

  it('an account that is already gone (404 / user_not_found) counts as deleted', async () => {
    db.result = anonymised
    db.deleteUser.mockResolvedValue({ data: null, error: { status: 404, code: 'user_not_found', message: 'User not found' } })
    expect(await anonymiseMember(TARGET, NUMBER)).toMatchObject({ ok: true, accountDeleted: true })
    db.deleteUser.mockResolvedValue({ data: null, error: { status: 404, message: 'User not found' } })
    expect(await anonymiseMember(TARGET, NUMBER)).toMatchObject({ ok: true, accountDeleted: true })
  })

  it('a failed deletion keeps ok (the record is anonymised) with accountDeleted false and logs only the code', async () => {
    db.result = anonymised
    db.deleteUser.mockResolvedValue({
      data: null,
      error: { status: 500, code: 'unexpected_failure', message: 'Database error deleting user laia@example.com' },
    })
    expect(await anonymiseMember(TARGET, NUMBER)).toEqual({
      ok: true,
      accountDeleted: false,
      alreadyAnonymised: false,
      purgeOn: '2029-09-15',
    })
    expect(consoleOutput()).toContain('anonymise_delete_account failed code=unexpected_failure')
    expect(consoleOutput()).not.toContain('laia')
  })

  it('a deletion that throws is accountDeleted false', async () => {
    db.result = anonymised
    db.deleteUser.mockRejectedValue(new Error('fetch failed'))
    expect(await anonymiseMember(TARGET, NUMBER)).toMatchObject({ ok: true, accountDeleted: false })
  })

  it('retry: already_anonymised still deletes the account and answers ok (idempotent)', async () => {
    db.result = already
    expect(await anonymiseMember(TARGET, NUMBER)).toEqual({
      ok: true,
      accountDeleted: true,
      alreadyAnonymised: true,
      purgeOn: null,
    })
    expect(db.deleteUser).toHaveBeenCalledWith(TARGET)

    db.deleteUser.mockResolvedValue({ data: null, error: { status: 404, code: 'user_not_found', message: 'x' } })
    expect(await anonymiseMember(TARGET, NUMBER)).toMatchObject({ ok: true, accountDeleted: true, alreadyAnonymised: true })
  })

  it.each([
    ['admin:confirm_mismatch: type the member number to confirm', 'confirm_mismatch'],
    ['admin:not_former: only a former member can be anonymised', 'not_former'],
    ['admin:not_found: no such member', 'not_found'],
    ['admin:forbidden: superadmin role required', 'forbidden'],
    ['admin:reason_too_long: at most 500', 'reason_too_long'],
  ])('maps %s to %s and never deletes the account', async (message, expected) => {
    db.result = { data: null, error: { code: '22023', message } }
    expect(await anonymiseMember(TARGET, NUMBER)).toEqual({ error: expected })
    expect(db.deleteUser).not.toHaveBeenCalled()
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })

  it.each([[''], ['   '], ['0'.repeat(33)]])('a blank or oversized confirmation %j is confirm_mismatch, no database call', async (confirm) => {
    expect(await anonymiseMember(TARGET, confirm)).toEqual({ error: 'confirm_mismatch' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('a confirmation that is not a string is invalid; a long reason is reason_too_long', async () => {
    expect(await anonymiseMember(TARGET, 154 as unknown as string)).toEqual({ error: 'invalid' })
    expect(await anonymiseMember(TARGET, NUMBER, 'x'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.deleteUser).not.toHaveBeenCalled()
  })
})
