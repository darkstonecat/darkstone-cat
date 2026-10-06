import { format } from 'node:util'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

// Self leave (M-1), src/lib/profile/leave-actions.ts. The session client, the server-side
// sign-out, next/cache and the mail module are mocked.

const db = vi.hoisted(() => ({
  user: { id: 'user-id' } as { id: string } | null,
  rpc: vi.fn(),
  result: { data: null, error: null } as { data: unknown; error: { code?: string; message: string } | null },
  signOut: vi.fn(),
  revalidatePath: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: db.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user }, error: null }) },
    rpc: async (fn: string, args: unknown) => (db.rpc(fn, args), db.result),
  }),
}))
vi.mock('@/lib/supabase/session-actions', () => ({ signOutCurrentSession: db.signOut }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('the service role must never be used by the self leave')
  },
}))
vi.mock('@/lib/mail', () => ({ sendMail: db.sendMail }))

import { leaveAssociation } from '@/lib/profile/leave-actions'

const REASON = 'Em trasllado a viure fora de Terrassa'
let consoleSpies: MockInstance[]

function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    // util.format applies the %s substitutions console.* would do; objects are inspected.
    .map((call) => format(...(call as [unknown, ...unknown[]])))
    .join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  db.user = { id: 'user-id' }
  db.result = { data: [{ member_number: '000-203', left_on: '2026-10-05' }], error: null }
  db.signOut.mockResolvedValue({ error: null })
  consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {})
  )
})

describe('leaveAssociation (M-1)', () => {
  it('requires a signed-in user', async () => {
    db.user = null
    expect(await leaveAssociation()).toEqual({ error: 'unauthenticated' })
    // authorise first: an anonymous caller learns nothing about the input rules
    expect(await leaveAssociation('x'.repeat(501))).toEqual({ error: 'unauthenticated' })
    expect(await leaveAssociation(42 as never)).toEqual({ error: 'unauthenticated' })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.signOut).not.toHaveBeenCalled()
  })

  it('calls member_leave_self, then signs the session out server-side', async () => {
    expect(await leaveAssociation()).toEqual({ ok: true })
    expect(db.rpc).toHaveBeenCalledWith('member_leave_self', { p_reason: null })
    expect(db.signOut).toHaveBeenCalledOnce()
    expect(db.rpc.mock.invocationCallOrder[0]).toBeLessThan(db.signOut.mock.invocationCallOrder[0])
  })

  it('passes an optional reason trimmed; blank → null', async () => {
    await leaveAssociation(`  ${REASON}  `)
    expect(db.rpc).toHaveBeenLastCalledWith('member_leave_self', { p_reason: REASON })
    await leaveAssociation('   ')
    expect(db.rpc).toHaveBeenLastCalledWith('member_leave_self', { p_reason: null })
  })

  it('refuses a reason over 500 code points or not a string, without a database call', async () => {
    expect(await leaveAssociation('x'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(await leaveAssociation(42 as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('still answers ok when the sign-out fails (the leave already ended every session)', async () => {
    db.signOut.mockResolvedValueOnce({ error: 'signout_failed' })
    expect(await leaveAssociation()).toEqual({ ok: true })
  })

  it('sends no e-mail (the spec defines none for M-1)', async () => {
    await leaveAssociation(REASON)
    expect(db.sendMail).not.toHaveBeenCalled()
  })

  it.each([
    ['membership:role_held: a superadmin must revoke your role before you leave', '23514', 'role_held'],
    ['membership:not_active: you have already left', '22023', 'not_active'],
    ['membership:reason_too_long: at most 500 characters', '22023', 'reason_too_long'],
    ['membership:forbidden: a signed-in member is required', '42501', 'unauthenticated'],
    ['TypeError: fetch failed', '', 'failed'],
    ['membership:not_found: unknown member', '22023', 'failed'],
  ])('maps %s to %s, keeps the session, logs only the code', async (message, code, expected) => {
    db.result = { data: null, error: { code, message: `${message} ${REASON}` } }
    expect(await leaveAssociation(REASON)).toEqual({ error: expected })
    expect(db.signOut).not.toHaveBeenCalled()
    const out = consoleOutput()
    expect(out).toContain('[member-leave] failed code=')
    expect(out).not.toContain(REASON)
    expect(out).not.toContain('membership:')
  })
})
