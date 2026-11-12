import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261005100200_audit_log.sql: the append-only audit log (spec §5, BR-14, BR-15),
// the internal audit_write() and log_admin_event_for() (service role only, since
// 20261112110000) for the events the app logs itself.
//
// Entries cannot be deleted (that is the point), so they stay in the local database after the
// run. Every assertion filters by this file's own target members; never count the whole table.
// The superadmin cases live in roles.test.ts: it is the only file that may create superadmins
// (it asserts the global superadmin count).

const password = 'password123'
const emails = {
  member: 'audit-member@test.local',
  board: 'audit-board@test.local',
  legacy: 'audit-legacy-admin@test.local',
  target: 'audit-target@test.local',
  former: 'audit-former@test.local',
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string; member_number: string }>
const clients = {} as Record<'member' | 'board' | 'legacy', SupabaseClient>
const userIds: string[] = []

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

// log_admin_event_for() (20261112110000_audit_server_events.sql): service role only, the actor
// verified by the server action and passed in.
async function logEvent(
  client: SupabaseClient,
  actor: string | null,
  action: string,
  target: string | null,
  details: unknown = {}
) {
  return client.rpc('log_admin_event_for', {
    p_actor: actor,
    p_action: action,
    p_target: target,
    p_details: details,
  })
}

const REFRESH = { jobs: ['ludoya', 'bgg'], ok: true }

async function entry(id: number) {
  const { data, error } = await supabaseAdmin.from('audit_log').select('*').eq('id', id).single()
  expect(error).toBeNull()
  return data!
}

// One entry written by the board member, read back by several tests.
let boardEntryId: number

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    const user = await createTestUser(emails[key], password, { first_name: key, last_name: 'Audit' })
    const { data } = await supabaseAdmin.from('members').select('member_number').eq('id', user.id).single()
    users[key] = { id: user.id, member_number: data!.member_number }
    userIds.push(user.id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.legacy.id)).error).toBeNull()
  expect(
    (
      await supabaseAdmin
        .from('members')
        .update({ left_on: '2026-10-01', left_by: 'self' })
        .eq('id', users.former.id)
    ).error
  ).toBeNull()

  clients.member = await createAuthenticatedClient(emails.member, password)
  clients.board = await createAuthenticatedClient(emails.board, password)
  clients.legacy = await createAuthenticatedClient(emails.legacy, password)

  const { data, error } = await logEvent(supabaseAdmin, users.board.id, 'member.send_access_link', users.target.id)
  expect(error).toBeNull()
  boardEntryId = data as number
})

afterAll(() => cleanupUsers(userIds))

