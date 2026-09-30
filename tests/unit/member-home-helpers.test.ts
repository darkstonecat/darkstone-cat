import { describe, it, expect } from 'vitest'
import { buildProfileChecklist } from '@/lib/profile/completion'
import { buildBadgeItems } from '@/lib/member-home/badge-items'

const complete = {
  dni_nie_encrypted: 'enc',
  phone_encrypted: 'enc',
  postal_code: '08221',
  ludoya_username: 'someone',
  bgg_username: 'someone',
}

describe('buildProfileChecklist', () => {
  it('marks everything done for a complete, verified member', () => {
    const steps = buildProfileChecklist({ emailConfirmed: true, member: complete })
    expect(steps.map((s) => [s.key, s.done])).toEqual([
      ['account', true],
      ['data', true],
      ['ludoya', true],
      ['bgg', true],
    ])
  })

  it('uses email_confirmed_at for the account step', () => {
    const steps = buildProfileChecklist({ emailConfirmed: false, member: complete })
    expect(steps[0]).toMatchObject({ key: 'account', done: false })
  })

  it.each([
    ['dni_nie_encrypted', null],
    ['phone_encrypted', ''],
    ['postal_code', '   '],
  ] as const)('needs DNI, phone and postal code for the data step (%s missing)', (field, value) => {
    const steps = buildProfileChecklist({ emailConfirmed: true, member: { ...complete, [field]: value } })
    expect(steps.find((s) => s.key === 'data')?.done).toBe(false)
  })

  it('reads the Ludoya and BGG usernames', () => {
    const steps = buildProfileChecklist({
      emailConfirmed: true,
      member: { ...complete, ludoya_username: null, bgg_username: ' ' },
    })
    expect(steps.find((s) => s.key === 'ludoya')?.done).toBe(false)
    expect(steps.find((s) => s.key === 'bgg')?.done).toBe(false)
  })

  it('points each step to where it is fixed', () => {
    const steps = buildProfileChecklist({ emailConfirmed: false, member: complete })
    expect(Object.fromEntries(steps.map((s) => [s.key, s.href]))).toEqual({
      account: '/profile/details#account-title',
      data: '/profile/edit',
      ludoya: '/profile/details#gaming-title',
      bgg: '/profile/details#gaming-title',
    })
  })
})

describe('buildBadgeItems', () => {
  it('lists the whole catalogue with unearned badges locked', () => {
    const items = buildBadgeItems([{ key: 'member_year', year: 2024, awardedAt: '2024-03-02' }], 'ca')
    expect(items.map((i) => [i.key, i.earned])).toEqual([
      ['member_year', true],
      ['volunteer_egara_joga', false],
      ['ludoteca_donor', false],
    ])
    expect(items[0]).toMatchObject({ year: 2024, sinceLabel: '2/3/2024' })
  })

  it('marks stored badges as earned', () => {
    const items = buildBadgeItems([
      { key: 'member_year', year: 2024, awardedAt: '2024-03-02' },
      { key: 'ludoteca_donor', awardedAt: '2025-01-01T00:00:00Z' },
    ], 'ca')
    expect(items.find((i) => i.key === 'ludoteca_donor')?.earned).toBe(true)
    expect(items.find((i) => i.key === 'volunteer_egara_joga')?.earned).toBe(false)
  })

  it('is empty-safe: no badges means everything locked', () => {
    const items = buildBadgeItems([], 'ca')
    expect(items).toHaveLength(3)
    expect(items.every((i) => !i.earned && i.year === null)).toBe(true)
  })
})
