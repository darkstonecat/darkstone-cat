import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261006100200_ops_job_runs.sql (T13): one row per cache refresh job run, written
// only through ops_record_job_run (service role, automatic runs) and admin_record_job_run (board,
// manual runs from V-6), read through admin_ops_status (board+).
//
// This is the only file that writes ops_job_runs, so it empties the table first and asserts the
// global "last run per job" answer.

const password = 'password123'
const DOMAIN = 'ops-runs.test'
const users = {} as Record<'member' | 'board', { id: string; member_number: string }>
const clients = {} as Record<'member' | 'board', SupabaseClient>
const userIds: string[] = []

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

type StatusRow = {
  job: string
  last_run_at: string | null
  last_ok: boolean | null
  last_automatic: boolean | null
  last_actor_member_number: string | null
  last_actor_name: string | null
  last_duration_ms: number | null
  last_error_code: string | null
  last_success_at: string | null
}

const auto = (job: string, ok: boolean, duration: number | null, code: string | null = null) =>
  supabaseAdmin.rpc('ops_record_job_run', {
    p_job: job,
    p_ok: ok,
    p_duration_ms: duration,
    p_error_code: code,
  })

const manual = (client: SupabaseClient, job: string, ok: boolean, duration: number | null, code: string | null = null) =>
  client.rpc('admin_record_job_run', {
    p_job: job,
    p_ok: ok,
    p_duration_ms: duration,
    p_error_code: code,
  })

async function status(client: SupabaseClient = clients.board) {
  const { data, error } = await client.rpc('admin_ops_status')
  expect(error).toBeNull()
  return data as StatusRow[]
}

async function rows(job: string) {
  const { data, error } = await supabaseAdmin
    .from('ops_job_runs')
    .select('id, job, ran_at, ok, actor_id, duration_ms, error_code')
    .eq('job', job)
    .order('id')
  expect(error).toBeNull()
  return data as { id: number; ran_at: string; ok: boolean; actor_id: string | null; duration_ms: number | null; error_code: string | null }[]
}

beforeAll(async () => {
  for (const key of ['member', 'board'] as const) {
    const user = await createTestUser(`ops-${key}@${DOMAIN}`, password, { first_name: 'Ops', last_name: key === 'board' ? 'Junta' : 'Soci' })
    userIds.push(user.id)
    const { data } = await supabaseAdmin.from('members').select('member_number').eq('id', user.id).single()
    users[key] = { id: user.id, member_number: data!.member_number as string }
  }
  const promote = await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)
  expect(promote.error).toBeNull()
  clients.member = await createAuthenticatedClient(`ops-member@${DOMAIN}`, password)
  clients.board = await createAuthenticatedClient(`ops-board@${DOMAIN}`, password)

  const wipe = await runSqlAsPostgres('DELETE FROM public.ops_job_runs')
  expect(wipe.error).toBeNull()
})

afterAll(async () => {
  await runSqlAsPostgres('DELETE FROM public.ops_job_runs')
  await cleanupUsers(userIds)
})

describe('ops_job_runs grants', () => {
  it('no API role can write the table directly', async () => {
    for (const client of [anon, clients.member, clients.board]) {
      const { error } = await client.from('ops_job_runs').insert({ job: 'ludoya', ok: true })
      expect(error?.code).toBe('42501')
    }
    const service = await supabaseAdmin.from('ops_job_runs').insert({ job: 'ludoya', ok: true })
    expect(service.error?.code).toBe('42501')
  })

  it('only the service role can read the table directly', async () => {
    for (const client of [anon, clients.member, clients.board]) {
      const { error } = await client.from('ops_job_runs').select('id')
      expect(error?.code).toBe('42501')
    }
    const service = await supabaseAdmin.from('ops_job_runs').select('id')
    expect(service.error).toBeNull()
  })

  it('ops_record_job_run is for the service role only', async () => {
    for (const client of [anon, clients.member, clients.board]) {
      const { error } = await client.rpc('ops_record_job_run', {
        p_job: 'ludoya',
        p_ok: true,
        p_duration_ms: 1,
        p_error_code: null,
      })
      expect(error?.code).toBe('42501')
    }
    expect(await rows('ludoya')).toHaveLength(0)
  })

  it('admin_record_job_run refuses anon, a member and the service role', async () => {
    const asMember = await manual(clients.member, 'ludoya', true, 1)
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toMatch(/^ops:forbidden/)

    expect((await manual(anon, 'ludoya', true, 1)).error?.code).toBe('42501')
    expect((await manual(supabaseAdmin, 'ludoya', true, 1)).error?.code).toBe('42501')
    expect(await rows('ludoya')).toHaveLength(0)
  })

  it('admin_ops_status refuses anon, a member and the service role', async () => {
    const asMember = await clients.member.rpc('admin_ops_status')
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toMatch(/^ops:forbidden/)
    expect((await anon.rpc('admin_ops_status')).error?.code).toBe('42501')
    expect((await supabaseAdmin.rpc('admin_ops_status')).error?.code).toBe('42501')
  })
})

