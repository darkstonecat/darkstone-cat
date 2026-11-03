import { describe, it, expect } from 'vitest'
import { tenureYears } from '@/lib/member-tenure'

describe('tenureYears', () => {
  it('counts full years since the current sign-up', () => {
    expect(tenureYears('2023-05-14', '2026-11-03')).toBe(3)
    expect(tenureYears('2020-01-01', '2026-12-31')).toBe(6)
  })

  it('goes up on the anniversary, not the day before', () => {
    expect(tenureYears('2024-11-03', '2025-11-02')).toBe(0)
    expect(tenureYears('2024-11-03', '2025-11-03')).toBe(1)
  })

  it('is 0 during the first year, including the sign-up day', () => {
    expect(tenureYears('2026-09-14', '2026-09-14')).toBe(0)
    expect(tenureYears('2026-09-14', '2026-11-03')).toBe(0)
  })

  it('moves a 29 February anniversary to 28 February in common years', () => {
    expect(tenureYears('2024-02-29', '2025-02-27')).toBe(0)
    expect(tenureYears('2024-02-29', '2025-02-28')).toBe(1)
    expect(tenureYears('2024-02-29', '2028-02-28')).toBe(3)
    expect(tenureYears('2024-02-29', '2028-02-29')).toBe(4)
  })

  it('never goes below 0 when the sign-up date is after the reference day', () => {
    expect(tenureYears('2027-01-01', '2026-11-03')).toBe(0)
  })

  it('returns null for a missing or malformed date', () => {
    expect(tenureYears(null, '2026-11-03')).toBeNull()
    expect(tenureYears('garbage', '2026-11-03')).toBeNull()
    expect(tenureYears('2026-02-30', '2026-11-03')).toBeNull()
    expect(tenureYears('2026-01-01', 'garbage')).toBeNull()
  })
})
