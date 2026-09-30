import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
const member = vi.hoisted(() => ({ fetchMonthEvents: vi.fn() }))
vi.mock('@/lib/member-sessions', () => member)

import { GET } from '@/app/api/profile/calendar/route'
import type { CalendarPayload } from '@/lib/member-home/month-grid'
import type { LudoyaSession } from '@/lib/ludoya/types'

function setupAuth(opts: { user?: { id: string } | null; member?: { id: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.member ?? null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }) },
    from: vi.fn().mockReturnValue({ select }),
  } as any)
}

const session = (over: Partial<LudoyaSession>): LudoyaSession =>
  ({
    id: 'e1',
    title: 'Friday session',
    startsAt: '2026-10-02T14:00:00Z',
    ludoyaUrl: 'https://ludoya.test/e1',
    type: 'regular',
    visibility: 'PUBLIC',
    place: null,
    plannedPlays: [],
    ...over,
  }) as LudoyaSession

const call = (query: string) => GET(new Request(`http://localhost/api/profile/calendar?${query}`))

describe('GET /api/profile/calendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'))
    vi.clearAllMocks()
    member.fetchMonthEvents.mockResolvedValue({ events: [] })
  })
  afterEach(() => vi.useRealTimers())

  it('requires a session and a member row, and is never cached', async () => {
    setupAuth({ user: null })
    const anonymous = await call('month=2026-10')
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('cache-control')).toBe('no-store')

    setupAuth({ user: { id: 'u' }, member: null })
    expect((await call('month=2026-10')).status).toBe(404)
    expect(member.fetchMonthEvents).not.toHaveBeenCalled()
  })

  it.each(['', 'month=abc', 'month=2026-13', 'month=2026-1', 'month=2030-01', 'month=2020-01'])(
    'rejects an invalid or out-of-range month (%s)',
    async (query) => {
      setupAuth({ user: { id: 'u' }, member: { id: 'u' } })
      expect((await call(query)).status).toBe(400)
      expect(member.fetchMonthEvents).not.toHaveBeenCalled()
    }
  )

  it('returns the pre-formatted month with group-only events included and no-store', async () => {
    setupAuth({ user: { id: 'u' }, member: { id: 'u' } })
    member.fetchMonthEvents.mockResolvedValue({
      events: [
        session({ id: 'pub' }),
        session({ id: 'grp', visibility: 'ONLY_GROUP', startsAt: '2026-10-09T14:00:00Z' }),
      ],
    })

    const res = await call('month=2026-10&locale=es')
    const body = (await res.json()) as CalendarPayload

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(member.fetchMonthEvents).toHaveBeenCalledWith(2026, 10)
    expect(body).toMatchObject({ monthKey: '2026-10', title: 'Octubre 2026', prev: { key: '2026-09' }, next: { key: '2026-11' } })
    const ids = body.view!.weeks.flat().flatMap((d) => d.events.map((e) => e.id))
    expect(ids).toEqual(['pub', 'grp'])
  })

  it('drops neighbours at the range limits', async () => {
    setupAuth({ user: { id: 'u' }, member: { id: 'u' } })
    const first = (await (await call('month=2026-07')).json()) as CalendarPayload
    expect(first.prev).toBeNull()
    expect(first.next).toMatchObject({ key: '2026-08' })
    const last = (await (await call('month=2027-04')).json()) as CalendarPayload
    expect(last.next).toBeNull()
  })

  it('falls back to Catalan for an unknown locale', async () => {
    setupAuth({ user: { id: 'u' }, member: { id: 'u' } })
    const body = (await (await call('month=2026-10&locale=xx')).json()) as CalendarPayload
    expect(body.title).toBe('Octubre 2026')
  })

  it('reports a Ludoya failure as an error payload without a grid', async () => {
    setupAuth({ user: { id: 'u' }, member: { id: 'u' } })
    member.fetchMonthEvents.mockResolvedValue({ events: [], error: 'timeout' })
    const res = await call('month=2026-10')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ monthKey: '2026-10', view: null, error: 'timeout' })
  })
})
