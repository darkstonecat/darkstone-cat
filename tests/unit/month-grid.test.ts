import { describe, it, expect } from 'vitest'
import {
  buildCalendarView,
  buildMonthGrid,
  currentYearMonth,
  defaultSelectedDay,
  formatMonthTitle,
  isInRange,
  madridDayKey,
  monthRange,
  parseMonthParam,
  shiftMonth,
  weekdayLabels,
  type CalendarEvent,
} from '@/lib/member-home/month-grid'

const event = (id: string, startsAt: string, special = false): CalendarEvent => ({
  id,
  title: id,
  startsAt,
  special,
  placeName: null,
  ludoyaUrl: `https://ludoya.test/${id}`,
})

const NOW = new Date('2026-09-30T10:00:00Z')

describe('month navigation', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth({ year: 2026, month: 3 }, -3)).toEqual({ year: 2025, month: 12 })
  })

  it('uses the Madrid month at the end of a UTC month', () => {
    expect(currentYearMonth(new Date('2026-09-30T22:30:00Z'))).toEqual({ year: 2026, month: 10 })
  })

  it('browses 3 months back and 6 forward', () => {
    expect(monthRange(NOW)).toEqual({ first: { year: 2026, month: 6 }, last: { year: 2027, month: 3 } })
    expect(isInRange({ year: 2026, month: 5 }, NOW)).toBe(false)
    expect(isInRange({ year: 2027, month: 4 }, NOW)).toBe(false)
  })

  it('parses the month param and falls back to the current month', () => {
    expect(parseMonthParam('2026-10', NOW)).toEqual({ year: 2026, month: 10 })
    for (const bad of [undefined, '', '2026-13', '2026-00', '26-10', '2026-1', '2026-10-01', '2020-01', '2030-01', ['2026-10']]) {
      expect(parseMonthParam(bad as string, NOW)).toEqual({ year: 2026, month: 9 })
    }
  })
})

describe('buildMonthGrid', () => {
  it('starts weeks on Monday and pads with neighbouring days (September 2026 starts on a Tuesday)', () => {
    const weeks = buildMonthGrid({ year: 2026, month: 9 }, [], '2026-09-30')
    expect(weeks).toHaveLength(5)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weeks[0][0]).toMatchObject({ date: '2026-08-31', inMonth: false })
    expect(weeks[0][1]).toMatchObject({ date: '2026-09-01', inMonth: true })
    expect(weeks[4][2]).toMatchObject({ date: '2026-09-30', inMonth: true, isToday: true })
    expect(weeks[4][3]).toMatchObject({ date: '2026-10-01', inMonth: false })
  })

  it('handles a month that starts on a Sunday (queue of six leading days)', () => {
    // February 2026 starts on a Sunday and has 28 days: 6 leading + 28 = 34 cells, 5 weeks.
    const weeks = buildMonthGrid({ year: 2026, month: 2 }, [], '')
    expect(weeks[0][5]).toMatchObject({ date: '2026-01-31', inMonth: false })
    expect(weeks[0][6]).toMatchObject({ date: '2026-02-01', inMonth: true })
    expect(weeks).toHaveLength(5)
  })

  it('needs six weeks for a 31-day month starting on Sunday', () => {
    // March 2026 starts on a Sunday: 6 + 31 = 37 cells.
    expect(buildMonthGrid({ year: 2026, month: 3 }, [], '')).toHaveLength(6)
  })

  it('has no padding week when the month fits exactly (February 2027 starts on Monday)', () => {
    const weeks = buildMonthGrid({ year: 2027, month: 2 }, [], '')
    expect(weeks).toHaveLength(4)
    expect(weeks[0][0].date).toBe('2027-02-01')
    expect(weeks[3][6].date).toBe('2027-02-28')
  })

  it('keeps every day once across DST changes (last Sundays of March and October)', () => {
    for (const month of [3, 10]) {
      const days = buildMonthGrid({ year: 2026, month }, [], '').flat()
      expect(new Set(days.map((d) => d.date)).size).toBe(days.length)
      const inMonth = days.filter((d) => d.inMonth).map((d) => d.day)
      expect(inMonth).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    }
  })

  it('places events on the Madrid day they start, sorted by time', () => {
    // 22:30Z on 31 Oct is 23:30 Madrid (CET), 23:30Z on 27 Mar is 00:30 on the 28th (CET).
    const weeks = buildMonthGrid(
      { year: 2026, month: 10 },
      [event('late', '2026-10-02T14:00:00Z'), event('early', '2026-10-02T08:00:00Z'), event('night', '2026-10-31T22:30:00Z')],
      ''
    )
    const days = weeks.flat()
    expect(days.find((d) => d.date === '2026-10-02')?.events.map((e) => e.id)).toEqual(['early', 'late'])
    expect(days.find((d) => d.date === '2026-10-31')?.events.map((e) => e.id)).toEqual(['night'])
    expect(madridDayKey('2026-03-27T23:30:00Z')).toBe('2026-03-28')
  })

  it('ignores events outside the month and never puts events on padding days', () => {
    const weeks = buildMonthGrid({ year: 2026, month: 9 }, [event('next', '2026-10-01T14:00:00Z')], '')
    expect(weeks.flat().every((d) => d.events.length === 0)).toBe(true)
  })
})

describe('defaultSelectedDay', () => {
  const weeks = buildMonthGrid(
    { year: 2026, month: 10 },
    [event('a', '2026-10-02T14:00:00Z'), event('b', '2026-10-16T14:00:00Z')],
    '2026-10-10'
  )
  it('picks the first event from today on', () => {
    expect(defaultSelectedDay(weeks, '2026-10-10')).toBe('2026-10-16')
  })
  it('falls back to the first event of the month, or null', () => {
    expect(defaultSelectedDay(weeks, '2026-11-01')).toBe('2026-10-02')
    expect(defaultSelectedDay(buildMonthGrid({ year: 2026, month: 10 }, [], ''), '')).toBeNull()
  })
})

describe('labels', () => {
  it('formats the month title and Monday-first weekdays per locale', () => {
    expect(formatMonthTitle({ year: 2026, month: 10 }, 'ca')).toBe('Octubre 2026')
    expect(formatMonthTitle({ year: 2026, month: 10 }, 'es')).toBe('Octubre 2026')
    expect(weekdayLabels('ca').map((w) => w.short)).toEqual(['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'])
    expect(weekdayLabels('en')[0].long).toBe('Monday')
    expect(weekdayLabels('es')[6].long).toBe('Domingo')
  })
})

describe('buildCalendarView', () => {
  it('serialises formatted labels and times so client components never format dates', () => {
    const view = buildCalendarView({ year: 2026, month: 10 }, [event('fri', '2026-10-02T14:00:00Z')], '2026-10-10', 'ca')
    expect(view.title).toBe('Octubre 2026')
    expect(view.defaultSelected).toBe('2026-10-02')
    const day = view.weeks.flat().find((d) => d.date === '2026-10-02')!
    expect(day.label).toMatch(/^Divendres 2 d.octubre$/)
    expect(day.events[0].time).toBe('16:00')
  })
})
