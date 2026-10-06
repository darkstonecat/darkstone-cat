import { format } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

// A-14 · refreshCaches (src/lib/admin/ops-actions.ts). The guard, the session client, the shared
// limiter, the refresh runner and the run recorder are mocked; every step is pushed to
// `db.steps` so the order (guard → limit → refresh → record → audit) can be asserted.

const db = vi.hoisted(() => ({
  access: { status: 'ok', actor: { id: 'actor-id', role: 'board' } } as
    | { status: 'ok'; actor: { id: string; role: string } }
    | { status: 'unauthenticated' }
    | { status: 'forbidden' },
  getAdminAccess: vi.fn(),
  steps: [] as string[],
  sessionRpc: vi.fn(),
  auditResult: { data: 1, error: null } as { data: unknown; error: { code?: string; message: string } | null },
  allow: vi.fn(),
  runRefreshJobs: vi.fn(),
  recordManualRuns: vi.fn(),
  revalidatePath: vi.fn(),
  session: null as unknown,
}))

vi.mock('next/cache', () => ({ revalidatePath: db.revalidatePath }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminAccess: async (min: string) => (db.steps.push('guard'), db.getAdminAccess(min), db.access),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    db.session = {
      rpc: async (fn: string, args: unknown) => {
        db.steps.push(`session:${fn}`)
        db.sessionRpc(fn, args)
        return db.auditResult
      },
    }
    return db.session
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  allowRequestShared: async (...args: unknown[]) => (db.steps.push('limit'), db.allow(...args)),
}))
vi.mock('@/lib/cache-refresh', () => ({
  REFRESH_JOBS: [
    { name: 'ludoya', tag: 'ludoya', warm: async () => {} },
    { name: 'bgg', tag: 'bgg', warm: async () => {} },
  ],
  runRefreshJobs: async (jobs: { name: string }[]) => (db.steps.push('refresh'), db.runRefreshJobs(jobs)),
}))
vi.mock('@/lib/ops/job-runs', () => ({
  recordManualRuns: async (client: unknown, results: unknown) => (db.steps.push('record'), db.recordManualRuns(client, results)),
}))

import { refreshCaches } from '@/lib/admin/ops-actions'

const OK_RESULTS = [
  { name: 'ludoya', ok: true, durationMs: 2100 },
  { name: 'bgg', ok: true, durationMs: 900 },
]

let spies: MockInstance[]
const output = () =>
  spies
    .flatMap((spy) => spy.mock.calls)
    .map((call) => format(...(call as [unknown, ...unknown[]])))
    .join('\n')

beforeEach(() => {
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'board' } }
  db.steps = []
  db.auditResult = { data: 1, error: null }
  db.allow.mockResolvedValue(true)
  db.runRefreshJobs.mockImplementation(async (jobs: { name: string }[]) =>
    OK_RESULTS.filter((r) => jobs.some((j) => j.name === r.name))
  )
  db.recordManualRuns.mockResolvedValue(undefined)
  spies = [
    vi.spyOn(console, 'error').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'info').mockImplementation(() => {}),
    vi.spyOn(console, 'log').mockImplementation(() => {}),
  ]
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('refreshCaches guard and input', () => {
  it.each(['unauthenticated', 'forbidden'] as const)('answers %s without doing anything', async (status) => {
    db.access = { status }

    expect(await refreshCaches('all')).toEqual({ error: status })
    expect(db.getAdminAccess).toHaveBeenCalledWith('board')
    expect(db.steps).toEqual(['guard'])
  })

  it.each([['other'], [''], [42], [null], [{ job: 'bgg' }]])('refuses job %j as invalid before the limiter', async (job) => {
    expect(await refreshCaches(job as never)).toEqual({ error: 'invalid' })
    expect(db.steps).toEqual(['guard'])
  })

  it('answers rate_limited when the board member refreshed in the last minute', async () => {
    db.allow.mockResolvedValue(false)

    expect(await refreshCaches('bgg')).toEqual({ error: 'rate_limited' })
    expect(db.allow).toHaveBeenCalledWith('cache-refresh:actor-id', null, 1, 60_000)
    expect(db.steps).toEqual(['guard', 'limit'])
  })
})

describe('refreshCaches run', () => {
  it('runs every job by default, records the runs, then logs one audit entry', async () => {
    const result = await refreshCaches()

    expect(result).toEqual({
      ok: true,
      results: [
        { job: 'ludoya', ok: true, durationMs: 2100, errorCode: null },
        { job: 'bgg', ok: true, durationMs: 900, errorCode: null },
      ],
    })
    expect(db.steps).toEqual(['guard', 'limit', 'refresh', 'record', 'session:log_admin_event'])
    expect(db.runRefreshJobs.mock.calls[0][0].map((j: { name: string }) => j.name)).toEqual(['ludoya', 'bgg'])
    expect(db.recordManualRuns).toHaveBeenCalledWith(db.session, OK_RESULTS)
    expect(db.sessionRpc).toHaveBeenCalledWith('log_admin_event', {
      p_action: 'ops.cache_refresh',
      p_target: null,
      p_details: { jobs: ['ludoya', 'bgg'], ok: true },
      p_reason: null,
    })
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/tools', 'page')
  })

  it('runs only the selected job', async () => {
    const result = await refreshCaches('ludoya')

    expect(db.runRefreshJobs.mock.calls[0][0].map((j: { name: string }) => j.name)).toEqual(['ludoya'])
    expect(result).toEqual({ ok: true, results: [{ job: 'ludoya', ok: true, durationMs: 2100, errorCode: null }] })
    expect(db.sessionRpc).toHaveBeenCalledWith('log_admin_event', expect.objectContaining({
      p_details: { jobs: ['ludoya'], ok: true },
    }))
  })

  it('reports a failed job with its short code only, and ok false in the audit details', async () => {
    db.runRefreshJobs.mockResolvedValue([
      { name: 'bgg', ok: false, durationMs: 30000, error: 'BGG API timeout after retries for user@example.com', errorCode: 'timeout' },
    ])

    const result = await refreshCaches('bgg')

    expect(result).toEqual({ ok: true, results: [{ job: 'bgg', ok: false, durationMs: 30000, errorCode: 'timeout' }] })
    expect(JSON.stringify(result)).not.toContain('example.com')
    expect(db.sessionRpc).toHaveBeenCalledWith('log_admin_event', expect.objectContaining({
      p_details: { jobs: ['bgg'], ok: false },
    }))
    expect(output()).not.toContain('example.com')
  })

  it('still answers the results when the audit entry fails, and logs only the code', async () => {
    db.auditResult = { data: null, error: { code: '42501', message: 'audit:forbidden: board role required for user@example.com' } }

    const result = await refreshCaches('all')

    expect(result).toEqual(expect.objectContaining({ ok: true }))
    expect(output()).toContain('[admin-ops] cache_refresh_audit failed code=42501')
    expect(output()).not.toContain('example.com')
    expect(output()).not.toContain('board role required')
  })
})
