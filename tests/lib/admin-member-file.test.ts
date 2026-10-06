import { describe, it, expect } from 'vitest'
import {
  activityKeyOf,
  backToListHref,
  formatAdminTimestamp,
  isValidMemberNumber,
  listParamFor,
  yearOf,
} from '@/lib/admin/member-file'
import { DEFAULT_MEMBERS_QUERY } from '@/lib/admin/members-list'

describe('isValidMemberNumber', () => {
  it.each(['000-203', 'A1', 'x-y-z', 'a'.repeat(32)])('accepts %s', (value) => {
    expect(isValidMemberNumber(value)).toBe(true)
  })

  it.each(['', 'a'.repeat(33), '000/203', '000 203', '../etc', '000-203%00', 'é', undefined, 42])(
    'rejects %s',
    (value) => {
      expect(isValidMemberNumber(value)).toBe(false)
    }
  )
})

describe('list query round trip', () => {
  it('leaves the default list as a plain link', () => {
    expect(listParamFor(DEFAULT_MEMBERS_QUERY)).toBe('')
    expect(backToListHref(undefined)).toBe('/admin/members')
    expect(backToListHref('')).toBe('/admin/members')
  })

  it('sends a filtered list back to the same view', () => {
    const param = listParamFor({ ...DEFAULT_MEMBERS_QUERY, state: 'former', q: 'laia', page: 2 })
    expect(backToListHref(param)).toBe('/admin/members?state=former&q=laia&page=2')
  })

  it('rebuilds the URL through the whitelist: unknown keys and values never survive', () => {
    expect(backToListHref('state=purged&role=owner&next=https://evil.example&q=x')).toBe('/admin/members?q=x')
    expect(backToListHref('https://evil.example/')).toBe('/admin/members')
    expect(backToListHref('q=' + 'a'.repeat(500))).toBe('/admin/members')
    expect(backToListHref(['sort=name_asc', 'sort=joined_desc'])).toBe('/admin/members?sort=name_asc')
  })
})

describe('display helpers', () => {
  it('maps known actions to a label key and leaves unknown ones null', () => {
    expect(activityKeyOf('membership.leave')).toBe('membership_leave')
    expect(activityKeyOf('export.member_data')).toBe('export_member_data')
    expect(activityKeyOf('made.up')).toBeNull()
    expect(activityKeyOf('__proto__')).toBeNull()
    expect(activityKeyOf('constructor')).toBeNull()
  })

  it('formats a timestamp as d/m/yyyy in Madrid time', () => {
    expect(formatAdminTimestamp('2026-10-05T07:15:00+00:00')).toBe('5/10/2026')
    // 23:30 UTC is already the next day in Madrid (summer time).
    expect(formatAdminTimestamp('2026-10-05T23:30:00Z')).toBe('6/10/2026')
    expect(formatAdminTimestamp(null)).toBeNull()
    expect(formatAdminTimestamp('not a date')).toBeNull()
  })

  it('reads the year of a date', () => {
    expect(yearOf('2021-03-12')).toBe(2021)
    expect(yearOf(null)).toBeNull()
  })
})
