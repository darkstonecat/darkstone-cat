import { describe, it, expect } from 'vitest'
import { buildMemberBadges } from '@/lib/supabase/badges'

const TODAY = '2026-11-03'

describe('buildMemberBadges', () => {
  it('derives "member_tenure" from the current sign-up once a full year has passed', () => {
    expect(buildMemberBadges('2023-05-14', [], TODAY)).toEqual([
      { key: 'member_tenure', years: 3, since: '2023-05-14' },
    ])
  })

  it('omits the tenure badge during the first year', () => {
    expect(buildMemberBadges('2026-09-14', [], TODAY)).toEqual([])
    expect(buildMemberBadges('2025-11-04', [], TODAY)).toEqual([])
  })

  it('omits the tenure badge when there is no valid sign-up date', () => {
    expect(buildMemberBadges(null, [], TODAY)).toEqual([])
    expect(buildMemberBadges('garbage', [], TODAY)).toEqual([])
  })

  it('appends stored badges after the derived one, ordered by award date', () => {
    const badges = buildMemberBadges('2024-01-10', [
      { badge_key: 'ludoteca_donor', awarded_at: '2025-06-01T10:00:00Z' },
      { badge_key: 'volunteer_egara_joga', awarded_at: '2024-09-01T10:00:00Z' },
    ], TODAY)
    expect(badges.map((b) => b.key)).toEqual([
      'member_tenure',
      'volunteer_egara_joga',
      'ludoteca_donor',
    ])
  })

  it('keeps every stored key: the catalogue decides later what is shown', () => {
    const badges = buildMemberBadges('2024-01-10', [
      { badge_key: 'brand_new', awarded_at: '2025-01-01T00:00:00Z' },
    ], TODAY)
    expect(badges.map((b) => b.key)).toEqual(['member_tenure', 'brand_new'])
  })
})
