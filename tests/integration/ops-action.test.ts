import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

// A-14 · refreshCaches against the real database with a real board SESSION client for the guard.
// Only `createClient` (the session), `revalidatePath` and the refresh runner (no Ludoya or BGG
// call) are mocked; the job names are the real ones, so this pins them against the shape
// log_admin_event_for() accepts (20261112110000_audit_server_events.sql).

const session = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/cache-refresh', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/cache-refresh')>()
  return {
    REFRESH_JOBS: real.REFRESH_JOBS,
    runRefreshJobs: async (jobs: { name: string }[]) =>
      jobs.map((job) => ({ name: job.name, ok: job.name !== 'bgg', durationMs: 5, errorCode: job.name === 'bgg' ? 'timeout' : undefined })),
  }
})

import { refreshCaches } from '@/lib/admin/ops-actions'

const password = 'password123'
const email = 'ops-action-board@ops-action.test'
let boardId: string

beforeAll(async () => {
  boardId = (await createTestUser(email, password, { first_name: 'Ops', last_name: 'Action' })).id
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', boardId)).error).toBeNull()
  session.client = await createAuthenticatedClient(email, password)
})

afterAll(() => cleanupUsers([boardId]))

describe('refreshCaches (A-14) · audit entry', () => {
  it('writes one ops.cache_refresh entry for the verified actor with every real job name', async () => {
    const result = await refreshCaches('all')
    expect(result).toMatchObject({ ok: true })

    const { data, error } = await supabaseAdmin
      .from('audit_log')
      .select('actor_id, actor_role, target_member_id, details, reason')
      .eq('actor_id', boardId)
      .eq('action', 'ops.cache_refresh')
    expect(error).toBeNull()
    expect(data).toEqual([
      { actor_id: boardId, actor_role: 'board', target_member_id: null, details: { jobs: ['ludoya', 'bgg'], ok: false }, reason: null },
    ])
  })
})
