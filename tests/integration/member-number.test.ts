import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// 20261006100000_member_number_width.sql: member numbers never truncate past 999.
// `lpad(n, 3, '0')` cut 1196 to '119', so new numbers collided with existing ones once the
// sequence passed 999. The format lives in member_number_format(n), tested directly here: moving
// the shared sequence past 999 would affect every other test file running in parallel.

const userIds: string[] = []
const password = 'password123'
const email = 'member-number@test.local'

afterAll(() => cleanupUsers(userIds))

async function format(n: number) {
  const { data, error } = await runSqlAsPostgres<{ v: string }>(
    'select public.member_number_format($1::bigint) as v',
    [n]
  )
  expect(error).toBeNull()
  return data![0].v
}

describe('member_number_format()', () => {
  it('keeps the three-digit format up to 999', async () => {
    expect(await format(1)).toBe('000-001')
    expect(await format(42)).toBe('000-042')
    expect(await format(999)).toBe('000-999')
  })

  it('never truncates past 999', async () => {
    expect(await format(1000)).toBe('000-1000')
    expect(await format(1196)).toBe('000-1196')
    expect(await format(123456)).toBe('000-123456')
  })

  it('gives distinct numbers for the values the old format collapsed', async () => {
    // old: 119 -> '000-119' and 1196 -> '000-119'
    expect(await format(119)).not.toBe(await format(1196))
  })

  it('fits the numeric sort key of the admin list (digits only, padded to 20)', async () => {
    const { data, error } = await runSqlAsPostgres<{ k999: string; k1000: string }>(
      `select pg_catalog.lpad(pg_catalog.regexp_replace(public.member_number_format(999), '[^0-9]', '', 'g'), 20, '0') as k999,
              pg_catalog.lpad(pg_catalog.regexp_replace(public.member_number_format(1000), '[^0-9]', '', 'g'), 20, '0') as k1000`
    )
    expect(error).toBeNull()
    expect(data![0].k999 < data![0].k1000).toBe(true)
  })
})

describe('generate_member_number()', () => {
  it('formats the next sequence value with member_number_format()', async () => {
    const { data, error } = await runSqlAsPostgres<{ def: string }>(
      `select pg_catalog.pg_get_functiondef('public.generate_member_number()'::regprocedure) as def`
    )
    expect(error).toBeNull()
    expect(data![0].def).toContain('member_number_format')
    expect(data![0].def).toContain("search_path TO ''")
  })

  it('still assigns an untruncated number to a new auth user (trigger path)', async () => {
    const user = await createTestUser(email, password, { first_name: 'Num', last_name: 'Ber' })
    userIds.push(user.id)
    const { data } = await supabaseAdmin.from('members').select('member_number').eq('id', user.id).single()
    expect(data!.member_number).toMatch(/^000-\d{3,}$/)
  })

  it('neither function is callable by anon or an authenticated member', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const member = await createAuthenticatedClient(email, password)
    for (const client of [anon, member]) {
      const gen = await client.rpc('generate_member_number')
      expect(gen.error?.code).toBe('42501')
      const fmt = await client.rpc('member_number_format', { n: 5 })
      expect(fmt.error?.code).toBe('42501')
    }
  })
})
