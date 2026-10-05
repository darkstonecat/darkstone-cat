import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'
import { fakeMemberCipher } from '../helpers/cipher'

// Migration 20261005100000_membership_state.sql: membership columns, column-level UPDATE
// grants on members, and former members (left_on set) locked out of their own row.

const password = 'password123'
const activeEmail = 'membership-active@test.local'
const formerEmail = 'membership-former@test.local'
let active: { id: string }
let former: { id: string }
const userIds: string[] = []

beforeAll(async () => {
  active = await createTestUser(activeEmail, password, { first_name: 'Active', last_name: 'Member' })
  former = await createTestUser(formerEmail, password, { first_name: 'Former', last_name: 'Member' })
  userIds.push(active.id, former.id)
})

// The leave is written with the service role, as the board functions (T6) will.

afterAll(() => cleanupUsers(userIds))

async function markFormer(id: string) {
  const { error } = await supabaseAdmin
    .from('members')
    .update({ left_on: '2026-10-01', left_by: 'self' })
    .eq('id', id)
  expect(error).toBeNull()
}

describe('membership columns', () => {
  it('a new member starts with alta actual = primera alta, no leave and a card issue time', async () => {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select(
        'membership_start_date, current_joined_on, left_on, left_by, leave_reason, anonymised_at, purged_at, card_issued_at'
      )
      .eq('id', active.id)
      .single()

    expect(error).toBeNull()
    expect(data!.current_joined_on).toBe(data!.membership_start_date)
    expect(data!.left_on).toBeNull()
    expect(data!.left_by).toBeNull()
    expect(data!.leave_reason).toBeNull()
    expect(data!.anonymised_at).toBeNull()
    expect(data!.purged_at).toBeNull()
    expect(data!.card_issued_at).not.toBeNull()
  })

  it('member_badges has a nullable awarded_by', async () => {
    const { error } = await supabaseAdmin.from('member_badges').select('awarded_by').limit(1)
    expect(error).toBeNull()
  })
})

describe('membership consistency checks', () => {
  async function tryUpdate(values: Record<string, unknown>) {
    return supabaseAdmin.from('members').update(values).eq('id', active.id)
  }

  it('rejects an unknown left_by value', async () => {
    const { error } = await tryUpdate({ left_on: '2026-10-01', left_by: 'someone' })
    expect(error?.code).toBe('23514')
  })

  it('rejects left_on without left_by, and left_by without left_on', async () => {
    expect((await tryUpdate({ left_on: '2026-10-01' })).error?.code).toBe('23514')
    expect((await tryUpdate({ left_by: 'self' })).error?.code).toBe('23514')
  })

  it('rejects a board leave without a reason', async () => {
    const { error } = await tryUpdate({ left_on: '2026-10-01', left_by: 'board' })
    expect(error?.code).toBe('23514')
  })

  it('rejects a leave reason longer than 500 characters', async () => {
    const { error } = await tryUpdate({
      left_on: '2026-10-01',
      left_by: 'board',
      leave_reason: 'x'.repeat(501),
    })
    expect(error?.code).toBe('23514')
  })

  it('rejects anonymised_at or purged_at on an active member', async () => {
    expect((await tryUpdate({ anonymised_at: new Date().toISOString() })).error?.code).toBe('23514')
    expect((await tryUpdate({ purged_at: new Date().toISOString() })).error?.code).toBe('23514')
  })

  it('leaves the active member untouched after the rejected writes', async () => {
    const { data } = await supabaseAdmin
      .from('members')
      .select('left_on, left_by, anonymised_at, purged_at')
      .eq('id', active.id)
      .single()
    expect(data).toEqual({ left_on: null, left_by: null, anonymised_at: null, purged_at: null })
  })
})

describe('column-level UPDATE for members', () => {
  it('a member can still update every self-editable profile column', async () => {
    const client = await createAuthenticatedClient(activeEmail, password)
    const { data, error } = await client
      .from('members')
      .update({
        first_name: 'Activa',
        last_name: 'Sòcia',
        postal_code: '08221',
        ludoya_username: 'active_ludoya',
        bgg_username: 'active_bgg',
        newsletter_accepted: true,
        phone_encrypted: fakeMemberCipher(active.id),
        dni_nie_encrypted: fakeMemberCipher(active.id),
      })
      .eq('id', active.id)
      .select('first_name, postal_code, newsletter_accepted')

    expect(error).toBeNull()
    expect(data).toEqual([{ first_name: 'Activa', postal_code: '08221', newsletter_accepted: true }])
  })

  it.each([
    ['left_on', '2026-10-01'],
    ['left_by', 'self'],
    ['leave_reason', 'no'],
    ['current_joined_on', '2000-01-01'],
    ['card_issued_at', '2000-01-01T00:00:00Z'],
    ['anonymised_at', '2000-01-01T00:00:00Z'],
    ['purged_at', '2000-01-01T00:00:00Z'],
    ['role', 'admin'],
    ['member_number', 'XXX-999'],
    ['card_token', 'a'.repeat(32)],
    ['membership_start_date', '2000-01-01'],
    ['created_at', '2000-01-01T00:00:00Z'],
  ])('a member cannot update %s on their own row (permission denied)', async (column, value) => {
    const client = await createAuthenticatedClient(activeEmail, password)
    const { error } = await client
      .from('members')
      .update({ [column]: value })
      .eq('id', active.id)

    expect(error?.code).toBe('42501')
  })

  it('a member cannot insert or delete member rows', async () => {
    const client = await createAuthenticatedClient(activeEmail, password)
    const del = await client.from('members').delete().eq('id', active.id)
    expect(del.error?.code).toBe('42501')
    const ins = await client
      .from('members')
      .insert({ id: '00000000-0000-0000-0000-000000000001', member_number: 'XXX-001' })
    expect(ins.error?.code).toBe('42501')

    const { data } = await supabaseAdmin.from('members').select('id').eq('id', active.id)
    expect(data).toHaveLength(1)
  })
})

describe('former members', () => {
  it('a former member cannot update their own row', async () => {
    const client = await createAuthenticatedClient(formerEmail, password)
    await markFormer(former.id)

    const { data, error } = await client
      .from('members')
      .update({ postal_code: '08001' })
      .eq('id', former.id)
      .select('id')

    // RLS USING filters the row: 0 rows updated, no error.
    expect(error).toBeNull()
    expect(data).toEqual([])
    const { data: row } = await supabaseAdmin
      .from('members')
      .select('postal_code, left_on')
      .eq('id', former.id)
      .single()
    expect(row!.postal_code).not.toBe('08001')
    expect(row!.left_on).toBe('2026-10-01')
  })
})