describe('log_admin_event_for()', () => {
  it('records a whitelisted event and snapshots actor and target', async () => {
    const row = await entry(boardEntryId)
    expect(row).toMatchObject({
      action: 'member.send_access_link',
      actor_id: users.board.id,
      actor_role: 'board',
      actor_member_number: users.board.member_number,
      target_member_id: users.target.id,
      target_member_number: users.target.member_number,
      details: {},
      reason: null,
    })
    expect(Date.now() - new Date(row.created_at).getTime()).toBeLessThan(60_000)
  })

  it('accepts a second board member, recording the role held at that moment', async () => {
    const { data, error } = await logEvent(supabaseAdmin, users.legacy.id, 'member.send_access_link', users.target.id)
    expect(error).toBeNull()
    expect(await entry(data as number)).toMatchObject({ actor_id: users.legacy.id, actor_role: 'board' })
  })

  it.each([
    [{ jobs: ['ludoya'], ok: true }],
    [{ jobs: ['bgg'], ok: false }],
    [{ jobs: ['ludoya', 'bgg'], ok: true }],
  ])('records a cache refresh with details %j', async (details) => {
    const { data, error } = await logEvent(supabaseAdmin, users.board.id, 'ops.cache_refresh', null, details)
    expect(error).toBeNull()
    expect(await entry(data as number)).toMatchObject({
      action: 'ops.cache_refresh',
      actor_id: users.board.id,
      target_member_id: null,
      details,
      reason: null,
    })
  })

  it('no session can call it, not even board (only the server writes these entries)', async () => {
    for (const client of [clients.board, clients.legacy, clients.member, anon]) {
      const { data, error } = await logEvent(client, users.board.id, 'member.send_access_link', users.target.id)
      expect(error?.code).toBe('42501')
      expect(data).toBeNull()
    }
  })

  it('log_admin_event() is gone (20261112110100_drop_log_admin_event.sql)', async () => {
    const { error } = await clients.board.rpc('log_admin_event', {
      p_action: 'ops.cache_refresh',
      p_target: null,
      p_details: REFRESH,
      p_reason: null,
    })
    expect(error?.code).toBe('PGRST202')
  })

  it('refuses an actor who is not an active board member', async () => {
    const unknownId = '00000000-0000-0000-0000-000000000000'
    for (const actor of [null, unknownId, users.member.id, users.former.id]) {
      const { error } = await logEvent(supabaseAdmin, actor, 'ops.cache_refresh', null, REFRESH)
      expect(error?.code, String(actor)).toBe('42501')
      expect(error?.message).toContain('audit:forbidden')
    }
  })

  it('rejects the actions that only database functions may write, and unknown keys', async () => {
    for (const action of [
      'member.update', 'member.reveal_sensitive', 'membership.leave', 'role.grant', 'member.purge', 'badge.award',
      'export.members_csv', 'export.member_data', 'export.emails', 'export.member_register', 'member.delete',
    ]) {
      const { error } = await logEvent(supabaseAdmin, users.board.id, action, users.target.id)
      expect(error?.code, action).toBe('22023')
      expect(error?.message, action).toContain('audit:action_not_allowed')
    }
  })

  it('requires a target where the event has one, and none where it has not', async () => {
    const missing = await logEvent(supabaseAdmin, users.board.id, 'member.send_access_link', null)
    expect(missing.error?.message).toContain('audit:invalid_target')

    const unknown = await logEvent(
      supabaseAdmin, users.board.id, 'member.send_access_link', '00000000-0000-0000-0000-000000000000'
    )
    expect(unknown.error?.message).toContain('audit:invalid_target')

    const extra = await logEvent(supabaseAdmin, users.board.id, 'ops.cache_refresh', users.target.id, REFRESH)
    expect(extra.error?.message).toContain('audit:invalid_target')
  })

  it('sends an access link only to an active member', async () => {
    const { error } = await logEvent(supabaseAdmin, users.board.id, 'member.send_access_link', users.former.id)
    expect(error?.message).toContain('audit:invalid_target')
  })

  it('an access link entry takes no details', async () => {
    for (const details of [{ note: 'x' }, { field: 'dni' }, ['x']]) {
      const { error } = await logEvent(supabaseAdmin, users.board.id, 'member.send_access_link', users.target.id, details)
      expect(error?.code, JSON.stringify(details)).toBe('22023')
      expect(error?.message).toContain('audit:invalid_details')
    }
  })

  it.each([
    [['ludoya']],
    [{}],
    [{ jobs: ['ludoya'] }],
    [{ ok: true }],
    [{ jobs: [], ok: true }],
    [{ jobs: ['other'], ok: true }],
    [{ jobs: ['ludoya', 'ludoya'], ok: true }],
    [{ jobs: 'ludoya', ok: true }],
    [{ jobs: [1], ok: true }],
    [{ jobs: ['ludoya'], ok: 'true' }],
    [{ jobs: ['ludoya'], ok: true, result: 'ok' }],
  ])('a cache refresh entry refuses details %j', async (details) => {
    const { error } = await logEvent(supabaseAdmin, users.board.id, 'ops.cache_refresh', null, details)
    expect(error?.code).toBe('22023')
    expect(error?.message).toContain('audit:invalid_details')
  })
})

// audit_write() is internal (no API role can execute it); the table owner runs it here to check
// the rules every entry keeps, whatever function writes it.
async function writeAsOwner(details: Record<string, unknown>, reason: string | null = null) {
  return runSqlAsPostgres("SELECT public.audit_write('member.update', NULL, $1::jsonb, $2)", [
    JSON.stringify(details),
    reason,
  ])
}

describe('every entry', () => {
  it('never stores a DNI or phone value in the details (BR-15)', async () => {
    const leaks: Record<string, unknown>[] = [
      { field: 'dni', dni: '12345678Z' },
      { changes: { phone: { from: 'a', to: 'b' } } },
      { changes: [{ Phone_Encrypted: 'x' }] },
      { field: 'dni', value: '12345678Z' },
      { field: 'dni', value: 'X1234567L' },
      { field: 'phone', shown: '+34 612 345 678' },
    ]
    for (const details of leaks) {
      const { error } = await writeAsOwner(details)
      expect(error?.message, JSON.stringify(details)).toContain('audit:sensitive_details')
    }
  })

  it('a reason is capped at 1000 characters', async () => {
    const { error } = await writeAsOwner({}, 'x'.repeat(1001))
    expect(error?.message).toContain('audit_log_reason_length')
  })
})

