import { describe, it, expect } from 'vitest'
import { addDays, leaveDateBounds, madridToday } from '@/lib/admin/leave-dates'

describe('madridToday', () => {
  it('uses the Madrid calendar day, not UTC', () => {
    // 22:30 UTC on 4 Oct is already 5 Oct in Madrid (UTC+2 in summer time).
    expect(madridToday(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
    expect(madridToday(new Date('2026-10-04T12:00:00Z'))).toBe('2026-10-04')
  })
})

describe('addDays', () => {
  it('shifts across month and year ends', () => {
    expect(addDays('2026-10-05', -365)).toBe('2025-10-05')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('leaveDateBounds', () => {
  it('is today at most and 365 days back at least', () => {
    expect(leaveDateBounds('2020-01-01', '2026-10-05')).toEqual({ min: '2025-10-05', max: '2026-10-05' })
  })
  it('never starts before the current alta', () => {
    expect(leaveDateBounds('2026-09-14', '2026-10-05')).toEqual({ min: '2026-09-14', max: '2026-10-05' })
    expect(leaveDateBounds('2026-09-14T08:00:00Z', '2026-10-05').min).toBe('2026-09-14')
  })
  it('ignores a missing or malformed alta', () => {
    expect(leaveDateBounds(null, '2026-10-05').min).toBe('2025-10-05')
    expect(leaveDateBounds('nope', '2026-10-05').min).toBe('2025-10-05')
  })
})
