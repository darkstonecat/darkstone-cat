import { describe, it, expect } from 'vitest'
import { newsletterPercent, parseAdminStats, OVERVIEW_ACTIVITY_LIMIT } from '@/lib/admin/stats'

const row = {
  active_members: 168,
  former_members: 12,
  joined_this_month: 4,
  left_this_month: 1,
  left_this_month_self: 1,
  left_this_month_board: 0,
  rejoined_this_year: 2,
  newsletter_members: 97,
  board_members: 7,
  superadmins: 2,
}

describe('parseAdminStats', () => {
  it('takes the first row of the RPC answer', () => {
    expect(parseAdminStats([row])).toEqual(row)
    expect(parseAdminStats(row)).toEqual(row)
  })

  it.each([null, undefined, [], 'x', 3, [null], [{ ...row, active_members: '168' }], [{ ...row, superadmins: -1 }], [{ ...row, board_members: 1.5 }], [{ active_members: 1 }]])(
    'is null for an unusable answer %j',
    (data) => {
      expect(parseAdminStats(data)).toBeNull()
    }
  )

  it('drops fields it does not know', () => {
    expect(parseAdminStats([{ ...row, dni: '12345678Z' }])).toEqual(row)
  })
})

describe('newsletterPercent', () => {
  it('rounds the share of active members', () => {
    expect(newsletterPercent({ newsletter_members: 97, active_members: 168 })).toBe(58)
    expect(newsletterPercent({ newsletter_members: 1, active_members: 3 })).toBe(33)
  })

  it('is 0 with no active member', () => {
    expect(newsletterPercent({ newsletter_members: 0, active_members: 0 })).toBe(0)
  })
})

it('lists the last 10 entries on the dashboard (spec V-1)', () => {
  expect(OVERVIEW_ACTIVITY_LIMIT).toBe(10)
})
