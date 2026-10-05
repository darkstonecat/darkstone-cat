import { randomBytes } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261005100500_member_admin_mutations.sql: edit a member (A-4,
// admin_update_member), reveal DNI/phone (A-5, admin_reveal_sensitive), award and revoke
// badges (A-8), regenerate a card (A-9, regenerate_card_token v2) and the hardened BR-15
// detector audit_details_leak().
//
// Every user here is this file's own throwaway account. Superadmin cases (a former member's
// DNI reveal) live in roles.test.ts, the only file allowed to create superadmins. Audit entries
// cannot be deleted, so every assertion filters by this file's own targets.

const password = 'password123'
const DOMAIN = 'admin-mutations.test'
const emails = {
  board: `mam-board@${DOMAIN}`,
  member: `mam-member@${DOMAIN}`,
  target: `mam-target@${DOMAIN}`,
  reveal: `mam-reveal@${DOMAIN}`,
  badges: `mam-badges@${DOMAIN}`,
  card: `mam-card@${DOMAIN}`,
  former: `mam-former@${DOMAIN}`,
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

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000'

/** A value with the shape of src/lib/encryption.ts output (iv:tag:data, base64). Never decrypted here. */
function fakeCipher() {
  return [randomBytes(12), randomBytes(16), randomBytes(10)].map((b) => b.toString('base64')).join(':')
}

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

async function getRow(id: string) {
  const { data, error } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  expect(error).toBeNull()
  return data!
}

async function auditEntries(target: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id, actor_id, actor_role, action, target_member_id, details, reason')
    .eq('target_member_id', target)
    .eq('action', action)
    .order('id')
  expect(error).toBeNull()
  return data!
}

async function badgesOf(id: string) {
  const { data, error } = await supabaseAdmin
    .from('member_badges')
    .select('badge_key, awarded_at, awarded_by')
    .eq('member_id', id)
    .order('badge_key')
  expect(error).toBeNull()
  return data!
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Mutacions' })
    userIds.push(users[key].id)
  }
  await update(users.board.id, { role: 'board' })
  await update(users.target.id, {
    postal_code: '08221',
    ludoya_username: 'vella_ludoya',
    bgg_username: 'vella_bgg',
    phone_encrypted: fakeCipher(),
  })
  await update(users.former.id, {
    left_on: '2026-10-01',
    left_by: 'self',
    dni_nie_encrypted: fakeCipher(),
  })
  // A badge kept while the register is blocked (BR-7)
  expect(
    (await supabaseAdmin.from('member_badges').insert({ member_id: users.former.id, badge_key: 'ludoteca_donor' })).error
  ).toBeNull()

  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(() => cleanupUsers(userIds))

// ---------------------------------------------------------------------------------------------
describe('admin_update_member() (A-4)', () => {
  const editUpdate = (client: SupabaseClient, id: string, patch: unknown) =>
    client.rpc('admin_update_member', { p_member_id: id, p_patch: patch })

  it('updates the whitelisted fields and writes one member.update entry', async () => {
    const before = await getRow(users.target.id)
    const newPhone = fakeCipher()
    const newDni = fakeCipher()
    const { data, error } = await editUpdate(board, users.target.id, {
      first_name: '  Laia ',
      last_name: 'Serra',
      postal_code: '08222',
      ludoya_username: ' @nova_ludoya ',
      bgg_username: 'Nova BGG',
      phone_encrypted: newPhone,
      dni_nie_encrypted: newDni,
    })
    expect(error).toBeNull()
    expect(data).toEqual(['bgg_username', 'dni', 'first_name', 'last_name', 'ludoya_username', 'phone', 'postal_code'])

    const after = await getRow(users.target.id)
    expect(after).toMatchObject({
      first_name: 'Laia',
      last_name: 'Serra',
      postal_code: '08222',
      ludoya_username: 'nova_ludoya',
      bgg_username: 'Nova BGG',
      phone_encrypted: newPhone,
      dni_nie_encrypted: newDni,
      // untouched
      member_number: before.member_number,
      role: 'member',
      card_token: before.card_token,
      newsletter_accepted: before.newsletter_accepted,
    })

    const entries = await auditEntries(users.target.id, 'member.update')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actor_id: users.board.id, actor_role: 'board', reason: null })
    expect(entries[0].details).toEqual({
      fields: ['bgg_username', 'dni', 'first_name', 'last_name', 'ludoya_username', 'phone', 'postal_code'],
      changes: {
        first_name: { from: before.first_name, to: 'Laia' },
        last_name: { from: before.last_name, to: 'Serra' },
      },
    })
    // BR-15 / BR-20: no value of DNI, phone, postal code or usernames, old or new
    const text = JSON.stringify(entries[0].details)
    for (const value of ['08221', '08222', 'vella_ludoya', 'nova_ludoya', 'vella_bgg', 'Nova BGG', newPhone, newDni]) {
      expect(text).not.toContain(value)
    }
  })

  it('null (or blank) clears an optional field', async () => {
    const { data, error } = await editUpdate(board, users.target.id, {
      postal_code: '',
      bgg_username: null,
      phone_encrypted: null,
    })
    expect(error).toBeNull()
    expect(data).toEqual(['bgg_username', 'phone', 'postal_code'])
    expect(await getRow(users.target.id)).toMatchObject({ postal_code: null, bgg_username: null, phone_encrypted: null })
  })

  it('a patch that changes nothing returns no fields and writes no entry', async () => {
    const count = (await auditEntries(users.target.id, 'member.update')).length
    for (const patch of [{}, { first_name: 'Laia', last_name: ' Serra ', postal_code: null }]) {
      const { data, error } = await editUpdate(board, users.target.id, patch)
      expect(error).toBeNull()
      expect(data).toEqual([])
    }
    expect(await auditEntries(users.target.id, 'member.update')).toHaveLength(count)
  })

  it('rejects any key outside the A-4 whitelist and changes nothing', async () => {
    const before = await getRow(users.target.id)
    for (const patch of [
      { role: 'superadmin' },
      { member_number: '000-999' },
      { card_token: 'f'.repeat(32) },
      { newsletter_accepted: true },
      { email: 'x@example.com' },
      { left_on: '2026-01-01' },
      { membership_start_date: '2020-01-01' },
      { first_name: 'Ok', dni: '12345678Z' },
    ]) {
      const { error } = await editUpdate(board, users.target.id, patch)
      expect(error?.code, JSON.stringify(patch)).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
    }
    expect(await getRow(users.target.id)).toEqual(before)
  })

  it('rejects a patch that is not a JSON object', async () => {
    for (const patch of [['first_name'], 'first_name', null]) {
      const { error } = await editUpdate(board, users.target.id, patch)
      expect(error?.code).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
    }
  })

  it('validates values like the profile edit, naming the field', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ first_name: '   ' }, 'first_name'],
      [{ first_name: null }, 'first_name'],
      [{ last_name: 'x'.repeat(101) }, 'last_name'],
      [{ first_name: 42 }, 'first_name'],
      [{ postal_code: '0822' }, 'postal_code'],
      [{ postal_code: 8222 }, 'postal_code'],
      [{ ludoya_username: 'bad/name' }, 'ludoya_username'],
      [{ bgg_username: 'x'.repeat(65) }, 'bgg_username'],
      [{ phone_encrypted: '612345678' }, 'phone_encrypted'],
      [{ dni_nie_encrypted: '12345678Z' }, 'dni_nie_encrypted'],
      [{ dni_nie_encrypted: `${fakeCipher()}:extra` }, 'dni_nie_encrypted'],
    ]
    for (const [patch, field] of cases) {
      const { error } = await editUpdate(board, users.target.id, patch)
      expect(error?.code, JSON.stringify(patch)).toBe('22023')
      expect(error?.message).toContain(`admin:invalid_value: ${field}`)
    }
  })

  it('refuses a former member (read-only register, BR-21)', async () => {
    const { error } = await editUpdate(board, users.former.id, { first_name: 'Canvi' })
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:not_active')
    expect((await getRow(users.former.id)).first_name).toBe('Nomformer')
  })

  it('refuses an unknown member', async () => {
    const { error } = await editUpdate(board, UNKNOWN_ID, { first_name: 'Canvi' })
    expect(error?.message).toContain('admin:not_found')
  })

  it('refuses a plain member and an anonymous caller', async () => {
    const asMember = await editUpdate(member, users.target.id, { first_name: 'Hack' })
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toContain('admin:forbidden')

    const asAnon = await editUpdate(anon, users.target.id, { first_name: 'Hack' })
    expect(asAnon.error?.code).toBe('42501')
    expect((await getRow(users.target.id)).first_name).toBe('Laia')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_reveal_sensitive() (A-5)', () => {
  const reveal = (client: SupabaseClient, id: string, field: string, reason: string | null = null) =>
    client.rpc('admin_reveal_sensitive', { p_member_id: id, p_field: field, p_reason: reason })

  let dniCipher: string
  let phoneCipher: string

  beforeAll(async () => {
    dniCipher = fakeCipher()
    phoneCipher = fakeCipher()
    await update(users.reveal.id, { dni_nie_encrypted: dniCipher, phone_encrypted: phoneCipher })
  })

  it('returns the ciphertext and logs the field first (BR-15: never the value)', async () => {
    const { data, error } = await reveal(board, users.reveal.id, 'dni')
    expect(error).toBeNull()
    expect(data).toBe(dniCipher)

    // The entry is committed with the call: it exists even if the caller never uses the value
    const entries = await auditEntries(users.reveal.id, 'member.reveal_sensitive')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actor_id: users.board.id, details: { field: 'dni' }, reason: null })
  })

  it('reveals the phone, with an optional reason stored on the entry', async () => {
    const { data, error } = await reveal(board, users.reveal.id, 'phone', '  Trucada per l\'assemblea ')
    expect(error).toBeNull()
    expect(data).toBe(phoneCipher)
    const entries = await auditEntries(users.reveal.id, 'member.reveal_sensitive')
    expect(entries).toHaveLength(2)
    expect(entries[1]).toMatchObject({ details: { field: 'phone' }, reason: 'Trucada per l\'assemblea' })
  })

  it('rejects any field other than dni or phone, without an entry', async () => {
    for (const field of ['email', 'dni_nie_encrypted', '']) {
      const { error } = await reveal(board, users.reveal.id, field)
      expect(error?.code).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
    }
    expect(await auditEntries(users.reveal.id, 'member.reveal_sensitive')).toHaveLength(2)
  })

  it('a field with no stored value reveals nothing and logs nothing', async () => {
    const { error } = await reveal(board, users.member.id, 'phone')
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:no_value')
    expect(await auditEntries(users.member.id, 'member.reveal_sensitive')).toHaveLength(0)
  })

  it('caps the reason at 500 characters', async () => {
    const { error } = await reveal(board, users.reveal.id, 'dni', 'x'.repeat(501))
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:reason_too_long')
  })

  it('a board member cannot reveal a former member\'s DNI, even with a reason (BR-21)', async () => {
    const { data, error } = await reveal(board, users.former.id, 'dni', 'Requeriment del jutjat')
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('admin:forbidden')
    expect(data).toBeNull()
    expect(await auditEntries(users.former.id, 'member.reveal_sensitive')).toHaveLength(0)
  })

  it('refuses a plain member, an anonymous caller and an unknown member', async () => {
    const asMember = await reveal(member, users.reveal.id, 'dni')
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toContain('admin:forbidden')
    expect(asMember.data).toBeNull()

    const asAnon = await reveal(anon, users.reveal.id, 'dni')
    expect(asAnon.error?.code).toBe('42501')

    const unknown = await reveal(board, UNKNOWN_ID, 'dni')
    expect(unknown.error?.message).toContain('admin:not_found')
  })

  it('log_admin_event() no longer accepts member.reveal_sensitive', async () => {
    const { error } = await board.rpc('log_admin_event', {
      p_action: 'member.reveal_sensitive',
      p_target: users.reveal.id,
      p_details: { field: 'dni' },
      p_reason: null,
    })
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('audit:action_not_allowed')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_award_badge() / admin_revoke_badge() (A-8)', () => {
  const award = (client: SupabaseClient, id: string, key: string, note: string | null = null) =>
    client.rpc('admin_award_badge', { p_member_id: id, p_badge_key: key, p_note: note })
  const revoke = (client: SupabaseClient, id: string, key: string, reason: string | null = null) =>
    client.rpc('admin_revoke_badge', { p_member_id: id, p_badge_key: key, p_reason: reason })

  it('awards a badge, recording who awarded it, with one badge.award entry', async () => {
    const { error } = await award(board, users.badges.id, 'ludoteca_donor', 'Ha donat 12 jocs')
    expect(error).toBeNull()

    const rows = await badgesOf(users.badges.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ badge_key: 'ludoteca_donor', awarded_by: users.board.id })
    expect(Date.now() - new Date(rows[0].awarded_at).getTime()).toBeLessThan(60_000)

    const entries = await auditEntries(users.badges.id, 'badge.award')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      actor_id: users.board.id,
      details: { badge: 'ludoteca_donor' },
      reason: 'Ha donat 12 jocs',
    })
  })

  it('awarding a badge the member already holds fails and logs nothing', async () => {
    const { error } = await award(board, users.badges.id, 'ludoteca_donor')
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:badge_held')
    expect(await auditEntries(users.badges.id, 'badge.award')).toHaveLength(1)
  })

  it('only badges of the catalogue can be awarded ("Membre {year}" is automatic)', async () => {
    for (const key of ['made_up', 'member_2026', 'member_year', '']) {
      const { error } = await award(board, users.badges.id, key)
      expect(error?.code, key).toBe('22023')
      expect(error?.message).toContain('admin:invalid_argument')
    }
    for (const key of ['made_up', 'member_2026']) {
      const { error } = await revoke(board, users.badges.id, key)
      expect(error?.message).toContain('admin:invalid_argument')
    }
  })

  it('revokes a badge with one badge.revoke entry', async () => {
    const { error } = await revoke(board, users.badges.id, 'ludoteca_donor', 'Atorgada per error')
    expect(error).toBeNull()
    expect(await badgesOf(users.badges.id)).toEqual([])

    const entries = await auditEntries(users.badges.id, 'badge.revoke')
    expect(entries).toHaveLength(1)
    expect(entries[0].reason).toBe('Atorgada per error')
    expect(entries[0].details).toMatchObject({ badge: 'ludoteca_donor' })
    expect(entries[0].details.awarded_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('revoking a badge the member does not hold fails and logs nothing', async () => {
    const { error } = await revoke(board, users.badges.id, 'volunteer_egara_joga')
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:badge_not_held')
    expect(await auditEntries(users.badges.id, 'badge.revoke')).toHaveLength(1)
  })

  it('a former member\'s badges are frozen while the register is blocked (BR-7)', async () => {
    const awardFormer = await award(board, users.former.id, 'volunteer_egara_joga')
    expect(awardFormer.error?.message).toContain('admin:not_active')
    const revokeFormer = await revoke(board, users.former.id, 'ludoteca_donor')
    expect(revokeFormer.error?.message).toContain('admin:not_active')
    expect((await badgesOf(users.former.id)).map((b) => b.badge_key)).toEqual(['ludoteca_donor'])
  })

  it('refuses a plain member, an anonymous caller and an unknown member', async () => {
    const asMember = await award(member, users.member.id, 'volunteer_egara_joga')
    expect(asMember.error?.code).toBe('42501')
    expect(asMember.error?.message).toContain('admin:forbidden')
    const revokeAsMember = await revoke(member, users.former.id, 'ludoteca_donor')
    expect(revokeAsMember.error?.code).toBe('42501')

    expect((await award(anon, users.member.id, 'volunteer_egara_joga')).error?.code).toBe('42501')
    expect((await award(board, UNKNOWN_ID, 'volunteer_egara_joga')).error?.message).toContain('admin:not_found')
    expect(await badgesOf(users.member.id)).toEqual([])
  })

  it('the note is capped at 500 characters', async () => {
    const { error } = await award(board, users.badges.id, 'volunteer_egara_joga', 'x'.repeat(501))
    expect(error?.message).toContain('admin:reason_too_long')
    expect(await badgesOf(users.badges.id)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
describe('regenerate_card_token() v2 (A-9)', () => {
  const regenerate = (client: SupabaseClient, id: string) =>
    client.rpc('regenerate_card_token', { target_member_id: id })

  it('issues a new token, stamps card_issued_at and writes one card.regenerate entry', async () => {
    const before = await getRow(users.card.id)
    const { data, error } = await regenerate(board, users.card.id)
    expect(error).toBeNull()
    expect(data).toMatch(/^[0-9a-f]{32}$/)
    expect(data).not.toBe(before.card_token)

    const after = await getRow(users.card.id)
    expect(after.card_token).toBe(data)
    expect(new Date(after.card_issued_at).getTime()).toBeGreaterThan(new Date(before.card_issued_at).getTime())

    const entries = await auditEntries(users.card.id, 'card.regenerate')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ actor_id: users.board.id, actor_role: 'board' })
    // The token itself never goes to the log
    expect(JSON.stringify(entries[0].details)).not.toContain(data as string)
  })

  it('refuses a former member (the card is invalid until the return, BR-4)', async () => {
    const before = await getRow(users.former.id)
    const { error } = await regenerate(board, users.former.id)
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('admin:not_active')
    expect((await getRow(users.former.id)).card_token).toBe(before.card_token)
  })

  it('refuses a plain member (even for their own card) and an unknown member', async () => {
    const before = await getRow(users.member.id)
    for (const id of [users.member.id, users.card.id]) {
      const { error } = await regenerate(member, id)
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('admin:forbidden')
    }
    expect((await getRow(users.member.id)).card_token).toBe(before.card_token)

    const unknown = await regenerate(board, UNKNOWN_ID)
    expect(unknown.error?.code).toBe('22023')
    expect(unknown.error?.message).toContain('admin:not_found')
  })
})

// ---------------------------------------------------------------------------------------------
describe('audit_details_leak() (BR-15)', () => {
  async function leak(details: unknown) {
    const { data, error } = await runSqlAsPostgres<{ leak: boolean }>(
      'select public.audit_details_leak($1::jsonb) as leak',
      [JSON.stringify(details)]
    )
    expect(error).toBeNull()
    return data![0].leak
  }

  const leaks: unknown[] = [
    // DNI / NIE, with separators, labels and surrounding whitespace
    { v: '12345678Z' },
    { v: ' 12345678z\n' },
    { v: '12.345.678-Z' },
    { v: '12 345 678 Z' },
    { v: 'DNI 12345678Z' },
    { v: 'dni: 12345678-Z' },
    { v: 'X1234567L' },
    { v: 'x-1234567-l' },
    { v: 'NIE: Y1234567B' },
    // Spanish phones, with prefixes, separators and labels
    { v: '612345678' },
    { v: '\t712 34 56 78 ' },
    { v: '+34 612 345 678' },
    { v: '(+34) 612345678' },
    { v: '0034612345678' },
    { v: '612/345/678' },
    { v: '612.345.678' },
    { v: 'tel: 612345678' },
    { v: 'Tel. 912 34 56 78' },
    { v: 'telèfon 612345678' },
    { v: 'mòbil: 612-345-678' },
    // any international number written with +
    { v: '+44 7700 900123' },
    // phones as JSON numbers
    { v: 612345678 },
    { v: 34612345678 },
    // nested
    { a: [{ b: '712-34-56-78' }] },
    { a: { b: { c: ['x', '12345678Z'] } } },
    // sensitive keys, case and separator variants, at any depth
    { dni: 'x' },
    { DNI_NIE: 'x' },
    { dniNie: 'x' },
    { 'dni-nie': 'x' },
    { nif: 'x' },
    { phone: null },
    { phoneNumber: 'x' },
    { telefono: 'x' },
    { 'Teléfono': 'x' },
    { telefon: 'x' },
    { Movil: 'x' },
    { 'móvil': 'x' },
    { mobil: 'x' },
    { mobile: 'x' },
    { nested: { deep: { Phone_Encrypted: 'x' } } },
  ]

  const safe: unknown[] = [
    {},
    { member_number: '000-123' },
    { member_number: '000-1234' },
    { date: '2026-10-05' },
    { at: '2026-10-05T10:00:00Z' },
    { at: '2026-10-05 10:00:00+02' },
    { id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b' },
    { token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' },
    { rows: 123456789 },
    { rows: '123456789' },
    { count: 1234567890 },
    { ludoya_id: '123456789012' },
    { ludoya_id: 123456789012 },
    { bgg_id: 174430 },
    { duration_ms: 2100 },
    { v: '512345678' },
    { v: '12345678' },
    { fields: ['dni', 'phone', 'dni_nie_encrypted', 'phone_encrypted'] },
    { field: 'dni' },
    { field: 'phone' },
    { badge: 'ludoteca_donor', awarded_on: '2026-10-05' },
    { changes: { first_name: { from: 'Laia', to: 'Laia Maria' } } },
    { list: 'newsletter', count: 97 },
    { filter: { state: 'active', q: 'serra' }, rows: 3 },
    { jobs: ['ludoya', 'bgg'], result: 'ok' },
  ]

  it.each(leaks.map((d) => [JSON.stringify(d), d]))('flags %s', async (_label, details) => {
    expect(await leak(details)).toBe(true)
  })

  it.each(safe.map((d) => [JSON.stringify(d), d]))('lets %s through', async (_label, details) => {
    expect(await leak(details)).toBe(false)
  })
})
