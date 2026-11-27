import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, createAuthenticatedClient, cleanupUsers } from '../helpers/supabase'
import { fakeMemberCipher } from '../helpers/cipher'

// Migration 20261127100000_member_backup_rows.sql: backup_member_rows(), the one read of the
// weekly member backup (docs/features/member-backup/spec.md). Service role only; every member
// row except purged stubs and unconfirmed sign-ups; e-mail from auth.users; badges as
// "key@YYYY-MM-DD; …". The function returns every member in the database, so assertions look
// only at this file's own ids.

const password = 'password123'
const DOMAIN = 'member-backup.test'
const emails = {
  active: `mb-active@${DOMAIN}`,
  former: `mb-former@${DOMAIN}`,
  purged: `mb-purged@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, string>
const userIds: string[] = []
let unconfirmedId: string
let member: SupabaseClient
const ciphers = {} as { phone: string; dni: string; formerDni: string }

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

type Row = Record<string, unknown> & { id: string }

async function ownRows(): Promise<Row[]> {
  const { data, error } = await supabaseAdmin.rpc('backup_member_rows')
  expect(error).toBeNull()
  return (data as Row[]).filter((row) => userIds.includes(row.id))
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    const user = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Backup' })
    users[key] = user.id
    userIds.push(user.id)
  }
  const { data: pending, error } = await supabaseAdmin.auth.admin.createUser({
    email: `mb-unconfirmed@${DOMAIN}`,
    password,
    email_confirm: false,
    user_metadata: { first_name: 'Pendent', last_name: 'Backup' },
  })
  expect(error).toBeNull()
  unconfirmedId = pending.user!.id
  userIds.push(unconfirmedId)

  ciphers.phone = fakeMemberCipher(users.active)
  ciphers.dni = fakeMemberCipher(users.active)
  ciphers.formerDni = fakeMemberCipher(users.former)
  await update(users.active, {
    phone_encrypted: ciphers.phone,
    dni_nie_encrypted: ciphers.dni,
    postal_code: '08221',
    ludoya_username: 'mb_ludoya',
    bgg_username: 'mb_bgg',
    newsletter_accepted: true,
    membership_start_date: '2020-03-01',
    current_joined_on: '2024-05-10',
  })
  await update(users.former, {
    left_on: '2026-09-20',
    left_by: 'board',
    leave_reason: 'Ha marxat de Terrassa',
    dni_nie_encrypted: ciphers.formerDni,
  })
  await update(users.purged, { left_on: '2022-01-10', left_by: 'self', purged_at: '2025-01-11T03:00:00Z' })

  // 23:30 UTC on 2026-03-01 is already 2026-03-02 in Madrid.
  const badges = [
    { member_id: users.active, badge_key: 'ludoteca_donor', awarded_at: '2026-03-01T23:30:00Z' },
    { member_id: users.active, badge_key: 'volunteer_egara_joga', awarded_at: '2025-01-15T10:00:00Z' },
  ]
  expect((await supabaseAdmin.from('member_badges').insert(badges)).error).toBeNull()

  member = await createAuthenticatedClient(emails.active, password)
})

afterAll(() => cleanupUsers(userIds))

describe('backup_member_rows()', () => {
  it('is refused to anon and to a signed-in member', async () => {
    for (const client of [anon, member]) {
      const { data, error } = await client.rpc('backup_member_rows')
      expect(data).toBeNull()
      expect(error?.code).toBe('42501')
    }
  })

  it('returns active and former members, never purged stubs or unconfirmed sign-ups', async () => {
    const ids = (await ownRows()).map((row) => row.id).sort()
    expect(ids).toEqual([users.active, users.former].sort())
    expect(ids).not.toContain(users.purged)
    expect(ids).not.toContain(unconfirmedId)
  })

  it('carries the e-mail, the encrypted secrets and every column of the Sheet', async () => {
    const active = (await ownRows()).find((row) => row.id === users.active)!
    expect(active).toMatchObject({
      first_name: 'Nomactive',
      last_name: 'Backup',
      email: emails.active,
      dni_nie_encrypted: ciphers.dni,
      phone_encrypted: ciphers.phone,
      postal_code: '08221',
      ludoya_username: 'mb_ludoya',
      bgg_username: 'mb_bgg',
      role: 'member',
      newsletter_accepted: true,
      membership_start_date: '2020-03-01',
      current_joined_on: '2024-05-10',
      left_on: null,
      left_by: null,
      leave_reason: null,
      anonymised_at: null,
    })
    expect(typeof active.member_number).toBe('string')
    expect(typeof active.created_at).toBe('string')
  })

  it('keeps the baixa fields of a former member', async () => {
    const former = (await ownRows()).find((row) => row.id === users.former)!
    expect(former).toMatchObject({
      left_on: '2026-09-20',
      left_by: 'board',
      leave_reason: 'Ha marxat de Terrassa',
      dni_nie_encrypted: ciphers.formerDni,
      badges: null,
    })
  })

  it('lists badges oldest first as key@date in Madrid time', async () => {
    const active = (await ownRows()).find((row) => row.id === users.active)!
    expect(active.badges).toBe('volunteer_egara_joga@2025-01-15; ludoteca_donor@2026-03-02')
  })
})
