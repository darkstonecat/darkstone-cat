import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Retention job (spec §4.5, §5.3, BR-14, BR-22), 20261006100100_retention.sql.
//
// Integration files run in parallel and other files hold former members, unconfirmed sign-ups
// and backdated audit rows of their own. So the apply path is tested only through the internal
// retention_run(p_dry_run, p_only) with p_only = this file's fixtures, run as postgres. The
// public run_retention() is called here in dry-run mode only (it changes nothing).

const DOMAIN = 'retention.test.local'
const password = 'password123'
const startedAt = new Date().toISOString()

type Summary = {
  dry_run: boolean
  members_purged: number
  unconfirmed_deleted: number
  audit_entries_deleted: number
}

const users: Record<string, { id: string; member_number: string }> = {}
const userIds: string[] = []
const auditIds: Record<'old' | 'recent', number> = { old: 0, recent: 0 }

const bound = (id: string) => `v2:${id}:ZG5pZG5pZG5pZG5p:ZG5pZG5pZG5pZG5pZG5pZA==:RE5JRE5J`

async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []) {
  const { data, error } = await runSqlAsPostgres<T>(query, params)
  expect(error).toBeNull()
  return data!
}

async function run(dryRun: boolean): Promise<Summary> {
  const ids = Object.values(users).map((u) => u.id)
  const [row] = await sql<Summary>('select * from public.retention_run($1::boolean, $2::uuid[])', [dryRun, ids])
  return row
}

async function getRow(id: string) {
  const [row] = await sql<Record<string, unknown>>(
    `select member_number, first_name, last_name, dni_nie_encrypted, leave_reason, left_on::text,
            left_by, membership_start_date::text, current_joined_on::text, purged_at, anonymised_at,
            (select count(*)::int from public.member_badges b where b.member_id = m.id) as badges
     from public.members m where m.id = $1::uuid`,
    [id]
  )
  return row
}

async function authUserExists(id: string) {
  const rows = await sql<{ n: number }>('select count(*)::int as n from auth.users where id = $1::uuid', [id])
  return rows[0].n === 1
}

async function entries(action: string, target?: string) {
  return sql<{ actor_id: string | null; target_member_number: string | null; details: Record<string, unknown> }>(
    `select actor_id, target_member_number, details from public.audit_log
     where action = $1 and created_at >= $2::timestamptz
       and ($3::uuid is null or target_member_id = $3::uuid)
     order by id`,
    [action, startedAt, target ?? null]
  )
}

async function confirmed(key: string, first: string) {
  const user = await createTestUser(`ret-${key}@${DOMAIN}`, password, { first_name: first, last_name: 'Retqzv' })
  userIds.push(user.id)
  const [{ member_number }] = await sql<{ member_number: string }>(
    'select member_number from public.members where id = $1::uuid',
    [user.id]
  )
  users[key] = { id: user.id, member_number }
}

async function unconfirmed(key: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: `ret-${key}@${DOMAIN}`,
    password,
    email_confirm: false,
    user_metadata: { first_name: 'Pending', last_name: 'Retqzv' },
  })
  expect(error).toBeNull()
  userIds.push(data.user!.id)
  const [{ member_number }] = await sql<{ member_number: string }>(
    'select member_number from public.members where id = $1::uuid',
    [data.user!.id]
  )
  users[key] = { id: data.user!.id, member_number }
}