describe('recording runs', () => {
  it('rejects unknown jobs and malformed values', async () => {
    const cases: [string, boolean, number | null, string | null][] = [
      ['retention', true, 1, null],
      ['LUDOYA', true, 1, null],
      ['ludoya', true, -1, null],
      ['ludoya', false, 1, 'Ludoya API 503 for /events'],
      ['ludoya', false, 1, 'x'.repeat(41)],
      ['ludoya', true, 1, 'timeout'],
    ]
    for (const [job, ok, duration, code] of cases) {
      const { error } = await auto(job, ok, duration, code)
      expect(error?.code, `${job} ${ok} ${duration} ${code}`).toBe('22023')
      expect(error?.message).toMatch(/^ops:invalid_argument/)
    }
    const boardBad = await manual(clients.board, 'nope', true, 1)
    expect(boardBad.error?.message).toMatch(/^ops:invalid_argument/)
    expect(await rows('ludoya')).toHaveLength(0)
  })

  it('an automatic run has no actor; a manual run records the caller', async () => {
    const a = await auto('ludoya', true, 2100)
    expect(a.error).toBeNull()
    const m = await manual(clients.board, 'ludoya', false, 30000, 'timeout')
    expect(m.error).toBeNull()

    const saved = await rows('ludoya')
    expect(saved).toHaveLength(2)
    expect(saved[0]).toMatchObject({ ok: true, actor_id: null, duration_ms: 2100, error_code: null })
    expect(saved[1]).toMatchObject({ ok: false, actor_id: users.board.id, duration_ms: 30000, error_code: 'timeout' })
  })
})

describe('admin_ops_status', () => {
  it('returns one row per known job, the last run and the last success', async () => {
    const result = await status()
    expect(result.map((r) => r.job)).toEqual(['ludoya', 'bgg'])

    const [ludoya, bgg] = result
    const saved = await rows('ludoya')
    expect(ludoya).toMatchObject({
      last_ok: false,
      last_automatic: false,
      last_actor_member_number: users.board.member_number,
      last_actor_name: 'Ops Junta',
      last_duration_ms: 30000,
      last_error_code: 'timeout',
    })
    expect(Date.parse(ludoya.last_run_at!)).toBe(Date.parse(saved[1].ran_at))
    expect(Date.parse(ludoya.last_success_at!)).toBe(Date.parse(saved[0].ran_at))

    // Never run: every field NULL.
    expect(bgg).toEqual({
      job: 'bgg',
      last_run_at: null,
      last_ok: null,
      last_automatic: null,
      last_actor_member_number: null,
      last_actor_name: null,
      last_duration_ms: null,
      last_error_code: null,
      last_success_at: null,
    })
  })

  it('labels an automatic last run without an actor', async () => {
    expect((await auto('bgg', true, 900)).error).toBeNull()
    const bgg = (await status()).find((r) => r.job === 'bgg')!
    expect(bgg).toMatchObject({
      last_ok: true,
      last_automatic: true,
      last_actor_member_number: null,
      last_actor_name: null,
      last_duration_ms: 900,
      last_error_code: null,
    })
    expect(bgg.last_success_at).toBe(bgg.last_run_at)
  })
})

describe('pruning', () => {
  it('drops runs older than 90 days of the same job but keeps the newest success', async () => {
    const wipe = await runSqlAsPostgres("DELETE FROM public.ops_job_runs WHERE job = 'bgg'")
    expect(wipe.error).toBeNull()
    const seed = await runSqlAsPostgres(
      `INSERT INTO public.ops_job_runs (job, ran_at, ok, duration_ms, error_code) VALUES
         ('bgg', now() - interval '200 days', true, 10, NULL),
         ('bgg', now() - interval '120 days', false, 10, 'timeout'),
         ('bgg', now() - interval '10 days', false, 10, 'http_503')`
    )
    expect(seed.error).toBeNull()
    const ludoyaBefore = await rows('ludoya')

    // A failure: the 120-day failure goes, the 200-day success stays (it is the last success).
    expect((await auto('bgg', false, 5, 'timeout')).error).toBeNull()
    let bgg = await rows('bgg')
    expect(bgg.map((r) => [r.ok, r.error_code])).toEqual([
      [true, null],
      [false, 'http_503'],
      [false, 'timeout'],
    ])
    const status1 = (await status()).find((r) => r.job === 'bgg')!
    expect(Date.parse(status1.last_success_at!)).toBe(Date.parse(bgg[0].ran_at))

    // A new success: the old success is no longer the newest one, so it goes too.
    expect((await auto('bgg', true, 5)).error).toBeNull()
    bgg = await rows('bgg')
    expect(bgg.map((r) => [r.ok, r.error_code])).toEqual([
      [false, 'http_503'],
      [false, 'timeout'],
      [true, null],
    ])

    // Other jobs are untouched.
    expect(await rows('ludoya')).toEqual(ludoyaBefore)
  })
})
