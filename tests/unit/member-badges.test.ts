import { describe, it, expect } from 'vitest'
import { buildMemberBadges } from '@/lib/supabase/badges'

describe('buildMemberBadges', () => {
  it('derives "member_year" from membership_start_date', () => {
    expect(buildMemberBadges('2023-05-14', [])).toEqual([
      { key: 'member_year', year: 2023, awardedAt: '2023-05-14' },
    ])
  })

  it('omits the derived badge when there is no start date', () => {
    expect(buildMemberBadges(null, [])).toEqual([])
    expect(buildMemberBadges('garbage', [])).toEqual([])
  })

  it('appends stored badges after the derived one, ordered by award date', () => {
    const badges = buildMemberBadges('2024-01-10', [
      { badge_key: 'ludoteca_donor', awarded_at: '2025-06-01T10:00:00Z' },
      { badge_key: 'volunteer_egara_joga', awarded_at: '2024-09-01T10:00:00Z' },
    ])
    expect(badges.map((b) => b.key)).toEqual([
      'member_year',
      'volunteer_egara_joga',
      'ludoteca_donor',
    ])
  })

  it('ignores unknown stored keys', () => {
    const badges = buildMemberBadges('2024-01-10', [
      { badge_key: 'made_up', awarded_at: '2025-01-01T00:00:00Z' },
    ])
    expect(badges.map((b) => b.key)).toEqual(['member_year'])
  })
})
