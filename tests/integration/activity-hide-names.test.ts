import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261006100400_activity_hide_names.sql: admin_list_activity drops the past names of
// a member.update entry (`details.changes`) once the target is anonymised (spec 5.3).
// Anonymisation itself is superadmin only (roles-and-anonymise.test.ts); here the member is
// anonymised as `postgres`, because only the read function is under test.

const password = 'password123'
const DOMAIN = 'activity-names.test'
const emails = { board: `an-board@${DOMAIN}`, target: `an-target@${DOMAIN}` }
const ids: Record<'board' | 'target', string> = { board: '', target: '' }
const userIds: string[] = []
let board: SupabaseClient

const DETAILS = {
  fields: ['first_name'],
  changes: { first_name: { from: 'Oldname', to: 'Newname' } },
}

async function feed() {
  const { data, error } = await board.rpc('admin_list_activity', { p_target: ids.target })
  expect(error).toBeNull()
  return data as { action: string; target_name: string | null; details: Record<string, unknown> }[]
}

beforeAll(async () => {
  for (const key of ['board', 'target'] as const) {
    const user = await createTestUser(emails[key], password, { first_name: key, last_name: 'Names' })
    ids[key] = user.id
    userIds.push(user.id)
  }
  const promote = await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', ids.board)
  expect(promote.error).toBeNull()
  board = await createAuthenticatedClient(emails.board, password)

  const insert = await runSqlAsPostgres(
    `INSERT INTO public.audit_log (actor_id, actor_role, action, target_member_id, details)
     VALUES ($1, 'board', 'member.update', $2, $3::jsonb)`,
    [ids.board, ids.target, JSON.stringify(DETAILS)]
  )
  expect(insert.error).toBeNull()
})

afterAll(() => cleanupUsers(userIds))

describe('admin_list_activity and the names of an anonymised member', () => {
  it('returns the name change while the member is active', async () => {
    const rows = await feed()
    expect(rows).toHaveLength(1)
    expect(rows[0].target_name).toBe('target Names')
    expect(rows[0].details).toEqual(DETAILS)
  })

  it('drops `changes` (and the name) once the member is anonymised, keeping the other details', async () => {
    const left = await runSqlAsPostgres(
      `UPDATE public.members SET left_on = '2026-09-01', left_by = 'self' WHERE id = $1`,
      [ids.target]
    )
    expect(left.error).toBeNull()
    const anon = await runSqlAsPostgres(`UPDATE public.members SET anonymised_at = now() WHERE id = $1`, [ids.target])
    expect(anon.error).toBeNull()

    const rows = await feed()
    expect(rows).toHaveLength(1)
    expect(rows[0].target_name).toBeNull()
    expect(rows[0].details).toEqual({ fields: ['first_name'] })
    expect(JSON.stringify(rows)).not.toContain('Oldname')
    expect(JSON.stringify(rows)).not.toContain('Newname')
  })
})
