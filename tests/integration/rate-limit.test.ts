import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, createAuthenticatedClient, cleanupUsers } from '../helpers/supabase'
import { allowRequestShared } from '@/lib/rate-limit'

const run = randomUUID()
const bucket = (name: string) => `it-${run}:${name}`

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

async function hit(name: string, max: number, windowSeconds: number) {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
    p_bucket: bucket(name),
    p_max: max,
    p_window_seconds: windowSeconds,
  })
  expect(error).toBeNull()
  return data as boolean
}

const userIds: string[] = []

beforeAll(async () => {
  const user = await createTestUser('rate-limit@test.local', 'password123', {
    first_name: 'Rate',
    last_name: 'Limit',
  })
  userIds.push(user.id)
})

afterAll(async () => {
  await supabaseAdmin.from('rate_limit_hits').delete().like('bucket', `it-${run}%`)
  await cleanupUsers(userIds)
})

describe('rate_limit_hit', () => {
  it('allows up to the maximum and then denies', async () => {
    const results = []
    for (let i = 0; i < 5; i++) results.push(await hit('max', 3, 60))
    expect(results).toEqual([true, true, true, false, false])
  })

  it('does not record denied calls', async () => {
    for (let i = 0; i < 4; i++) await hit('denied', 2, 60)
    const { count } = await supabaseAdmin
      .from('rate_limit_hits')
      .select('*', { count: 'exact', head: true })
      .eq('bucket', bucket('denied'))
    expect(count).toBe(2)
  })

  it('keeps buckets independent', async () => {
    expect(await hit('a', 1, 60)).toBe(true)
    expect(await hit('a', 1, 60)).toBe(false)
    expect(await hit('b', 1, 60)).toBe(true)
  })

  it('frees the bucket when the window has passed', async () => {
    expect(await hit('window', 1, 60)).toBe(true)
    expect(await hit('window', 1, 60)).toBe(false)
    // Age the hit past its window instead of sleeping.
    await supabaseAdmin
      .from('rate_limit_hits')
      .update({ hit_at: new Date(Date.now() - 120_000).toISOString() })
      .eq('bucket', bucket('window'))
    expect(await hit('window', 1, 60)).toBe(true)
  })

  it('never lets concurrent callers exceed the maximum', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => hit('race', 5, 60)))
    expect(results.filter(Boolean)).toHaveLength(5)
  })

  it.each([
    ['max below 1', 0, 60],
    ['window below 1', 1, 0],
    ['window above 2 days', 1, 172_801],
  ])('rejects invalid arguments: %s', async (_label, max, windowSeconds) => {
    const { error } = await supabaseAdmin.rpc('rate_limit_hit', {
      p_bucket: bucket('invalid'),
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    expect(error).not.toBeNull()
  })
})

describe('access control', () => {
  it('anonymous clients can neither read the table nor call the function', async () => {
    const read = await anon.from('rate_limit_hits').select('*')
    expect(read.error?.code).toBe('42501') // permission denied
    expect(read.data).toBeNull()

    const write = await anon.from('rate_limit_hits').insert({ bucket: bucket('anon') })
    expect(write.error?.code).toBe('42501') // permission denied

    const call = await anon.rpc('rate_limit_hit', { p_bucket: bucket('anon'), p_max: 5, p_window_seconds: 60 })
    expect(call.error?.code).toBe('42501') // permission denied
  })

  it('authenticated members can neither read the table nor call the function', async () => {
    const member = await createAuthenticatedClient('rate-limit@test.local', 'password123')

    const read = await member.from('rate_limit_hits').select('*')
    expect(read.error?.code).toBe('42501') // permission denied
    expect(read.data).toBeNull()

    const write = await member.from('rate_limit_hits').insert({ bucket: bucket('member') })
    expect(write.error?.code).toBe('42501') // permission denied

    const call = await member.rpc('rate_limit_hit', { p_bucket: bucket('member'), p_max: 5, p_window_seconds: 60 })
    expect(call.error?.code).toBe('42501') // permission denied
  })
})

describe('allowRequestShared against the real database', () => {
  it('limits across calls and never stores the raw identity', async () => {
    const scope = `it-${run}:shared`
    const identity = `203.0.113.${Math.floor(Math.random() * 200)}`
    expect([
      await allowRequestShared(scope, identity, 2, 60_000),
      await allowRequestShared(scope, identity, 2, 60_000),
      await allowRequestShared(scope, identity, 2, 60_000),
    ]).toEqual([true, true, false])

    const { data } = await supabaseAdmin.from('rate_limit_hits').select('bucket').like('bucket', `${scope}:%`)
    expect(data).toHaveLength(2)
    for (const row of data!) {
      expect(row.bucket).toMatch(new RegExp(`^${scope}:[0-9a-f]{64}$`))
      expect(row.bucket).not.toContain(identity)
    }
  })

  it('uses the scope itself as the bucket for global limits', async () => {
    const scope = `it-${run}:global`
    expect(await allowRequestShared(scope, null, 1, 60_000)).toBe(true)
    expect(await allowRequestShared(scope, null, 1, 60_000)).toBe(false)
  })
})