beforeAll(async () => {
  await confirmed('formerOld', 'Antiga')
  await confirmed('formerAtDate', 'Justa')
  await confirmed('formerDayBefore', 'Gairebé')
  await confirmed('formerRecent', 'Recent')
  await confirmed('formerAnonymised', 'Anònima')
  await confirmed('alreadyPurged', 'Purgada')
  await confirmed('active', 'Activa')
  await confirmed('confirmedOld', 'Veterana')
  await unconfirmed('unconfirmedOld')
  await unconfirmed('unconfirmedYoung')

  // Former member, left in 2022 by the board: purge date 2025-01-01 has passed.
  await sql(
    `update public.members set left_on = '2022-01-01', left_by = 'board', leave_reason = 'Motiu antic de la junta',
       membership_start_date = '2015-03-01', current_joined_on = '2019-05-01', dni_nie_encrypted = $2
     where id = $1::uuid`,
    [users.formerOld.id, bound(users.formerOld.id)]
  )
  await sql(
    `insert into public.member_badges (member_id, badge_key) values ($1::uuid, 'ludoteca_donor'), ($1::uuid, 'volunteer_egara_joga')`,
    [users.formerOld.id]
  )
  // Purge date is today (Madrid) → purged; purge date tomorrow → kept.
  await sql(
    `update public.members set left_on = (public.membership_today() - interval '3 years')::date, left_by = 'self'
     where id = $1::uuid`,
    [users.formerAtDate.id]
  )
  await sql(
    `update public.members set left_on = (public.membership_today() - interval '3 years' + interval '1 day')::date,
       left_by = 'self', membership_start_date = '2015-01-01', current_joined_on = '2015-01-01'
     where id = $1::uuid`,
    [users.formerDayBefore.id]
  )
  await sql(`update public.members set left_on = '2026-01-15', left_by = 'self' where id = $1::uuid`, [
    users.formerRecent.id,
  ])
  // Anonymised earlier (S-3): the login account is already gone, the stub remains.
  await sql(
    `update public.members set left_on = '2021-06-01', left_by = 'self', anonymised_at = now() - interval '2 years'
     where id = $1::uuid`,
    [users.formerAnonymised.id]
  )
  await sql('delete from auth.users where id = $1::uuid', [users.formerAnonymised.id])
  // Purged before: never touched again.
  await sql(
    `update public.members set left_on = '2020-01-01', left_by = 'self', first_name = '', last_name = '',
       purged_at = now() - interval '1 year'
     where id = $1::uuid`,
    [users.alreadyPurged.id]
  )
  // A confirmed account and an unconfirmed sign-up, both well past 30 days; one fresh sign-up.
  await sql(`update auth.users set created_at = now() - interval '40 days' where id = $1::uuid`, [users.confirmedOld.id])
  await sql(`update auth.users set created_at = now() - interval '31 days' where id = $1::uuid`, [users.unconfirmedOld.id])

  // Audit rows about a fixture: one past the 3-year retention, one inside it.
  const [old] = await sql<{ id: number }>(
    `insert into public.audit_log (created_at, action, target_member_id, target_member_number)
     values ('2001-02-03T10:00:00Z', 'membership.leave', $1::uuid, $2) returning id`,
    [users.formerRecent.id, users.formerRecent.member_number]
  )
  const [recent] = await sql<{ id: number }>(
    `insert into public.audit_log (created_at, action, target_member_id, target_member_number)
     values (now() - interval '2 years 11 months', 'membership.leave', $1::uuid, $2) returning id`,
    [users.formerRecent.id, users.formerRecent.member_number]
  )
  auditIds.old = Number(old.id)
  auditIds.recent = Number(recent.id)
})

afterAll(async () => {
  await runSqlAsPostgres(
    `delete from public.audit_log where created_at < now() - interval '3 years' and target_member_id = any($1::uuid[])`,
    [userIds]
  )
  await cleanupUsers(userIds)
})

async function auditRowExists(id: number) {
  const rows = await sql<{ n: number }>('select count(*)::int as n from public.audit_log where id = $1::bigint', [id])
  return rows[0].n === 1
}

describe('who may run the retention job', () => {
  it('run_retention is denied to anon and authenticated members', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false } }
    )
    const member = await createAuthenticatedClient(`ret-active@${DOMAIN}`, password)
    for (const client of [anon, member]) {
      for (const args of [{}, { p_dry_run: true }, { p_dry_run: false }]) {
        const { data, error } = await client.rpc('run_retention', args)
        expect(data).toBeNull()
        expect(error?.code).toBe('42501')
      }
    }
  })

  it('the internal retention_run is not exposed to any API role', async () => {
    const { error } = await supabaseAdmin.rpc('retention_run', { p_dry_run: true, p_only: [] })
    expect(error).not.toBeNull()
    const [row] = await sql<{ anon: boolean; auth: boolean; service: boolean }>(
      `select has_function_privilege('anon', 'public.retention_run(boolean, uuid[])', 'execute') as anon,
              has_function_privilege('authenticated', 'public.retention_run(boolean, uuid[])', 'execute') as auth,
              has_function_privilege('service_role', 'public.retention_run(boolean, uuid[])', 'execute') as service`
    )
    expect(row).toEqual({ anon: false, auth: false, service: false })
  })

  it('run_retention defaults to a dry run for the service role', async () => {
    const { data, error } = await supabaseAdmin.rpc('run_retention')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({ dry_run: true })
    for (const key of ['members_purged', 'unconfirmed_deleted', 'audit_entries_deleted']) {
      expect(typeof data![0][key]).toBe('number')
    }
    // nothing changed for this file's fixtures
    expect((await getRow(users.formerOld.id)).purged_at).toBeNull()
    expect(await authUserExists(users.unconfirmedOld.id)).toBe(true)
    expect(await auditRowExists(auditIds.old)).toBe(true)
  })
})

