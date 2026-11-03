import { describe, it, expect } from 'vitest'
import { buildProfileChecklist } from '@/lib/profile/completion'
import { buildBadgeItems } from '@/lib/member-home/badge-items'
import type { CatalogueBadge } from '@/lib/badges/catalogue'

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

const catalogue: CatalogueBadge[] = [
  {
    key: 'volunteer_egara_joga',
    name: { ca: 'Voluntariat Egara Juga', es: 'Voluntariado Egara Juga' },
    earnedText: { ca: 'Ha col·laborat.', es: 'Ha colaborado.' },
    lockedText: { ca: 'Col·labora.' },
    icon: 'how_to_reg',
    sortOrder: 10,
    showLocked: true,
  },
  {
    key: 'ludoteca_donor',
    name: { ca: 'Donant de la ludoteca' },
    earnedText: { ca: 'Ha donat un joc.' },
    lockedText: { ca: 'Dona un joc.' },
    icon: 'gift',
    sortOrder: 20,
    showLocked: true,
  },
  {
    key: 'secret_quest',
    name: { ca: 'Missió secreta' },
    earnedText: { ca: 'Has trobat la missió.' },
    lockedText: { ca: 'No es mostra.' },
    icon: 'puzzle',
    sortOrder: 30,
    showLocked: false,
  },
]

describe('buildBadgeItems', () => {
  it('lists tenure first, then the catalogue in its order, unearned badges locked', () => {
    const items = buildBadgeItems([{ key: 'member_tenure', years: 2, since: '2024-03-02' }], catalogue, 'ca')
    expect(items.map((i) => [i.key, i.earned])).toEqual([
      ['member_tenure', true],
      ['volunteer_egara_joga', false],
      ['ludoteca_donor', false],
    ])
    expect(items[0]).toMatchObject({ kind: 'tenure', icon: 'star', years: 2, sinceLabel: '2/3/2024' })
  })

  it('resolves names and texts in the locale, falling back to Catalan', () => {
    const items = buildBadgeItems([{ key: 'volunteer_egara_joga', awardedAt: '2025-01-01T00:00:00Z' }], catalogue, 'es')
    expect(items.find((i) => i.key === 'volunteer_egara_joga')).toEqual({
      kind: 'catalogue',
      key: 'volunteer_egara_joga',
      icon: 'how_to_reg',
      earned: true,
      title: 'Voluntariado Egara Juga',
      description: 'Ha colaborado.',
    })
    expect(items.find((i) => i.key === 'ludoteca_donor')).toMatchObject({
      earned: false,
      title: 'Donant de la ludoteca',
      description: 'Dona un joc.',
    })
  })

  it('hides a badge with show_locked off until the member earns it', () => {
    expect(buildBadgeItems([], catalogue, 'ca').map((i) => i.key)).not.toContain('secret_quest')
    const earned = buildBadgeItems([{ key: 'secret_quest', awardedAt: '2025-01-01T00:00:00Z' }], catalogue, 'ca')
    expect(earned.find((i) => i.key === 'secret_quest')).toMatchObject({ earned: true, title: 'Missió secreta' })
  })

  it('drops stored badges missing from the catalogue (archived or unknown)', () => {
    const items = buildBadgeItems([{ key: 'archived_one', awardedAt: '2025-01-01T00:00:00Z' }], catalogue, 'ca')
    expect(items.map((i) => i.key)).toEqual(['member_tenure', 'volunteer_egara_joga', 'ludoteca_donor'])
  })

  it('is empty-safe: no badges means everything locked, tenure included', () => {
    const items = buildBadgeItems([], catalogue, 'ca')
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ kind: 'tenure', earned: false, years: null, sinceLabel: null })
    expect(items.every((i) => !i.earned)).toBe(true)
    expect(buildBadgeItems([], [], 'ca').map((i) => i.key)).toEqual(['member_tenure'])
  })
})
