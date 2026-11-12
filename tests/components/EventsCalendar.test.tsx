import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
  useLocale: vi.fn(() => 'es'),
}))

import EventsCalendar from '@/components/events/EventsCalendar'
import { toEventsCalendar, type CalendarSession } from '@/lib/events/calendar-view'
import ca from '@/messages/ca.json'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

const NOW = new Date('2026-11-11T11:00:00Z')
const session = (id: string, startsAt: string, over: Partial<CalendarSession> = {}): CalendarSession => ({
  id,
  title: `Title ${id}`,
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + 4 * 3600_000).toISOString(),
  type: 'regular',
  visibility: 'PUBLIC',
  ludoyaUrl: `https://ludoya.test/${id}`,
  ...over,
})

const november = toEventsCalendar(
  { year: 2026, month: 11 },
  [
    session('past', '2026-11-06T16:00:00Z'),
    session('fri', '2026-11-13T15:00:00Z'),
    session('later', '2026-11-27T15:00:00Z'),
    session('egara', '2026-11-21T09:00:00Z', { type: 'special', title: 'Egara Juga' }),
  ],
  NOW,
  'ca'
)
const december = toEventsCalendar({ year: 2026, month: 12 }, [session('dec', '2026-12-04T16:00:00Z')], NOW, 'ca')

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

const renderCalendar = () => render(<EventsCalendar initial={november} loadedIds={['fri', 'egara']} />)
const link = (name: RegExp) => screen.getByRole('link', { name })

describe('EventsCalendar', () => {
  it('links loaded events to their card and the rest to Ludoya', () => {
    renderCalendar()
    expect(screen.getByRole('heading', { name: /Novembre 2026/ })).toBeTruthy()

    const fri = link(/Divendres 13 de novembre/)
    expect(fri.getAttribute('href')).toBe('#event-fri')
    expect(fri.getAttribute('target')).toBeNull()
    expect(fri.getAttribute('aria-label')).toBe('day_link(Divendres 13 de novembre,Title fri)')

    const egara = link(/Dissabte 21 de novembre/)
    expect(egara.getAttribute('href')).toBe('#event-egara')

    const later = link(/Divendres 27 de novembre/)
    expect(later.getAttribute('href')).toBe('https://ludoya.test/later')
    expect(later.getAttribute('target')).toBe('_blank')
    expect(later.getAttribute('aria-label')).toContain('external')

    expect(link(/Divendres 6 de novembre/).className).toContain('opacity-35')
    expect(document.querySelector('[aria-current="date"]')?.textContent).toContain('11')
  })

  it('keeps the previous arrow disabled on the current month', () => {
    renderCalendar()
    const prev = screen.getByRole('button', { name: 'prev_limit' })
    expect(prev.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(prev)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads the next month from the public route and announces it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => december })
    renderCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'next(Desembre 2026)' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: /Desembre 2026/ })).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith('/api/events/calendar?month=2026-12&locale=es', expect.anything())
    expect(screen.getByRole('status').textContent).toBe('Desembre 2026')
    // Not in the loaded agenda: opens Ludoya.
    expect(link(/Divendres 4 de desembre/).getAttribute('href')).toBe('https://ludoya.test/dec')
    expect(screen.getByRole('button', { name: 'prev(Novembre 2026)' }).getAttribute('aria-disabled')).toBe('false')
  })

  it('keeps the month and offers Ludoya when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    renderCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'next(Desembre 2026)' }))

    await waitFor(() => expect(screen.getByText('error')).toBeTruthy())
    expect(screen.getByRole('heading', { name: /Novembre 2026/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /error_link/ }).getAttribute('href')).toContain('ludoya.com')
  })

  it('shows the error notice for a month Ludoya could not give', () => {
    render(<EventsCalendar initial={{ ...december, error: 'timeout' }} loadedIds={[]} />)
    expect(screen.getByText('error')).toBeTruthy()
  })

  it('has every calendar message in the three locales', () => {
    const keys = Object.keys(ca.events.calendar).sort()
    expect(Object.keys(es.events.calendar).sort()).toEqual(keys)
    expect(Object.keys(en.events.calendar).sort()).toEqual(keys)
    for (const key of ['title', 'prev', 'next', 'prev_limit', 'next_limit', 'day_link', 'external', 'error', 'error_link']) {
      expect(keys).toContain(key)
    }
  })
})