describe('retention_run (scoped to this file)', () => {
  it('a dry run reports what would go and changes nothing, writing no audit', async () => {
    const before = await getRow(users.formerOld.id)
    expect(await run(true)).toEqual({
      dry_run: true,
      members_purged: 3, // formerOld, formerAtDate, formerAnonymised
      unconfirmed_deleted: 1,
      audit_entries_deleted: 1,
    })
    expect(await getRow(users.formerOld.id)).toEqual(before)
    expect(await authUserExists(users.formerOld.id)).toBe(true)
    expect(await authUserExists(users.unconfirmedOld.id)).toBe(true)
    expect(await auditRowExists(auditIds.old)).toBe(true)
    expect(await entries('member.purge')).toHaveLength(0)
    expect(await entries('account.purge_unconfirmed')).toHaveLength(0)
  })

  it('applies: purges, deletes old unconfirmed sign-ups and old audit rows', async () => {
    expect(await run(false)).toEqual({
      dry_run: false,
      members_purged: 3,
      unconfirmed_deleted: 1,
      audit_entries_deleted: 1,
    })
  })

  it('keeps the stub the spec keeps and clears the rest of a purged member (§4.5)', async () => {
    const row = await getRow(users.formerOld.id)
    expect(row).toMatchObject({
      member_number: users.formerOld.member_number,
      first_name: '',
      last_name: '',
      dni_nie_encrypted: null,
      leave_reason: null,
      left_on: '2022-01-01',
      left_by: 'board', // kept with left_on (members_left_on_left_by_pair)
      membership_start_date: '2015-03-01',
      current_joined_on: '2019-05-01',
      badges: 0,
    })
    expect(row.purged_at).not.toBeNull()
    // the login account and its e-mail are gone
    expect(await authUserExists(users.formerOld.id)).toBe(false)
  })

  it('writes one member.purge entry per purged member, from the system, without personal data', async () => {
    const [entry, ...rest] = await entries('member.purge', users.formerOld.id)
    expect(rest).toHaveLength(0)
    expect(entry).toEqual({
      actor_id: null,
      target_member_number: users.formerOld.member_number,
      details: { left_on: '2022-01-01', purge_on: '2025-01-01', badges_deleted: 2, account_deleted: true },
    })
    expect(JSON.stringify(entry.details)).not.toMatch(/Antiga|Retqzv|Motiu|v2:/)

    const [anon] = await entries('member.purge', users.formerAnonymised.id)
    expect(anon.details).toMatchObject({ account_deleted: false, badges_deleted: 0 })
    expect((await getRow(users.formerAnonymised.id)).purged_at).not.toBeNull()
    expect(await entries('member.purge', users.formerAtDate.id)).toHaveLength(1)
  })

  it('leaves former members before their purge date, purged stubs and active members alone', async () => {
    for (const key of ['formerDayBefore', 'formerRecent', 'active']) {
      const row = await getRow(users[key].id)
      expect(row.purged_at).toBeNull()
      expect(row.first_name).not.toBe('')
      expect(await authUserExists(users[key].id)).toBe(true)
      expect(await entries('member.purge', users[key].id)).toHaveLength(0)
    }
    expect(await entries('member.purge', users.alreadyPurged.id)).toHaveLength(0)
  })

  it('deletes unconfirmed sign-ups older than 30 days only, with one aggregate entry', async () => {
    expect(await authUserExists(users.unconfirmedOld.id)).toBe(false)
    expect(await sql('select 1 from public.members where id = $1::uuid', [users.unconfirmedOld.id])).toHaveLength(0)
    expect(await authUserExists(users.unconfirmedYoung.id)).toBe(true)
    expect(await authUserExists(users.confirmedOld.id)).toBe(true)

    const purges = await entries('account.purge_unconfirmed')
    expect(purges).toEqual([{ actor_id: null, target_member_number: null, details: { accounts_deleted: 1 } }])
  })

  it('deletes audit entries older than 3 years and keeps recent ones', async () => {
    expect(await auditRowExists(auditIds.old)).toBe(false)
    expect(await auditRowExists(auditIds.recent)).toBe(true)
  })

  it('a second run finds nothing left and writes no entry', async () => {
    expect(await run(false)).toEqual({
      dry_run: false,
      members_purged: 0,
      unconfirmed_deleted: 0,
      audit_entries_deleted: 0,
    })
    expect(await entries('member.purge', users.formerOld.id)).toHaveLength(1)
    expect(await entries('account.purge_unconfirmed')).toHaveLength(1)
  })
})
