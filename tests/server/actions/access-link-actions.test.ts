import { format } from 'node:util'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

// A-15 · sendAccessLink (src/lib/admin/access-actions.ts). The guard, the session client, the
// service-role client, the shared limiter and the magic-link sender are mocked. Every step is
// pushed to `db.steps` so the order (limit → audit entry → send) can be asserted.

type DbResult = { data: unknown; error: { code?: string; message: string } | null }

const db = vi.hoisted(() => ({
  access: { status: 'ok', actor: { id: 'actor-id', role: 'board' } } as
    | { status: 'ok'; actor: { id: string; role: string } }
    | { status: 'unauthenticated' }
    | { status: 'forbidden' },
  getAdminAccess: vi.fn(),
  steps: [] as string[],
  sessionRpc: vi.fn(),
  rpcResults: {} as Record<string, DbResult>,
  auditRead: { data: [], error: null } as DbResult,
  auditQuery: vi.fn(),
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
  adminLookup: { data: null, error: null } as DbResult,
  allow: vi.fn(),
  send: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: db.revalidatePath }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminAccess: async (min: string) => (db.getAdminAccess(min), db.access),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: unknown) => {
      db.steps.push(`session:${fn}`)
      db.sessionRpc(fn, args)
      return db.rpcResults[fn] ?? { data: null, error: null }
    },
    // audit_log read for the retry time: .select().eq().eq().order().limit()
    from: (table: string) => {
      const query: Record<string, unknown> = {}
      const chain = {
        select: (cols: string) => ((query.select = cols), chain),
        eq: (col: string, value: unknown) => ((query[col] = value), chain),
        order: (col: string, opts: unknown) => ((query.order = [col, opts]), chain),
        limit: async (n: number) => {
          query.limit = n
          db.steps.push(`session:from:${table}`)
          db.auditQuery(table, query)
          return db.auditRead
        },
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: db.adminRpc,
    from: (table: string) => {
      db.adminFrom(table)
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => (db.steps.push(`admin:from:${table}`), db.adminLookup),
      }
      return chain
    },
  }),
}))
vi.mock('@/lib/rate-limit', () => ({
  allowRequestShared: async (...args: unknown[]) => (db.steps.push('limit'), db.allow(...args)),
}))
vi.mock('@/lib/supabase/magic-link', () => ({
  sendMagicLinkOtp: async (email: string) => (db.steps.push('send'), db.send(email)),
}))

import { sendAccessLink } from '@/lib/admin/access-actions'

const TARGET = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const EMAIL = 'laia.serra@example.com'
const NUMBER = '000-203'
const activeRow = { id: TARGET, member_number: NUMBER, state: 'active', email: EMAIL, has_login: true }

let consoleSpies: MockInstance[]
function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .map((call) => format(...(call as [unknown, ...unknown[]])))
    .join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'board' } }
  db.steps = []
  db.adminLookup = { data: { member_number: NUMBER }, error: null }
  db.rpcResults = {
    admin_get_member: { data: [activeRow], error: null },
    log_admin_event: { data: 42, error: null },
  }
  db.auditRead = { data: [], error: null }
  db.allow.mockResolvedValue(true)
  db.send.mockResolvedValue({ ok: true })
  consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {})
  )
})

describe('sendAccessLink (A-15) · guard and input', () => {
  it('needs a board session and checks the board level', async () => {
    db.access = { status: 'unauthenticated' }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'unauthenticated' })
    db.access = { status: 'forbidden' }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'forbidden' })
    expect(db.getAdminAccess).toHaveBeenCalledWith('board')
    expect(db.steps).toEqual([])
  })

  it.each([['000-203'], [''], [42], [null], [{ id: TARGET }]])('refuses the member id %j without any lookup', async (id) => {
    expect(await sendAccessLink(id as string)).toEqual({ error: 'invalid' })
    expect(db.steps).toEqual([])
  })

  it('never accepts an address from the client: extra arguments are ignored', async () => {
    const call = sendAccessLink as unknown as (id: string, email: string) => Promise<unknown>
    expect(await call(TARGET, 'attacker@example.com')).toEqual({ ok: true })
    expect(db.send).toHaveBeenCalledWith(EMAIL)
  })
})

describe('sendAccessLink · happy path', () => {
  it('resolves the target, limits, logs and then sends to the account e-mail', async () => {
    expect(await sendAccessLink(TARGET.toUpperCase())).toEqual({ ok: true })

    expect(db.steps).toEqual([
      'admin:from:members',
      'session:admin_get_member',
      'limit',
      'session:log_admin_event',
      'send',
    ])
    expect(db.adminFrom).toHaveBeenCalledWith('members')
    expect(db.sessionRpc).toHaveBeenCalledWith('admin_get_member', { p_member_number: NUMBER })
    expect(db.allow).toHaveBeenCalledWith(`access-link:${TARGET}`, null, 1, 10 * 60 * 1000)
    expect(db.sessionRpc).toHaveBeenCalledWith('log_admin_event', {
      p_action: 'member.send_access_link',
      p_target: TARGET,
      p_details: {},
      p_reason: null,
    })
    expect(db.send).toHaveBeenCalledWith(EMAIL)
  })

  it('uses the SESSION client for admin_get_member and log_admin_event, never the service role', async () => {
    await sendAccessLink(TARGET)
    expect(db.adminRpc).not.toHaveBeenCalled()
    expect(db.sessionRpc.mock.calls.map((c) => c[0])).toEqual(['admin_get_member', 'log_admin_event'])
  })

  it('never returns or logs the address', async () => {
    db.send.mockResolvedValue({ ok: false, throttled: false, code: 'unexpected_failure', status: 500 })
    const res = await sendAccessLink(TARGET)
    expect(JSON.stringify(res)).not.toContain('laia')
    expect(consoleOutput()).not.toContain('laia')
    expect(consoleOutput()).not.toContain(NUMBER)
  })
})

