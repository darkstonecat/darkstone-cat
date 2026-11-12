import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sessions = vi.hoisted(() => ({ fetchMemberAreaSessions: vi.fn() }))
vi.mock('@/lib/member-sessions', () => sessions)
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(() => { throw new Error('no auth on a public route') }) }))

import { GET } from '@/app/api/events/calendar/route'
import type { EventsCalendarMonth } from '@/lib/events/calendar-view'
import type { LudoyaSession } from '@/lib/ludoya/types'

const session = (over: Partial<LudoyaSession>): LudoyaSession =>
  ({
    id: 'e1',
    title: 'Sessió oberta',
    description: '',
    startsAt: '2026-12-04T16:00:00Z',
    endsAt: '2026-12-04T22:00:00Z',
    ludoyaUrl: 'https://ludoya.test/e1',
    type: 'regular',
    visibility: 'PUBLIC',
    place: null,
    plannedPlays: [],
    ...over,
  }) as LudoyaSession

const call = (query: string) => GET(new Request(`http://localhost/api/events/calendar?${query}`))
const cells = (body: EventsCalendarMonth) => body.weeks.flat().filter((d) => d.kind !== 'none')

describe('GET /api/events/calendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T11:00:00Z'))
    vi.clearAllMocks()
    sessions.fetchMemberAreaSessions.mockResolvedValue([])
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('refuses a malformed month or one outside current..+6 without reading Ludoya', async () => {
    for (const query of ['', 'month=2026-1', 'month=nope', 'month=2026-10', 'month=2027-06']) {
      const res = await call(query)
      expect(res.status, query).toBe(400)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
    expect(sessions.fetchMemberAreaSessions).not.toHaveBeenCalled()
  })

  it('answers a public, cacheable month with PUBLIC events only, no session needed', async () => {
    sessions.fetchMemberAreaSessions.mockResolvedValue([
      session({ id: 'open' }),
      session({ id: 'group', visibility: 'ONLY_GROUP', startsAt: '2026-12-05T16:00:00Z' }),
      session({ id: 'other-month', startsAt: '2027-01-08T16:00:00Z' }),
    ])
    const res = await call('month=2026-12&locale=es')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=60, stale-while-revalidate=300')

    const body = (await res.json()) as EventsCalendarMonth
    expect(body.monthKey).toBe('2026-12')
    expect(body.title).toBe('Diciembre 2026')
    expect(body.error).toBeUndefined()
    expect(cells(body).map((d) => [d.date, d.eventId])).toEqual([['2026-12-04', 'open']])
    expect(JSON.stringify(body)).not.toContain('ONLY_GROUP')
  })

  it.each([
    // Madrid is UTC+1 in November.
    ['an hour before midnight', '2026-11-11T22:00:00Z', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'],
    ['three minutes before midnight', '2026-11-11T22:57:00Z', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120'],
    ['30 seconds before midnight', '2026-11-11T22:59:30Z', 'public, max-age=30, s-maxage=30, stale-while-revalidate=0'],
  ])('never caches past Madrid midnight (%s), so "today" moves on time', async (_name, now, header) => {
    vi.setSystemTime(new Date(now))
    const res = await call('month=2026-12')
    expect(res.headers.get('cache-control')).toBe(header)
  })

  it('falls back to Catalan for an unknown locale', async () => {
    const body = (await (await call('month=2026-12&locale=fr')).json()) as EventsCalendarMonth
    expect(body.title).toBe('Desembre 2026')
  })

  it('returns the empty grid with the error kind, never cached, when Ludoya fails', async () => {
    sessions.fetchMemberAreaSessions.mockRejectedValue(new Error('boom'))
    const res = await call('month=2026-12')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = (await res.json()) as EventsCalendarMonth
    expect(body.error).toBe('api_error')
    expect(cells(body)).toEqual([])
    expect(body.weeks.length).toBeGreaterThan(3)
  })
})
