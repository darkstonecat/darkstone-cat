import { describe, it, expect } from 'vitest'
import {
  DEFAULT_MEMBERS_QUERY,
  MEMBER_SORTS,
  buildMembersHref,
  formatAdminDate,
  nextSort,
  parseMembersParams,
  sanitizeSearch,
  sortDirectionOf,
  toListMembersArgs,
} from '@/lib/admin/members-list'

describe('parseMembersParams', () => {
  it('returns the defaults for no parameters', () => {
    expect(parseMembersParams({})).toEqual(DEFAULT_MEMBERS_QUERY)
    expect(DEFAULT_MEMBERS_QUERY).toEqual({ state: 'active', role: 'all', q: '', sort: 'number_asc', page: 1, pp: 12 })
  })

  it('accepts every whitelisted state, role and sort', () => {
    for (const state of ['active', 'former', 'all']) expect(parseMembersParams({ state }).state).toBe(state)
    for (const role of ['all', 'member', 'board', 'superadmin']) expect(parseMembersParams({ role }).role).toBe(role)
    expect(MEMBER_SORTS).toHaveLength(8)
    for (const sort of MEMBER_SORTS) expect(parseMembersParams({ sort }).sort).toBe(sort)
  })

  it.each([
    ['state', ['purged', 'ACTIVE', '', ' active', "active'; drop table members;--", 'all,former', '__proto__']],
    ['role', ['admin', 'owner', 'SUPERADMIN', '', "board' or '1'='1", '%']],
    ['sort', ['email_asc', 'number', 'number_up', 'name_asc; select 1', 'NAME_ASC', '', 'left_asc,name_desc']],
  ])('falls back to the default for an invalid %s', (key, values) => {
    for (const value of values) {
      expect(parseMembersParams({ [key]: value })[key as 'state' | 'role' | 'sort']).toBe(
        DEFAULT_MEMBERS_QUERY[key as 'state' | 'role' | 'sort'],
      )
    }
  })

  it('uses the first value of a repeated parameter and ignores the rest', () => {
    expect(parseMembersParams({ state: ['former', 'all'], role: ['bogus', 'board'] })).toMatchObject({
      state: 'former',
      role: 'all',
    })
    expect(parseMembersParams({ state: [] }).state).toBe('active')
  })

  it('accepts only plain positive integers for page', () => {
    expect(parseMembersParams({ page: '3' }).page).toBe(3)
    expect(parseMembersParams({ page: '0' }).page).toBe(1)
    for (const page of ['-1', '1.5', 'abc', '1e3', '0x10', ' 2', '2 ', '', '9999999', '١٢', 'NaN', 'Infinity']) {
      expect(parseMembersParams({ page }).page).toBe(1)
    }
    expect(parseMembersParams({ page: '100000' }).page).toBe(100000)
  })

  it('accepts only the whitelisted page sizes for pp', () => {
    for (const pp of [12, 24, 48, 96]) expect(parseMembersParams({ pp: String(pp) }).pp).toBe(pp)
    for (const pp of ['0', '1', '13', '200', '1000000', '-12', '12.5', 'all', '']) {
      expect(parseMembersParams({ pp }).pp).toBe(12)
    }
  })

  it('sanitises the search text', () => {
    expect(parseMembersParams({ q: '  Laia   Serra ' }).q).toBe('Laia Serra')
    expect(parseMembersParams({ q: 'a\u0000b\nc\td\u007fe' }).q).toBe('a b c d e')
    expect(parseMembersParams({ q: ['first', 'second'] }).q).toBe('first')
    expect(parseMembersParams({ q: '   ' }).q).toBe('')
  })
})

describe('sanitizeSearch', () => {
  it('keeps injection-looking text as inert text (the RPC treats % and _ literally)', () => {
    expect(sanitizeSearch("'; drop table members; --")).toBe("'; drop table members; --")
    expect(sanitizeSearch('%_\\')).toBe('%_\\')
    expect(sanitizeSearch('<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
  })

  it('caps the text at 100 characters without splitting a code point', () => {
    expect(sanitizeSearch('a'.repeat(250))).toHaveLength(100)
    const emoji = '😀'.repeat(150)
    const cut = sanitizeSearch(emoji)
    expect(Array.from(cut)).toHaveLength(100)
    expect(cut).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  })

  it('handles undefined and empty', () => {
    expect(sanitizeSearch(undefined)).toBe('')
    expect(sanitizeSearch('')).toBe('')
  })
})

describe('toListMembersArgs', () => {
  it('maps a query to the RPC arguments, with null for "all roles" and an empty search', () => {
    expect(toListMembersArgs(DEFAULT_MEMBERS_QUERY)).toEqual({
      p_state: 'active',
      p_role: null,
      p_q: null,
      p_sort: 'number_asc',
      p_limit: 12,
      p_offset: 0,
    })
    expect(
      toListMembersArgs({ state: 'former', role: 'board', q: 'laia', sort: 'name_desc', page: 3, pp: 24 }),
    ).toEqual({ p_state: 'former', p_role: 'board', p_q: 'laia', p_sort: 'name_desc', p_limit: 24, p_offset: 48 })
  })

  it('never produces a value the RPC rejects, whatever the URL says', () => {
    const q = parseMembersParams({ state: 'x', role: 'y', sort: 'z', page: '-4', pp: '9999', q: '\u0000' })
    expect(toListMembersArgs(q)).toEqual(toListMembersArgs(DEFAULT_MEMBERS_QUERY))
  })
})

describe('buildMembersHref and sorting helpers', () => {
  it('leaves defaults out and keeps the rest, URL-encoded', () => {
    expect(buildMembersHref(DEFAULT_MEMBERS_QUERY)).toBe('/admin/members')
    expect(
      buildMembersHref({ ...DEFAULT_MEMBERS_QUERY, state: 'former', role: 'board', q: 'a&b c', page: 2 }),
    ).toBe('/admin/members?state=former&role=board&q=a%26b+c&page=2')
    expect(buildMembersHref(DEFAULT_MEMBERS_QUERY, { sort: 'name_desc', pp: 24 })).toBe(
      '/admin/members?sort=name_desc&pp=24',
    )
  })

  it('round-trips through the parser', () => {
    const query = { state: 'all', role: 'superadmin', q: 'laia serra', sort: 'joined_desc', page: 4, pp: 48 } as const
    const url = new URL(buildMembersHref(query), 'http://x')
    expect(parseMembersParams(Object.fromEntries(url.searchParams))).toEqual(query)
  })

  it('toggles a column sort and reports aria-sort', () => {
    expect(nextSort('number_asc', 'number')).toBe('number_desc')
    expect(nextSort('number_desc', 'number')).toBe('number_asc')
    expect(nextSort('number_asc', 'name')).toBe('name_asc')
    expect(sortDirectionOf('name_desc', 'name')).toBe('descending')
    expect(sortDirectionOf('name_asc', 'name')).toBe('ascending')
    expect(sortDirectionOf('name_asc', 'joined')).toBe('none')
  })
})

describe('formatAdminDate', () => {
  it('formats ISO dates as d/m/yyyy and passes null through', () => {
    expect(formatAdminDate('2026-10-05')).toBe('5/10/2026')
    expect(formatAdminDate('2019-02-03T00:00:00+00:00')).toBe('3/2/2019')
    expect(formatAdminDate(null)).toBeNull()
    expect(formatAdminDate('nope')).toBeNull()
  })
})
