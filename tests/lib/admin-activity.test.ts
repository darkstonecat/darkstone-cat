import { describe, it, expect } from 'vitest'
import {
  ACTION_FILTERS,
  ACTIVITY_PAGE_SIZE,
  EMPTY_ACTIVITY_QUERY,
  buildActivityHref,
  hasActivityFilters,
  madridDayStart,
  parseActivityParams,
  parseDay,
  toActivityArgs,
} from '@/lib/admin/activity'
import { AUDIT_ACTIONS } from '@/lib/admin/audit-format'

const UUID = '3f2b8c1e-5d4a-4e7b-9a10-0c2d3e4f5a6b'

describe('parseActivityParams', () => {
  it('defaults to no filter', () => {
    expect(parseActivityParams({})).toEqual(EMPTY_ACTIVITY_QUERY)
  })

  it('keeps valid values and takes the first of repeated ones', () => {
    expect(
      parseActivityParams({
        action: ['badge.*', 'role.*'],
        actor: UUID.toUpperCase(),
        target: ' 000-203 ',
        from: '2026-09-05',
        to: '2026-10-05',
        before: '9007',
      })
    ).toEqual({ action: 'badge.*', actor: UUID, target: '000-203', from: '2026-09-05', to: '2026-10-05', before: 9007 })
  })

  it('accepts exactly the 18 keys and the 2 groups', () => {
    for (const action of [...AUDIT_ACTIONS, 'badge.*', 'role.*']) {
      expect(parseActivityParams({ action }).action).toBe(action)
    }
    for (const action of ['made.up', 'badge.', '*', 'member.%', "member.update' or 1=1", '__proto__', '']) {
      expect(parseActivityParams({ action }).action).toBeNull()
    }
  })

  it('offers 16 filter options, all accepted by the sanitiser', () => {
    expect(ACTION_FILTERS).toHaveLength(16)
    for (const action of ACTION_FILTERS) expect(parseActivityParams({ action }).action).toBe(action)
    // Every one of the 18 keys is reachable from some option.
    const covered = AUDIT_ACTIONS.filter((key) => ACTION_FILTERS.some((o) => o === key || (o.endsWith('.*') && key.startsWith(o.slice(0, -1)))))
    expect(covered).toHaveLength(18)
  })

  it('accepts the actor kinds and UUIDs only', () => {
    expect(parseActivityParams({ actor: 'system' }).actor).toBe('system')
    expect(parseActivityParams({ actor: 'self' }).actor).toBe('self')
    for (const actor of ['everyone', 'SYSTEM', UUID + 'x', '1; drop table', '']) {
      expect(parseActivityParams({ actor }).actor).toBeNull()
    }
  })

  it('accepts member numbers in the file format only', () => {
    expect(parseActivityParams({ target: '000-203' }).target).toBe('000-203')
    for (const target of ['000/203', 'a'.repeat(33), '000 203', '%', '../x', '']) {
      expect(parseActivityParams({ target }).target).toBeNull()
    }
  })

  it('accepts real calendar days only and swaps a reversed range', () => {
    expect(parseDay('2026-02-28')).toBe('2026-02-28')
    for (const day of ['2026-02-30', '2026-13-01', '26-10-05', '2026/10/05', '1999-12-31', '2101-01-01', '2026-10-05T00:00', undefined]) {
      expect(parseDay(day)).toBeNull()
    }
    expect(parseActivityParams({ from: '2026-10-05', to: '2026-09-05' })).toMatchObject({ from: '2026-09-05', to: '2026-10-05' })
  })

  it('accepts a positive integer cursor only', () => {
    for (const before of ['0', '-1', '1.5', 'abc', '1e3', '9'.repeat(16), '']) {
      expect(parseActivityParams({ before }).before).toBeNull()
    }
    expect(parseActivityParams({ before: '123456789012345' }).before).toBe(123456789012345)
  })
})