describe('audit_write() is internal', () => {
  const args = { p_action: 'member.update', p_target: null, p_details: {}, p_reason: null }

  it('cannot be executed by anon, authenticated or the service role', async () => {
    for (const client of [anon, clients.board, clients.member, supabaseAdmin]) {
      const { error } = await client.rpc('audit_write', args)
      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('permission denied for function audit_write')
    }
  })
})

// Migration 20261112100000_audit_log_no_direct_read.sql: nobody reads the table through the API.
// The board reads it only through admin_list_activity, which drops the past names of an
// anonymised or purged member (spec 5.3); a direct read would return them.
describe('reading the audit log', () => {
  it.each(['board', 'legacy', 'member'] as const)('%s cannot read the table directly', async (key) => {
    const { data, error } = await clients[key].from('audit_log').select('id, action').eq('id', boardEntryId)
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })

  it('the board still reads the entry through admin_list_activity', async () => {
    const { data, error } = await clients.board.rpc('admin_list_activity', { p_target: users.target.id, p_limit: 200 })
    expect(error).toBeNull()
    expect((data as { id: number }[]).map((row) => row.id)).toContain(boardEntryId)
  })

  it('the service role still reads the table (cron, retention, the access link cooldown)', async () => {
    expect((await entry(boardEntryId)).action).toBe('member.send_access_link')
  })

  it('an anonymous client is refused', async () => {
    const { data, error } = await anon.from('audit_log').select('id').eq('id', boardEntryId)
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })
})

describe('append-only (BR-14)', () => {
  it('authenticated users cannot insert, update or delete entries, even board', async () => {
    const insert = await clients.board.from('audit_log').insert({ action: 'member.update', target_member_id: users.target.id })
    expect(insert.error?.code).toBe('42501')

    const update = await clients.board.from('audit_log').update({ reason: 'x' }).eq('id', boardEntryId)
    expect(update.error?.code).toBe('42501')

    const del = await clients.board.from('audit_log').delete().eq('id', boardEntryId)
    expect(del.error?.code).toBe('42501')

    expect((await entry(boardEntryId)).reason).toBeNull()
  })

  it('the service role cannot insert, update or delete entries directly', async () => {
    const insert = await supabaseAdmin.from('audit_log').insert({ action: 'member.update', target_member_id: users.target.id })
    expect(insert.error?.code).toBe('42501')

    const update = await supabaseAdmin.from('audit_log').update({ reason: 'x' }).eq('id', boardEntryId)
    expect(update.error?.code).toBe('42501')

    const del = await supabaseAdmin.from('audit_log').delete().eq('id', boardEntryId)
    expect(del.error?.code).toBe('42501')
  })

  it('the table owner cannot update an entry either (trigger)', async () => {
    const { error } = await runSqlAsPostgres("UPDATE public.audit_log SET reason = 'x' WHERE id = $1", [boardEntryId])
    expect(error?.message).toContain('audit:append_only')
    expect((await entry(boardEntryId)).reason).toBeNull()
  })

  it('the owner cannot delete an entry younger than 3 years', async () => {
    const { error } = await runSqlAsPostgres('DELETE FROM public.audit_log WHERE id = $1', [boardEntryId])
    expect(error?.message).toContain('audit:append_only')
    expect((await entry(boardEntryId)).id).toBe(boardEntryId)
  })

  it('the owner can delete an entry older than 3 years (retention, §5.3)', async () => {
    const { data, error } = await runSqlAsPostgres<{ id: number }>(
      `INSERT INTO public.audit_log (created_at, action, target_member_id)
       VALUES (now() - interval '3 years' - interval '1 day', 'member.purge', $1)
       RETURNING id`,
      [users.target.id]
    )
    expect(error).toBeNull()
    const oldId = Number(data![0].id)

    const del = await runSqlAsPostgres('DELETE FROM public.audit_log WHERE id = $1', [oldId])
    expect(del.error).toBeNull()

    const { data: left } = await supabaseAdmin.from('audit_log').select('id').eq('id', oldId)
    expect(left).toEqual([])
  })

  it('the owner cannot truncate the table', async () => {
    // Atomic: if TRUNCATE were not blocked, the RAISE rolls it back.
    const { error } = await runSqlAsPostgres(
      "DO $$ BEGIN TRUNCATE public.audit_log; RAISE EXCEPTION 'truncate was not blocked'; END $$"
    )
    expect(error?.message).toContain('audit:append_only')
  })
})
