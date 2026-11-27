import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, createTestUser, createAuthenticatedClient, cleanupUsers, runSqlAsPostgres } from '../helpers/supabase'
import { BACKUP_HEADERS, buildBackupSheet, type BackupMemberRow } from '@/lib/backup/sheet'
import { decrypt, encrypt } from '@/lib/encryption'
import { run } from '../../scripts/restore-members.mjs'
import { parseKey } from '../../scripts/reencrypt-member-secrets.mjs'

// Backup → restore round trip (docs/features/member-backup/spec.md §7): members are read with
// backup_member_rows(), turned into Sheet cells by the backup code, written as the CSV a board
// member downloads, given new numbers and e-mails (as if the database were new), restored by
// scripts/restore-members.mjs, and read back: every other cell must come back the same.
// Also migration 20261127100200_restore_member_number_floor.sql.

const password = 'password123'
const SRC = 'member-restore-src.test'
const DST = 'member-restore-dst.test'
const srcIds: string[] = []
const restoredIds: string[] = []
const at = (cells: string[], header: (typeof BACKUP_HEADERS)[number]) => cells[BACKUP_HEADERS.indexOf(header)]
const quote = (v: string) => `"${v.replace(/"/g, '""')}"`
const toCsv = (values: string[][]) => values.map((row) => row.map(quote).join(',')).join('\n')

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

async function update(id: string, values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('members').update(values).eq('id', id)
  expect(error).toBeNull()
}

async function backupRows(): Promise<BackupMemberRow[]> {
  const { data, error } = await supabaseAdmin.rpc('backup_member_rows')
  expect(error).toBeNull()
  return data as BackupMemberRow[]
}

async function seqValue(): Promise<number> {
  const { data, error } = await runSqlAsPostgres<{ v: string }>(
    'SELECT (CASE WHEN is_called THEN last_value ELSE last_value - 1 END)::text AS v FROM public.member_number_seq'
  )
  expect(error).toBeNull()
  return Number(data![0].v)
}

beforeAll(async () => {
  const active = await createTestUser(`active@${SRC}`, password, { first_name: 'Núria', last_name: "d'Olot" })
  const former = await createTestUser(`former@${SRC}`, password, { first_name: 'Pere', last_name: 'Vila' })
  srcIds.push(active.id, former.id)
  await update(active.id, {
    role: 'board',
    phone_encrypted: encrypt('+34 600 123 456', active.id),
    dni_nie_encrypted: encrypt('12345678Z', active.id),
    postal_code: '08221',
    ludoya_username: 'nuria_l',
    bgg_username: 'nuria_b',
    newsletter_accepted: true,
    membership_start_date: '2020-03-01',
    current_joined_on: '2024-05-10',
  })
  await update(former.id, {
    dni_nie_encrypted: encrypt('X1234567L', former.id),
    left_on: '2026-09-20',
    left_by: 'board',
    leave_reason: '=no ve mai',
    newsletter_accepted: false,
  })
  const badges = [
    { member_id: active.id, badge_key: 'ludoteca_donor', awarded_at: '2025-01-15T10:00:00Z' },
    { member_id: former.id, badge_key: 'volunteer_egara_joga', awarded_at: '2026-03-01T23:30:00Z' },
  ]
  expect((await supabaseAdmin.from('member_badges').insert(badges)).error).toBeNull()
})

afterAll(async () => {
  await cleanupUsers([...srcIds, ...restoredIds])
})

describe('restore_raise_member_number_seq()', () => {
  it('is refused to anon and to a signed-in member', async () => {
    const user = await createTestUser(`member@${SRC}`, password)
    srcIds.push(user.id)
    const member = await createAuthenticatedClient(`member@${SRC}`, password)
    for (const client of [anon, member]) {
      expect((await client.rpc('restore_raise_member_number_seq', { p_floor: 1 })).error?.code).toBe('42501')
    }
  })

  it('never lowers the sequence and refuses a floor below 1', async () => {
    const before = await seqValue()
    const { data, error } = await supabaseAdmin.rpc('restore_raise_member_number_seq', { p_floor: 1 })
    expect(error).toBeNull()
    expect(Number(data)).toBeGreaterThanOrEqual(before)
    expect(await seqValue()).toBeGreaterThanOrEqual(before)
    const bad = await supabaseAdmin.rpc('restore_raise_member_number_seq', { p_floor: 0 })
    expect(bad.error?.code).toBe('22023')
    expect(bad.error?.message).toMatch(/^restore:invalid_argument/)
  })
})

