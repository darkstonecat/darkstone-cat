import { describe, it, expect } from 'vitest'
import {
  ROLES,
  toRole,
  roleRank,
  hasRoleAtLeast,
  isBoardRole,
  isSuperadmin,
  roleLabelKey,
} from '@/lib/auth/roles'

// Mirrors public.role_rank() in supabase/migrations/20261005100100_roles_expand.sql.
describe('roleRank', () => {
  it.each([
    ['member', 0],
    ['board', 1],
    ['admin', 1],
    ['superadmin', 2],
  ])('ranks %s as %i', (role, rank) => {
    expect(roleRank(role)).toBe(rank)
  })

  it.each([['owner'], ['Admin'], [''], [null], [undefined], [1]])(
    'has no rank for %j',
    (role) => {
      expect(roleRank(role)).toBeNull()
    },
  )
})

describe('toRole', () => {
  it('accepts every known role', () => {
    for (const role of ROLES) expect(toRole(role)).toBe(role)
  })

  it('returns null for anything else', () => {
    expect(toRole('root')).toBeNull()
    expect(toRole(' board')).toBeNull()
    expect(toRole(null)).toBeNull()
    expect(toRole({ role: 'board' })).toBeNull()
  })
})

describe('hasRoleAtLeast', () => {
  const matrix: Array<[string, 'member' | 'board' | 'superadmin', boolean]> = [
    ['member', 'member', true],
    ['member', 'board', false],
    ['member', 'superadmin', false],
    ['board', 'member', true],
    ['board', 'board', true],
    ['board', 'superadmin', false],
    ['admin', 'board', true],
    ['admin', 'superadmin', false],
    ['superadmin', 'member', true],
    ['superadmin', 'board', true],
    ['superadmin', 'superadmin', true],
  ]

  it.each(matrix)('%s at least %s → %s', (role, min, expected) => {
    expect(hasRoleAtLeast(role, min)).toBe(expected)
  })

  it('never grants access to an unknown role', () => {
    expect(hasRoleAtLeast('owner', 'member')).toBe(false)
    expect(hasRoleAtLeast(null, 'member')).toBe(false)
    expect(hasRoleAtLeast(undefined, 'board')).toBe(false)
  })
})

describe('isBoardRole / isSuperadmin', () => {
  it('treats board, legacy admin and superadmin as board roles', () => {
    expect(isBoardRole('board')).toBe(true)
    expect(isBoardRole('admin')).toBe(true)
    expect(isBoardRole('superadmin')).toBe(true)
    expect(isBoardRole('member')).toBe(false)
    expect(isBoardRole(null)).toBe(false)
    expect(isBoardRole('owner')).toBe(false)
  })

  it('recognises only superadmin as superadmin', () => {
    expect(isSuperadmin('superadmin')).toBe(true)
    expect(isSuperadmin('board')).toBe(false)
    expect(isSuperadmin('admin')).toBe(false)
    expect(isSuperadmin(null)).toBe(false)
  })
})

describe('roleLabelKey', () => {
  it.each([
    ['member', 'role_member'],
    ['board', 'role_board'],
    ['admin', 'role_board'],
    ['superadmin', 'role_superadmin'],
    ['owner', 'role_member'],
    [null, 'role_member'],
  ])('labels %j as %s', (role, key) => {
    expect(roleLabelKey(role)).toBe(key)
  })
})