describe('sendAccessLink · target rules', () => {
  it('an unknown id is not_found (no session call)', async () => {
    db.adminLookup = { data: null, error: null }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'not_found' })
    expect(db.steps).toEqual(['admin:from:members'])
  })

  it('a failed id lookup is failed and logs only the code', async () => {
    db.adminLookup = { data: null, error: { code: 'XX000', message: `boom ${EMAIL}` } }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'failed' })
    expect(consoleOutput()).toContain('send_access_link failed code=XX000')
    expect(consoleOutput()).not.toContain('boom')
  })

  it('no row from admin_get_member (purged or unconfirmed sign-up, BR-22) is not_found', async () => {
    db.rpcResults.admin_get_member = { data: [], error: null }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'not_found' })
    expect(db.allow).not.toHaveBeenCalled()
    expect(db.send).not.toHaveBeenCalled()
  })

  it('a former member is not_active: nothing is limited, logged or sent', async () => {
    db.rpcResults.admin_get_member = { data: [{ ...activeRow, state: 'former' }], error: null }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'not_active' })
    expect(db.steps).toEqual(['admin:from:members', 'session:admin_get_member'])
  })

  it.each([
    ['no login account', { has_login: false }],
    ['no address', { email: null }],
    ['a blank address', { email: '  ' }],
  ])('%s is no_login', async (_name, patch) => {
    db.rpcResults.admin_get_member = { data: [{ ...activeRow, ...patch }], error: null }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'no_login' })
    expect(db.steps).toEqual(['admin:from:members', 'session:admin_get_member'])
  })

  it('maps an admin_get_member refusal (board role lost meanwhile)', async () => {
    db.rpcResults.admin_get_member = { data: null, error: { code: '42501', message: 'admin:forbidden: board role required' } }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'forbidden' })
    expect(db.send).not.toHaveBeenCalled()
  })
})

describe('sendAccessLink · per-member limit', () => {
  it('refuses a second link within 10 minutes with the seconds left from the last entry', async () => {
    db.allow.mockResolvedValue(false)
    const sentAt = new Date(Date.now() - 4 * 60 * 1000).toISOString()
    db.auditRead = { data: [{ created_at: sentAt }], error: null }

    const res = await sendAccessLink(TARGET)
    expect(res).toMatchObject({ error: 'rate_limited' })
    const retryAfter = (res as { retryAfter: number }).retryAfter
    expect(retryAfter).toBeGreaterThan(5 * 60)
    expect(retryAfter).toBeLessThanOrEqual(6 * 60)

    expect(db.auditQuery).toHaveBeenCalledWith('audit_log', {
      select: 'created_at',
      action: 'member.send_access_link',
      target_member_id: TARGET,
      order: ['id', { ascending: false }],
      limit: 1,
    })
    expect(db.sessionRpc).not.toHaveBeenCalledWith('log_admin_event', expect.anything())
    expect(db.send).not.toHaveBeenCalled()
  })

  it.each([
    ['no entry', { data: [], error: null }],
    ['an unreadable log', { data: null, error: { code: '42501', message: 'denied' } }],
    ['an entry older than the window', { data: [{ created_at: '2020-01-01T00:00:00Z' }], error: null }],
    ['a malformed date', { data: [{ created_at: 'yesterday' }], error: null }],
  ])('retryAfter is null with %s', async (_name, read) => {
    db.allow.mockResolvedValue(false)
    db.auditRead = read as DbResult
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'rate_limited', retryAfter: null })
  })
})

describe('sendAccessLink · audit entry first, fail closed', () => {
  it('sends nothing when the audit entry cannot be written', async () => {
    db.rpcResults.log_admin_event = { data: null, error: { code: 'XX000', message: `audit_write failed for ${EMAIL}` } }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'failed' })
    expect(db.send).not.toHaveBeenCalled()
    expect(consoleOutput()).toContain('send_access_link failed code=XX000')
    expect(consoleOutput()).not.toContain('laia')
  })

  it('maps a target that left meanwhile (audit:invalid_target) to not_active, sending nothing', async () => {
    db.rpcResults.log_admin_event = {
      data: null,
      error: { code: '22023', message: 'audit:invalid_target: an access link goes to active members only' },
    }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'not_active' })
    expect(db.send).not.toHaveBeenCalled()
  })

  it('maps a lost role at logging time to forbidden, sending nothing', async () => {
    db.rpcResults.log_admin_event = { data: null, error: { code: '42501', message: 'audit:forbidden: board role required' } }
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'forbidden' })
    expect(db.send).not.toHaveBeenCalled()
  })
})

describe('sendAccessLink · sender outcome', () => {
  it('a GoTrue throttle is rate_limited without a retry time', async () => {
    db.send.mockResolvedValue({ ok: false, throttled: true, code: 'over_email_send_rate_limit', status: 429 })
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'rate_limited', retryAfter: null })
  })

  it('any other sender failure is send_failed and logs only the code', async () => {
    db.send.mockResolvedValue({ ok: false, throttled: false, code: 'unexpected_failure', status: 500 })
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'send_failed' })
    expect(consoleOutput()).toContain('send_access_link failed code=unexpected_failure')
  })

  it('a sender that throws is send_failed', async () => {
    db.send.mockRejectedValue(new Error(`network down for ${EMAIL}`))
    expect(await sendAccessLink(TARGET)).toEqual({ error: 'send_failed' })
    expect(consoleOutput()).not.toContain('laia')
  })
})
