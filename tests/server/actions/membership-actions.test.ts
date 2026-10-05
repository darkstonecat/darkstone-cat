import { format } from 'node:util'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

// Board leave (A-6) and rejoin (A-7) actions, src/lib/admin/membership-actions.ts. The guard,
// the session client, next/cache and the mail module are mocked.

const db = vi.hoisted(() => ({
  access: { status: 'ok', actor: { id: 'actor-id', role: 'board' } } as
    | { status: 'ok'; actor: { id: string; role: string } }
    | { status: 'unauthenticated' }
    | { status: 'forbidden' },
  rpc: vi.fn(),
  result: { data: null, error: null } as { data: unknown; error: { code?: string; message: string } | null },
  revalidatePath: vi.fn(),
  getAdminAccess: vi.fn(),
  sendMail: vi.fn(),
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
  createAdminClient: () => {
    throw new Error('the service role must never be used by membership actions')
  },
}))
vi.mock('@/lib/mail', () => ({ sendMail: db.sendMail }))

import { leaveMember, rejoinMember } from '@/lib/admin/membership-actions'

const TARGET = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const EMAIL = 'laia.serra@example.com'
const REASON = 'Incompliment reiterat de les pautes de conducta'
const NOTE = 'Ho va demanar per correu des del compte'

let consoleSpies: MockInstance[]

function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    // util.format applies the %s substitutions console.* would do; objects are inspected.
    .map((call) => format(...(call as [unknown, ...unknown[]])))
    .join('\n')
}

const leaveRow = { member_number: '000-203', email: EMAIL, first_name: 'Laia', left_on: '2026-10-05' }
const rejoinRow = { member_number: '000-087', email: EMAIL, first_name: 'Laia', current_joined_on: '2026-10-05' }

beforeEach(() => {
  vi.clearAllMocks()
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'board' } }
  db.result = { data: null, error: null }
  db.sendMail.mockResolvedValue({ ok: true })
  consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {})
  )
})

const lastRpc = () => db.rpc.mock.calls.at(-1) as [string, Record<string, unknown>]

