import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { formatCalendarDate } from '@/lib/format-date'

describe('formatCalendarDate', () => {
  it('formats day-first in every app locale', () => {
    expect(formatCalendarDate('2026-09-29', 'ca')).toBe('29/9/2026')
    expect(formatCalendarDate('2026-09-29', 'es')).toBe('29/9/2026')
    expect(formatCalendarDate('2026-09-29', 'en')).toBe('29/09/2026')
  })

  describe('in a timezone west of UTC', () => {
    const originalTz = process.env.TZ

    beforeAll(() => {
      process.env.TZ = 'America/New_York'
    })

    afterAll(() => {
      process.env.TZ = originalTz
    })

    it('keeps the stored calendar day instead of shifting to the previous one', () => {
      expect(formatCalendarDate('2026-01-01', 'ca')).toBe('1/1/2026')
    })
  })
})