describe('madridDayStart', () => {
  it('is local midnight in summer and winter', () => {
    expect(madridDayStart('2026-10-05')).toBe('2026-10-04T22:00:00.000Z')
    expect(madridDayStart('2026-01-15')).toBe('2026-01-14T23:00:00.000Z')
  })

  it('stays correct on the days the clocks change', () => {
    expect(madridDayStart('2026-03-29')).toBe('2026-03-28T23:00:00.000Z')
    expect(madridDayStart('2026-03-30')).toBe('2026-03-29T22:00:00.000Z')
    expect(madridDayStart('2026-10-25')).toBe('2026-10-24T22:00:00.000Z')
    expect(madridDayStart('2026-10-26')).toBe('2026-10-25T23:00:00.000Z')
  })

  it('moves by whole days', () => {
    expect(madridDayStart('2026-10-05', 1)).toBe(madridDayStart('2026-10-06'))
    expect(madridDayStart('2026-12-31', 1)).toBe(madridDayStart('2027-01-01'))
  })
})

describe('toActivityArgs', () => {
  it('asks for one extra row to know whether another page exists', () => {
    expect(toActivityArgs(EMPTY_ACTIVITY_QUERY)).toEqual({
      p_action: null,
      p_actor: null,
      p_actor_kind: null,
      p_target_number: null,
      p_from: null,
      p_to: null,
      p_limit: ACTIVITY_PAGE_SIZE + 1,
      p_before_id: null,
    })
  })

  it('maps actor kinds, a UUID, the member number, the half-open date range and the cursor', () => {
    expect(toActivityArgs({ ...EMPTY_ACTIVITY_QUERY, actor: 'system' })).toMatchObject({ p_actor: null, p_actor_kind: 'system' })
    expect(toActivityArgs({ ...EMPTY_ACTIVITY_QUERY, actor: 'self' })).toMatchObject({ p_actor_kind: 'self' })
    expect(toActivityArgs({ ...EMPTY_ACTIVITY_QUERY, actor: UUID })).toMatchObject({ p_actor: UUID, p_actor_kind: null })
    expect(
      toActivityArgs({ action: 'role.*', actor: null, target: '000-203', from: '2026-10-01', to: '2026-10-05', before: 77 })
    ).toMatchObject({
      p_action: 'role.*',
      p_target_number: '000-203',
      p_from: '2026-09-30T22:00:00.000Z',
      // Fins a 5/10 is inclusive: the range ends at the start of the 6th.
      p_to: '2026-10-05T22:00:00.000Z',
      p_before_id: 77,
    })
  })
})

describe('buildActivityHref', () => {
  it('leaves empty filters out', () => {
    expect(buildActivityHref(EMPTY_ACTIVITY_QUERY)).toBe('/admin/activity')
    expect(buildActivityHref({ ...EMPTY_ACTIVITY_QUERY, target: '000-203', before: 5 })).toBe('/admin/activity?target=000-203&before=5')
  })

  it('applies overrides and encodes values', () => {
    const base = { ...EMPTY_ACTIVITY_QUERY, action: 'badge.*', before: 40 }
    expect(buildActivityHref(base, { before: null })).toBe('/admin/activity?action=badge.*')
    expect(buildActivityHref(base, { before: 12 })).toBe('/admin/activity?action=badge.*&before=12')
  })

  it('round-trips through the sanitiser', () => {
    const query = { action: 'export.emails', actor: UUID, target: '000-203', from: '2026-09-05', to: '2026-10-05', before: 9 }
    const href = buildActivityHref(query)
    expect(parseActivityParams(Object.fromEntries(new URL(href, 'http://x').searchParams))).toEqual(query)
  })
})

describe('hasActivityFilters', () => {
  it('ignores the cursor', () => {
    expect(hasActivityFilters(EMPTY_ACTIVITY_QUERY)).toBe(false)
    expect(hasActivityFilters({ ...EMPTY_ACTIVITY_QUERY, before: 3 })).toBe(false)
    expect(hasActivityFilters({ ...EMPTY_ACTIVITY_QUERY, from: '2026-10-01' })).toBe(true)
  })
})