// ---------------------------------------------------------------------------------------------
describe('guard (both actions)', () => {
  const calls: [string, (id?: unknown) => Promise<unknown>][] = [
    ['leaveMember', (id = TARGET) => leaveMember(id as string, REASON)],
    ['rejoinMember', (id = TARGET) => rejoinMember(id as string, 'email')],
  ]

  it.each(calls)('%s requires a session', async (_name, call) => {
    db.access = { status: 'unauthenticated' }
    expect(await call()).toEqual({ error: 'unauthenticated' })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.sendMail).not.toHaveBeenCalled()
  })

  it.each(calls)('%s requires a board role', async (_name, call) => {
    db.access = { status: 'forbidden' }
    expect(await call()).toEqual({ error: 'forbidden' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each(calls)('%s asks the guard for board', async (_name, call) => {
    await call()
    expect(db.getAdminAccess).toHaveBeenCalledWith('board')
  })

  it.each(calls)('%s rejects a member id that is not a UUID without a database call', async (_name, call) => {
    for (const id of ['000-203', '', 5, null, { id: TARGET }]) {
      expect(await call(id)).toEqual({ error: 'invalid' })
    }
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
describe('leaveMember (A-6)', () => {
  it('calls admin_member_leave with the trimmed reason and today (null) by default', async () => {
    db.result = { data: [leaveRow], error: null }
    expect(await leaveMember(TARGET.toUpperCase(), `  ${REASON}  `)).toEqual({ ok: true, emailSent: true })
    expect(lastRpc()).toEqual([
      'admin_member_leave',
      { p_member_id: TARGET, p_reason: REASON, p_left_on: null },
    ])
  })

  it('passes a valid ISO date', async () => {
    db.result = { data: [leaveRow], error: null }
    await leaveMember(TARGET, REASON, '2026-09-30')
    expect(lastRpc()[1].p_left_on).toBe('2026-09-30')
  })

  it.each([[''], [null], [undefined]])('treats %j as today', async (leftOn) => {
    db.result = { data: [leaveRow], error: null }
    await leaveMember(TARGET, REASON, leftOn as string | undefined)
    expect(lastRpc()[1].p_left_on).toBeNull()
  })

  it.each([['2026-13-01'], ['2026-02-30'], ['05/10/2026'], ['2026-10-05T00:00:00Z'], [20261005], [{}]])(
    'rejects the date %j without a database call',
    async (leftOn) => {
      expect(await leaveMember(TARGET, REASON, leftOn as never)).toEqual({ error: 'invalid_date' })
      expect(db.rpc).not.toHaveBeenCalled()
    }
  )

  it('requires a reason: blank or missing → reason_required, not a string → invalid, no DB call', async () => {
    expect(await leaveMember(TARGET, '   ')).toEqual({ error: 'reason_required' })
    expect(await leaveMember(TARGET, undefined as never)).toEqual({ error: 'reason_required' })
    expect(await leaveMember(TARGET, null as never)).toEqual({ error: 'reason_required' })
    expect(await leaveMember(TARGET, 42 as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('leaves the minimum length to the database (a 2-character reason reaches it)', async () => {
    db.result = { data: null, error: { code: '22023', message: 'membership:reason_required: at least 5 characters' } }
    expect(await leaveMember(TARGET, 'ok')).toEqual({ error: 'reason_required' })
    expect(db.rpc).toHaveBeenCalledOnce()
  })

  it('refuses more than 500 code points before the database (astral characters count once)', async () => {
    expect(await leaveMember(TARGET, '🎲'.repeat(500))).not.toEqual({ error: 'reason_too_long' })
    vi.clearAllMocks()
    expect(await leaveMember(TARGET, 'x'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('sends the A-6 e-mail with the reason to the returned address', async () => {
    db.result = { data: [leaveRow], error: null }
    await leaveMember(TARGET, REASON)
    expect(db.sendMail).toHaveBeenCalledOnce()
    const [message, options] = db.sendMail.mock.calls[0]
    expect(message.to).toBe(EMAIL)
    expect(message.subject).toBe('Baixa de Darkstone Catalunya')
    expect(message.text).toContain(REASON)
    expect(message.text).toContain('5/10/2026')
    expect(message.text).toContain('000-203')
    expect(message.html).toContain(REASON)
    expect(options).toEqual({ logTag: 'membership-mail' })
  })

  it('also accepts a single-row object as the RPC result', async () => {
    db.result = { data: leaveRow, error: null }
    expect(await leaveMember(TARGET, REASON)).toEqual({ ok: true, emailSent: true })
    expect(db.sendMail.mock.calls[0][0].to).toBe(EMAIL)
  })

  it('skips the e-mail when the database returns no address', async () => {
    db.result = { data: [{ ...leaveRow, email: null }], error: null }
    expect(await leaveMember(TARGET, REASON)).toEqual({ ok: true, emailSent: false })
    expect(db.sendMail).not.toHaveBeenCalled()
  })

  it('a mail failure never hides the leave: ok with emailSent false, nothing sensitive logged', async () => {
    db.result = { data: [leaveRow], error: null }
    db.sendMail.mockResolvedValueOnce({ ok: false, code: 'EAUTH' })
    expect(await leaveMember(TARGET, REASON)).toEqual({ ok: true, emailSent: false })
    expect(db.revalidatePath).toHaveBeenCalled()
    const out = consoleOutput()
    for (const secret of [EMAIL, REASON, 'Laia', '000-203']) expect(out).not.toContain(secret)
  })

  it('a mail module that throws is caught the same way', async () => {
    db.result = { data: [leaveRow], error: null }
    db.sendMail.mockRejectedValueOnce(new Error(`smtp down for ${EMAIL}`))
    expect(await leaveMember(TARGET, REASON)).toEqual({ ok: true, emailSent: false })
    expect(consoleOutput()).not.toContain(EMAIL)
  })

  it('revalidates the admin member pages after a leave', async () => {
    db.result = { data: [leaveRow], error: null }
    await leaveMember(TARGET, REASON)
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members', 'page')
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
  })

  it.each([
    ['membership:role_held: a superadmin must revoke the role before the baixa', '23514', 'role_held'],
    ['membership:self_target: use member_leave_self to leave yourself', '22023', 'self_target'],
    ['membership:not_active: the member has already left', '22023', 'not_active'],
    ['membership:reason_too_long: at most 500 characters', '22023', 'reason_too_long'],
    ['membership:invalid_date: the date cannot be in the future', '22023', 'invalid_date'],
    ['membership:not_found: unknown member', '22023', 'not_found'],
    ['membership:forbidden: board role required', '42501', 'forbidden'],
    ['permission denied for function admin_member_leave', '42501', 'forbidden'],
    ['TypeError: fetch failed', '', 'failed'],
  ])('maps %s to %s, logs only the code, sends nothing', async (message, code, expected) => {
    db.result = { data: null, error: { code, message: `${message} ${REASON}` } }
    expect(await leaveMember(TARGET, REASON)).toEqual({ error: expected })
    expect(db.sendMail).not.toHaveBeenCalled()
    expect(db.revalidatePath).not.toHaveBeenCalled()
    const out = consoleOutput()
    expect(out).toContain('[admin-member] leave_member failed')
    expect(out).not.toContain(REASON)
    expect(out).not.toContain('membership:')
  })
})

// ---------------------------------------------------------------------------------------------
describe('rejoinMember (A-7)', () => {
  it.each(['form', 'email', 'in_person', 'other'])('calls admin_member_rejoin with channel %s', async (channel) => {
    db.result = { data: [rejoinRow], error: null }
    expect(await rejoinMember(TARGET, channel as never, `  ${NOTE} `)).toEqual({ ok: true, emailSent: true })
    expect(lastRpc()).toEqual([
      'admin_member_rejoin',
      { p_member_id: TARGET, p_channel: channel, p_note: NOTE },
    ])
  })

  it('sends a blank or missing note as null', async () => {
    db.result = { data: [rejoinRow], error: null }
    await rejoinMember(TARGET, 'form', '   ')
    expect(lastRpc()[1].p_note).toBeNull()
    await rejoinMember(TARGET, 'form')
    expect(lastRpc()[1].p_note).toBeNull()
  })

  it.each([['phone'], [''], ['EMAIL'], [null], [3]])('rejects the channel %j without a database call', async (channel) => {
    expect(await rejoinMember(TARGET, channel as never)).toEqual({ error: 'invalid_channel' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('refuses a note over 500 code points or not a string, before the database', async () => {
    expect(await rejoinMember(TARGET, 'form', 'x'.repeat(501))).toEqual({ error: 'note_too_long' })
    expect(await rejoinMember(TARGET, 'form', { note: 'x' } as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('sends the "Tornes a ser soci" e-mail to the returned address and revalidates', async () => {
    db.result = { data: [rejoinRow], error: null }
    await rejoinMember(TARGET, 'email', NOTE)
    expect(db.sendMail).toHaveBeenCalledOnce()
    const [message] = db.sendMail.mock.calls[0]
    expect(message.to).toBe(EMAIL)
    expect(message.subject).toBe('Tornes a ser soci de Darkstone Catalunya')
    expect(message.text).toContain('000-087')
    expect(message.text).not.toContain(NOTE)
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
  })

  it('skips the e-mail without an address; a mail failure keeps ok', async () => {
    db.result = { data: [{ ...rejoinRow, email: '' }], error: null }
    expect(await rejoinMember(TARGET, 'form')).toEqual({ ok: true, emailSent: false })
    expect(db.sendMail).not.toHaveBeenCalled()

    db.result = { data: [rejoinRow], error: null }
    db.sendMail.mockResolvedValueOnce({ ok: false, code: 'ETIMEDOUT' })
    expect(await rejoinMember(TARGET, 'form')).toEqual({ ok: true, emailSent: false })
    expect(consoleOutput()).not.toContain(EMAIL)
  })

  it.each([
    ['membership:not_former: the member is active', 'not_former'],
    ['membership:register_closed: an anonymised or purged record cannot return', 'register_closed'],
    ['membership:no_login: the login account no longer exists', 'no_login'],
    ['membership:invalid_channel: form, email, in_person or other', 'invalid_channel'],
    ['membership:note_too_long: at most 500 characters', 'note_too_long'],
    ['membership:not_found: unknown member', 'not_found'],
  ])('maps %s to %s and logs only the code', async (message, expected) => {
    db.result = { data: null, error: { code: '22023', message } }
    expect(await rejoinMember(TARGET, 'form', NOTE)).toEqual({ error: expected })
    expect(db.sendMail).not.toHaveBeenCalled()
    const out = consoleOutput()
    expect(out).toContain('[admin-member] rejoin_member failed code=22023')
    expect(out).not.toContain(NOTE)
  })
})
