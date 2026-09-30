import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
  useLocale: vi.fn(() => 'es'),
}))

import MemberCalendar from '@/components/profile/MemberCalendar'
import { buildCalendarView, type CalendarPayload } from '@/lib/member-home/month-grid'
import ca from '@/messages/ca.json'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

const LUDOYA = 'https://ludoya.test'

const payload = (key: string, over: Partial<CalendarPayload> = {}): CalendarPayload => {
  const [year, month] = key.split('-').map(Number)
  return {
    monthKey: key,
    title: `Title ${key}`,
    prev: { key: 'prev', title: 'Prev title' },
    next: { key: 'next', title: 'Next title' },
    view: buildCalendarView({ year, month }, [], '2026-10-10', 'ca'),
    ...over,
  }
}

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  window.history.replaceState(null, '', '/profile')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchMock.mockReset()
})

const respond = (body: unknown, ok = true) => fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body })
const renderCalendar = (initial: CalendarPayload, current = '2026-10') =>
  render(<MemberCalendar initial={initial} currentMonthKey={current} ludoyaUrl={LUDOYA} />)

describe('MemberCalendar', () => {
  it('shows the Ludoya error card, with a link out, when the first load failed', () => {
    renderCalendar(payload('2026-10', { view: null, error: 'api_error' }))
    expect(screen.getByText('error_title').closest('[role="status"]')).not.toBeNull()
    expect(screen.getByRole('link', { name: /open_ludoya_home/ })).toHaveAttribute('href', LUDOYA)
    expect(screen.queryByRole('table', { hidden: true })).toBeNull()
  })

  it('keeps the arrows focusable at the range limits: aria-disabled and a no-op', () => {
    renderCalendar(payload('2026-07', { prev: null }))
    const prev = screen.getByRole('button', { name: 'prev_limit' })
    prev.focus()
    fireEvent.click(prev)
    expect(prev).toHaveAttribute('aria-disabled', 'true')
    expect(prev).not.toBeDisabled()
    expect(prev).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'next(Next title)' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('fetches the next month, announces it once, keeps focus and syncs ?month', async () => {
    respond(payload('2026-11', { title: 'Noviembre 2026', prev: { key: '2026-10', title: 'Octubre 2026' }, next: null }))
    renderCalendar(payload('2026-10'))
    const next = screen.getByRole('button', { name: 'next(Next title)' })
    next.focus()
    fireEvent.click(next)

    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Noviembre 2026'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/profile/calendar?month=next&locale=es')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: 'no-store' })
    expect(next).toHaveFocus()
    const live = document.querySelector('p[aria-live="polite"]')!
    expect(live).toHaveTextContent('Noviembre 2026')
    expect(window.location.search).toBe('?month=2026-11')
    // The new neighbours replace the old ones; the range end is a focusable no-op.
    expect(screen.getByRole('button', { name: 'prev(Octubre 2026)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'next_limit' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('drops the month param when going back to the current month', async () => {
    window.history.replaceState(null, '', '/profile?month=2026-11')
    respond(payload('2026-10'))
    renderCalendar(payload('2026-11'))
    fireEvent.click(screen.getByRole('button', { name: 'prev(Prev title)' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title 2026-10'))
    expect(window.location.search).toBe('')
  })

  it('shows a busy skeleton while loading and does not refetch the same target', async () => {
    let resolve!: (v: unknown) => void
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)))
    const { container } = renderCalendar(payload('2026-10'))
    const next = screen.getByRole('button', { name: 'next(Next title)' })
    fireEvent.click(next)
    fireEvent.click(next)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    resolve({ ok: true, status: 200, json: async () => payload('2026-11') })
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
  })

  it('turns a failed request into the error card and keeps the arrows usable', async () => {
    respond({}, false)
    renderCalendar(payload('2026-10'))
    fireEvent.click(screen.getByRole('button', { name: 'next(Next title)' }))
    expect(await screen.findByText('error_title')).toBeInTheDocument()
    expect(window.location.search).toBe('')
    respond(payload('2026-11', { title: 'Nov' }))
    fireEvent.click(screen.getByRole('button', { name: 'next(Next title)' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Nov'))
    expect(screen.queryByText('error_title')).toBeNull()
    expect(within(document.body).getAllByRole('table', { hidden: true }).length).toBe(2)
  })
})

describe('event pill accessible names (WCAG 2.5.3 label in name)', () => {
  it.each([
    ['ca', ca],
    ['es', es],
    ['en', en],
  ])('%s: the regular event label contains the visible "{time} {session}" text', (_locale, messages) => {
    const calendar = messages.profile.home.calendar
    expect(calendar.event_link).toContain(`{time} ${calendar.session}`)
    expect(calendar.event_link_special).toContain('{title}')
  })
})