describe('backup → restore round trip', () => {
  it('rebuilds every member with the same cells, bans former members and is safe to re-run', async () => {
    const source = (await backupRows()).filter((row) => srcIds.slice(0, 2).includes(row.id))
    expect(source).toHaveLength(2)
    const sheet = buildBackupSheet(source, decrypt)
    expect(sheet.illegible).toBe(0)

    // Free numbers above every number in use: reserve a block, then restore into it.
    const { data: top, error: topError } = await runSqlAsPostgres<{ v: string }>(
      "SELECT public.restore_raise_member_number_seq(pg_catalog.nextval('public.member_number_seq') + 10)::text AS v"
    )
    expect(topError).toBeNull()
    const base = Number(top![0].v) - 9
    const numberOf = (n: number) => `000-${String(n).padStart(3, '0')}`

    const [header, ...rows] = sheet.values
    const restoredRows = rows.map((cells, i) => {
      const copy = [...cells]
      copy[BACKUP_HEADERS.indexOf('Número')] = numberOf(base + i)
      copy[BACKUP_HEADERS.indexOf('Email')] = at(cells, 'Email').replace(SRC, DST)
      return copy
    })
    // An anonymised former member has no e-mail: only the members row comes back.
    const anonymised = [...restoredRows[1]]
    anonymised[BACKUP_HEADERS.indexOf('Número')] = numberOf(base + 5)
    anonymised[BACKUP_HEADERS.indexOf('Email')] = ''
    anonymised[BACKUP_HEADERS.indexOf('Anonimitzat')] = '2026-10-01'
    const csvText = toCsv([header, ...restoredRows, anonymised])

    const logs: string[] = []
    const key = parseKey(process.env.ENCRYPTION_KEY)
    const result = await run({ supabase: supabaseAdmin, key, csvText, apply: true, log: (l: string) => logs.push(l) })

    const restored = (await backupRows()).filter((row) =>
      [numberOf(base), numberOf(base + 1), numberOf(base + 5)].includes(row.member_number)
    )
    restoredIds.push(...restored.map((row) => row.id))
    expect(result).toMatchObject({ exitCode: 0, counts: { created: 3, errors: 0, invalid: 0 } })
    expect(restored).toHaveLength(3)

    const after = buildBackupSheet(restored, decrypt).values.slice(1)
    const comparable = (cells: string[]) =>
      cells.filter((_, i) => !['Número', 'Email', 'Creat'].includes(BACKUP_HEADERS[i]))
    expect(after.map(comparable)).toEqual([...restoredRows, anonymised].map(comparable))
    expect(after.map((cells) => at(cells, 'Email'))).toEqual([`active@${DST}`, `former@${DST}`, ''])
    expect(at(after[0], 'Rol')).toBe('board')
    expect(at(after[1], 'Motiu de baixa')).toBe("'=no ve mai")

    const formerId = restored.find((row) => row.member_number === numberOf(base + 1))!.id
    const { data: account } = await supabaseAdmin.auth.admin.getUserById(formerId)
    expect(new Date(account.user!.banned_until!).getTime()).toBeGreaterThan(Date.now() + 50 * 365 * 86_400_000)
    const activeId = restored.find((row) => row.member_number === numberOf(base))!.id
    const { data: activeAccount } = await supabaseAdmin.auth.admin.getUserById(activeId)
    expect(activeAccount.user!.email_confirmed_at).toBeTruthy()
    expect(activeAccount.user!.banned_until ?? null).toBeNull()

    // The output names member numbers only.
    const output = logs.join('\n')
    for (const secret of ['Núria', 'Pere', SRC, DST, '12345678Z', 'X1234567L', '600 123 456', '08221']) {
      expect(output).not.toContain(secret)
    }

    // A second run restores nothing.
    const again = await run({ supabase: supabaseAdmin, key, csvText, apply: false, log: () => {} })
    expect(again).toMatchObject({ exitCode: 0, counts: { create: 0, skip: 3, invalid: 0 } })
  })
})
