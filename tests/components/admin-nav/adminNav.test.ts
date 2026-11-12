import { describe, it, expect } from 'vitest'
import { activeAdminSection, visibleAdminNav } from '@/components/admin/nav/adminNav'

const shape = (isSuperadmin: boolean) =>
  visibleAdminNav(isSuperadmin).map((g) => [g.key, g.sections.map((s) => s.key)])

describe('visibleAdminNav', () => {
  it('groups the sections for a board member, without Rols, help last', () => {
    expect(shape(false)).toEqual([
      ['main', ['overview']],
      ['board', ['members', 'activity']],
      ['content', ['badges', 'benefits']],
      ['maintenance', ['tools']],
      ['help', ['procedures']],
    ])
  })

  it('adds Rols to the Junta group for a superadmin', () => {
    expect(shape(true)[1]).toEqual(['board', ['members', 'activity', 'roles']])
    const roles = visibleAdminNav(true)[1].sections[2]
    expect(roles.superadminOnly).toBe(true)
    expect(roles.href).toBe('/admin/roles')
  })

  it('labels only the Junta, content and maintenance groups', () => {
    expect(visibleAdminNav(true).map((g) => [g.key, g.labeled])).toEqual([
      ['main', false],
      ['board', true],
      ['content', true],
      ['maintenance', true],
      ['help', false],
    ])
  })

  it('gives every section a path under /admin and an icon', () => {
    for (const group of visibleAdminNav(true)) {
      for (const section of group.sections) {
        expect(section.href === '/admin' || section.href.startsWith('/admin/')).toBe(true)
        expect(typeof section.icon).toBe('function')
      }
    }
  })
})

describe('activeAdminSection', () => {
  it.each([
    ['/admin', 'overview'],
    ['/admin/members', 'members'],
    ['/admin/members/000-012', 'members'],
    ['/admin/activity', 'activity'],
    ['/admin/roles', 'roles'],
    ['/admin/badges/first_game', 'badges'],
    ['/admin/benefits', 'benefits'],
    ['/admin/tools/event-images', 'tools'],
    ['/admin/procedures', 'procedures'],
  ])('%s belongs to %s', (pathname, key) => {
    expect(activeAdminSection(pathname)).toBe(key)
  })

  it('returns null outside the known sections (no prefix match on /admin itself)', () => {
    expect(activeAdminSection('/admin/unknown')).toBeNull()
    expect(activeAdminSection('/admin/membersx')).toBeNull()
    expect(activeAdminSection('/profile')).toBeNull()
  })
})
