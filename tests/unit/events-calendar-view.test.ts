import { describe, it, expect } from 'vitest'
import { isEventsMonth, parseMonthKey, toEventsCalendar, type CalendarSession } from '@/lib/events/calendar-view'

// Wednesday 11 November 2026, 12:00 in Madrid.
const NOW = new Date('2026-11-11T11:00:00Z')
const NOV = { year: 2026, month: 11 }

const session = (over: Partial<CalendarSession> & { id: string }): CalendarSession => ({
  title: 'Sessió oberta',
  startsAt: '2026-11-13T15:00:00Z',
  type: 'regular',
  visibility: 'PUBLIC',
  ludoyaUrl: `https://app.ludoya.test/events/${over.id}`,
  ...over,
})

const day = (cal: ReturnType<typeof toEventsCalendar>, date: string) => {
  const found = cal.weeks.flat().find((d) => d.date === date)
  if (!found) throw new Error(`no cell ${date}`)
  return found
}

describe('toEventsCalendar', () => {
  it('marks session, special, past and today days on a Monday-first grid', () => {
    const cal = toEventsCalendar(
      NOV,
      [
        session({ id: 'past', startsAt: '2026-11-06T16:00:00Z' }),
        session({ id: 'fri', startsAt: '2026-11-13T15:00:00Z' }),
        session({ id: 'egara', title: 'Egara Juga 2026', type: 'special', startsAt: '2026-11-21T09:00:00Z' }),
      ],
      NOW,
      'ca'
    )

    expect(cal.monthKey).toBe('2026-11')
    expect(cal.title).toBe('Novembre 2026')
    expect(cal.weekdays.map((w) => w.short)).toEqual(['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'])
    expect(cal.weeks[0][0].date).toBe('2026-10-26')

    expect(day(cal, '2026-11-06')).toMatchObject({ kind: 'session', isPast: true, eventId: 'past' })
    expect(day(cal, '2026-11-11')).toMatchObject({ kind: 'none', isToday: true, isPast: false, eventId: null })
    expect(day(cal, '2026-11-13')).toMatchObject({
      kind: 'session',
      isPast: false,
      label: 'Divendres 13 de novembre',
      titles: ['Sessió oberta'],
      eventId: 'fri',
      ludoyaUrl: 'https://app.ludoya.test/events/fri',
    })
    expect(day(cal, '2026-11-21')).toMatchObject({ kind: 'special', eventId: 'egara', titles: ['Egara Juga 2026'] })
    // Days of the neighbouring months carry no event.
    expect(day(cal, '2026-10-26')).toMatchObject({ inMonth: false, kind: 'none', eventId: null })
  })

  it('opens the special when a day has a session and a special', () => {
    const cal = toEventsCalendar(
      NOV,
      [
        session({ id: 'morning', startsAt: '2026-11-21T08:00:00Z' }),
        session({ id: 'fest', title: 'Festa', type: 'special', startsAt: '2026-11-21T16:00:00Z' }),
      ],
      NOW,
      'ca'
    )
    expect(day(cal, '2026-11-21')).toMatchObject({ kind: 'special', eventId: 'fest', titles: ['Sessió oberta', 'Festa'] })
  })

  it('shows PUBLIC events only and sends no other field', () => {
    const cal = toEventsCalendar(
      NOV,
      [
        { ...session({ id: 'group', visibility: 'ONLY_GROUP', startsAt: '2026-11-14T15:00:00Z' }), organizer: 'Secret Name' } as CalendarSession,
        { ...session({ id: 'open' }), organizer: 'Secret Name' } as CalendarSession,
      ],
      NOW,
      'ca'
    )
    expect(day(cal, '2026-11-14').kind).toBe('none')
    const json = JSON.stringify(cal)
    expect(json).not.toContain('Secret Name')
    expect(json).not.toContain('ONLY_GROUP')
    expect(json).not.toContain('visibility')
  })

  it('offers navigation from the current month up to six months ahead', () => {
    const current = toEventsCalendar(NOV, [], NOW, 'ca')
    expect(current.prev).toBeNull()
    expect(current.next).toEqual({ key: '2026-12', title: 'Desembre 2026' })

    const last = toEventsCalendar({ year: 2027, month: 5 }, [], NOW, 'es')
    expect(last.prev).toEqual({ key: '2027-04', title: 'Abril 2027' })
    expect(last.next).toBeNull()
  })
})

describe('isEventsMonth / parseMonthKey', () => {
  it('accepts the current month to six months ahead', () => {
    expect(isEventsMonth({ year: 2026, month: 10 }, NOW)).toBe(false)
    expect(isEventsMonth(NOV, NOW)).toBe(true)
    expect(isEventsMonth({ year: 2027, month: 5 }, NOW)).toBe(true)
    expect(isEventsMonth({ year: 2027, month: 6 }, NOW)).toBe(false)
  })

  it('parses YYYY-MM only', () => {
    expect(parseMonthKey('2026-11')).toEqual(NOV)
    expect(parseMonthKey('2026-13')).toBeNull()
    expect(parseMonthKey('2026-1')).toBeNull()
    expect(parseMonthKey('')).toBeNull()
    expect(parseMonthKey(null)).toBeNull()
  })
})
