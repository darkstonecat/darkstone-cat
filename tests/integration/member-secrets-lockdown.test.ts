import { createCipheriv, randomBytes } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'
import { encrypt, decrypt } from '@/lib/encryption'

// Migration 20261005100700_lock_down_member_secrets.sql (T7b): board sessions no longer read
// other members' rows or badges directly, get_all_members_for_admin() is service-role only,
// stored DNI/phone ciphertext must be v2 bound to its own row (members_ciphertext_guard),
// TRUNCATE is revoked, and the BR-15 detector v3 closes the T7 verification misses.

const password = 'password123'
const DOMAIN = 'secrets-lockdown.test'
const emails = {
  board: `msl-board@${DOMAIN}`,
  member: `msl-member@${DOMAIN}`,
  victim: `msl-victim@${DOMAIN}`,
  legacy: `msl-legacy@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

/** The pre-v2 format of src/lib/encryption.ts: iv:tag:data, no AAD. */
function legacyEncrypt(plainText: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'), iv, {
    authTagLength: 16,
  })
  const data = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Secrets' })
    userIds.push(users[key].id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  for (const key of ['board', 'victim'] as const) {
    const { error } = await supabaseAdmin
      .from('members')
      .update({
        dni_nie_encrypted: encrypt('12345678Z', users[key].id),
        phone_encrypted: encrypt('612345678', users[key].id),
      })
      .eq('id', users[key].id)
    expect(error).toBeNull()
    expect(
      (await supabaseAdmin.from('member_badges').insert({ member_id: users[key].id, badge_key: 'ludoteca_donor' })).error
    ).toBeNull()
  }
  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

// ---------------------------------------------------------------------------------------------
describe('board sessions read only their own row and badges', () => {
  it("cannot read another member's ciphertext through PostgREST", async () => {
    const { data, error } = await board
      .from('members')
      .select('dni_nie_encrypted, phone_encrypted')
      .eq('id', users.victim.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('cannot list other members at all', async () => {
    const { data, error } = await board.from('members').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: users.board.id }])
  })

  it('still reads its own ciphertext', async () => {
    const { data, error } = await board
      .from('members')
      .select('dni_nie_encrypted')
      .eq('id', users.board.id)
      .single()
    expect(error).toBeNull()
    expect(decrypt(data!.dni_nie_encrypted!, users.board.id)).toBe('12345678Z')
  })

  it("cannot read another member's badges, still reads its own", async () => {
    const other = await board.from('member_badges').select('badge_key').eq('member_id', users.victim.id)
    expect(other.error).toBeNull()
    expect(other.data).toEqual([])
    const own = await board.from('member_badges').select('badge_key').eq('member_id', users.board.id)
    expect(own.data).toEqual([{ badge_key: 'ludoteca_donor' }])
  })
})

// ---------------------------------------------------------------------------------------------
describe('get_all_members_for_admin() is service-role only', () => {
  it.each([
    ['a board session', () => board],
    ['a plain member', () => member],
    ['anon', () => anon],
  ])('%s gets permission denied (42501)', async (_label, client) => {
    const { data, error } = await client().rpc('get_all_members_for_admin')
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })

  it('the service role gets every member with email and ciphertext', async () => {
    const { data, error } = await supabaseAdmin.rpc('get_all_members_for_admin')
    expect(error).toBeNull()
    const row = (data as { id: string; email: string; dni_nie_encrypted: string }[]).find(
      (m) => m.id === users.victim.id
    )
    expect(row?.email).toBe(emails.victim)
    expect(decrypt(row!.dni_nie_encrypted, users.victim.id)).toBe('12345678Z')
  })

  it('refuses the owner role without a service-role JWT (guard inside the function)', async () => {
    const { error } = await runSqlAsPostgres('select count(*) from public.get_all_members_for_admin()')
    expect(error?.message).toContain('service role required')
  })
})

// ---------------------------------------------------------------------------------------------
describe('stored ciphertext is bound to its row (members_ciphertext_guard)', () => {
  it("refuses another member's v2 ciphertext copied into the caller's own row", async () => {
    const { data: victim } = await supabaseAdmin
      .from('members')
      .select('dni_nie_encrypted')
      .eq('id', users.victim.id)
      .single()
    const { error } = await member
      .from('members')
      .update({ dni_nie_encrypted: victim!.dni_nie_encrypted })
      .eq('id', users.member.id)
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('members:ciphertext_unbound')
  })

  it('a v2 value whose owner was rewritten passes the shape check but never decrypts (AAD)', async () => {
    const forged = encrypt('12345678Z', users.victim.id).replace(users.victim.id, users.member.id)
    // The database only checks the shape and the owner; the app refuses to decrypt it.
    expect(
      (await member.from('members').update({ dni_nie_encrypted: forged }).eq('id', users.member.id)).error
    ).toBeNull()
    expect(() => decrypt(forged, users.member.id)).toThrow()
  })

  it.each([
    ['a legacy iv:tag:data value', () => legacyEncrypt('612345678')],
    ['plaintext', () => '612345678'],
    ['v2 bound to another member', () => encrypt('612345678', users.victim.id)],
  ])('refuses %s, even from the service role', async (_label, value) => {
    const { error } = await supabaseAdmin
      .from('members')
      .update({ phone_encrypted: value() })
      .eq('id', users.member.id)
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('members:ciphertext_unbound: phone_encrypted')
  })

  it('accepts v2 bound to the row and null', async () => {
    const own = encrypt('612345678', users.member.id)
    expect((await member.from('members').update({ phone_encrypted: own }).eq('id', users.member.id)).error).toBeNull()
    expect((await member.from('members').update({ phone_encrypted: null }).eq('id', users.member.id)).error).toBeNull()
  })

  it('a row still holding a legacy value keeps working and decrypts through the fallback', async () => {
    const legacy = legacyEncrypt('12345678Z')
    const { error: seedError } = await runSqlAsPostgres(
      `DO $$
       BEGIN
         ALTER TABLE public.members DISABLE TRIGGER members_ciphertext_guard;
         UPDATE public.members SET dni_nie_encrypted = '${legacy}' WHERE id = '${users.legacy.id}';
         ALTER TABLE public.members ENABLE TRIGGER members_ciphertext_guard;
       END
       $$`
    )
    expect(seedError).toBeNull()

    const legacyClient = await createAuthenticatedClient(emails.legacy, password)
    expect(
      (await legacyClient.from('members').update({ postal_code: '08221' }).eq('id', users.legacy.id)).error
    ).toBeNull()
    const { data } = await legacyClient.from('members').select('dni_nie_encrypted').eq('id', users.legacy.id).single()
    expect(decrypt(data!.dni_nie_encrypted!, users.legacy.id)).toBe('12345678Z')
  })
})

// ---------------------------------------------------------------------------------------------
describe('TRUNCATE is revoked on members and member_badges', () => {
  it.each(['service_role', 'authenticated', 'anon'])('%s cannot truncate', async (role) => {
    const { data, error } = await runSqlAsPostgres<{ m: boolean; b: boolean }>(
      `select has_table_privilege($1, 'public.members', 'TRUNCATE') as m,
              has_table_privilege($1, 'public.member_badges', 'TRUNCATE') as b`,
      [role]
    )
    expect(error).toBeNull()
    expect(data![0]).toEqual({ m: false, b: false })
  })
})

// ---------------------------------------------------------------------------------------------
describe('audit_details_leak() v3 (BR-15)', () => {
  async function leak(details: unknown) {
    const { data, error } = await runSqlAsPostgres<{ leak: boolean }>(
      'select public.audit_details_leak($1::jsonb) as leak',
      [typeof details === 'string' ? details : JSON.stringify(details)]
    )
    expect(error).toBeNull()
    return data![0].leak
  }

  // Every miss of the T7 independent verification, plus label and separator variants.
  const leaks: unknown[] = [
    { v: 'Telf.: 93 123 45 67' },
    { v: 'tel.:612345678' },
    { v: 'DNI/NIE: X1234567L' },
    { v: 'N.I.E. X1234567L' },
    { v: 'n.i.f.: 12345678Z' },
    { v: 'D.N.I. 12.345.678-Z' },
    { v: '12,345,678Z' },
    { v: '612_345_678' },
    { v: '612·345·678' },
    { v: 'Tfno: 612 345 678' },
    { v: 'Móvil - 612345678' },
    { v: 'MÒBIL 612345678' },
    { v: 'TELÉFONO: 612345678' },
    { v: 'Teléfono móvil: 612 345 678' },
    { v: '(tel) 612345678' },
    '{"v": 612345678.0}', // raw JSON: JSON.stringify would drop the ".0"
    '{"v": 612345678.000}',
    { v: 61234567.8 },
    { v: 612345678.25 },
    { v: -612345678 },
    { 'DNI/NIE': 'x' },
    { phone_no: 'x' },
    { phoneNo: 'x' },
    { mobile_number: 'x' },
    { 'Mobile Number': 'x' },
    { 'telèfon': 'x' },
    { 'Tel.': 'x' },
    { nested: [{ 'n.i.e': 'x' }] },
  ]

  const safe: unknown[] = [
    { member_number: '000-123' },
    { date: '2026-10-05' },
    { at: '2026-10-05T10:00:00Z' },
    { id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b' },
    { token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' },
    { rows: 123456789 },
    { rows: 123456789.5 },
    { count: 1234567890 },
    { ludoya_id: '123456789012' },
    { v: '512345678' },
    { v: '1,234,567' },
    { v: 'Tel 123456789' },
    { v: 'telegram' },
    { v: 'Nieves' },
    { fields: ['dni', 'phone'] },
    { field: 'phone' },
    { changes: { first_name: { from: 'Laia', to: 'Laia Maria' } } },
  ]

  it.each(leaks.map((d) => [typeof d === 'string' ? d : JSON.stringify(d), d]))('flags %s', async (_label, details) => {
    expect(await leak(details)).toBe(true)
  })

  it.each(safe.map((d) => [JSON.stringify(d), d]))('lets %s through', async (_label, details) => {
    expect(await leak(details)).toBe(false)
  })
})
