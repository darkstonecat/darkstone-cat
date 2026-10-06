import { describe, it, expect } from 'vitest'
import { parseOpsStatus } from '@/lib/admin/ops-status'

describe('parseOpsStatus', () => {
  it('returns null for anything that is not an array', () => {
    expect(parseOpsStatus(null)).toBeNull()
    expect(parseOpsStatus({})).toBeNull()
  })

  it('always returns ludoya then bgg, empty when missing, dropping unknown jobs', () => {
    const rows = parseOpsStatus([{ job: 'other', last_ok: true }])!
    expect(rows.map((r) => r.job)).toEqual(['ludoya', 'bgg'])
    expect(rows[0]).toMatchObject({ lastRunAt: null, lastOk: null, lastErrorCode: null })
  })

  it('maps a row and drops malformed fields', () => {
    const rows = parseOpsStatus([
      {
        job: 'bgg',
        last_run_at: '2026-10-05T16:00:00Z',
        last_ok: false,
        last_automatic: false,
        last_actor_member_number: '000-001',
        last_actor_name: 'Marta Puig',
        last_duration_ms: 30000,
        last_error_code: 'timeout',
        last_success_at: 'not a date',
      },
      { job: 'ludoya', last_error_code: 'Not a code', last_duration_ms: -5, last_ok: 'yes' },
    ])!
    expect(rows[1]).toMatchObject({
      job: 'bgg',
      lastOk: false,
      lastAutomatic: false,
      lastActorName: 'Marta Puig',
      lastActorNumber: '000-001',
      lastDurationMs: 30000,
      lastErrorCode: 'timeout',
      lastSuccessAt: null,
    })
    expect(rows[0]).toMatchObject({ lastErrorCode: null, lastDurationMs: null, lastOk: null })
  })
})
