import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
  useLocale: vi.fn(() => 'ca'),
}))

import MonthCalendar from '@/components/profile/MonthCalendar'
import { buildCalendarView, type CalendarEvent, type YearMonth } from '@/lib/member-home/month-grid'

const view = (month: YearMonth, events: CalendarEvent[], today: string) => buildCalendarView(month, events, today, 'ca')

const event = (id: string, startsAt: string, over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: `Title ${id}`,
  startsAt,
  special: false,
  placeName: 'Usual Venue',
  ludoyaUrl: `https://ludoya.test/${id}`,
  ...over,
})

const OCT = { year: 2026, month: 10 }
const EVENTS = [
  event('fri', '2026-10-02T14:00:00Z'),
  event('sat', '2026-10-03T08:00:00Z'),
  event('big', '2026-10-18T09:00:00Z', { special: true, placeName: null }),
]

function tables() {
  // Both tables are in the DOM (one is display: none by CSS); jsdom applies no CSS.
  const all = screen.getAllByRole('table', { hidden: true })
  return { sheet: all[0], grid: all[1] }
}

describe('MonthCalendar', () => {
  it('renders Monday-first weekday headers and one row per week in both layouts', () => {
    render(<MonthCalendar view={view(OCT, EVENTS, '2026-10-10')} />)
    const { sheet, grid } = tables()
    for (const table of [sheet, grid]) {
      const headers = within(table).getAllByRole('columnheader', { hidden: true })
      expect(headers.map((h) => h.textContent)).toEqual(['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'])
      // header row + 5 weeks (October 2026 starts on a Thursday)
      expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(6)
    }
  })

  it('desktop pills open Ludoya in a new tab with a descriptive label; specials carry a star and their title', () => {
    render(<MonthCalendar view={view(OCT, EVENTS, '2026-10-10')} />)
    const { sheet } = tables()
    const links = within(sheet).getAllByRole('link', { hidden: true })
    expect(links).toHaveLength(3)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link.getAttribute('aria-label')).toMatch(/new_tab$/)
    }
    expect(links[0]).toHaveAttribute('href', 'https://ludoya.test/fri')
    expect(links[0]).toHaveTextContent('16:00 session')
    expect(links[2]).toHaveTextContent('Title big')
    expect(links[2].getAttribute('aria-label')).toContain('Title big')
    expect(links[2].querySelector('svg')).not.toBeNull()
  })

  it('marks today and hides out-of-month days from assistive technology', () => {
    render(<MonthCalendar view={view(OCT, EVENTS, '2026-10-10')} />)
    const { sheet, grid } = tables()
    expect(sheet.querySelectorAll('[aria-current="date"]')).toHaveLength(1)
    expect(grid.querySelectorAll('[aria-current="date"]')).toHaveLength(1)
    // 28, 29 and 30 September lead the first week; 1 November and more close the last.
    const hidden = sheet.querySelectorAll('td [aria-hidden="true"]')
    expect(hidden.length).toBeGreaterThanOrEqual(4)
    expect(Array.from(hidden).slice(0, 3).map((n) => n.textContent)).toEqual(['28', '29', '30'])
  })

  it('mobile: only days with events are buttons, with counts in their label and a selected default', () => {
    render(<MonthCalendar view={view(OCT, EVENTS, '2026-10-10')} />)
    const { grid } = tables()
    const buttons = within(grid).getAllByRole('button', { hidden: true })
    expect(buttons).toHaveLength(3)
    // Default selection: first event from today on (the 18th, special).
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    expect(buttons[2].getAttribute('aria-label')).toContain('day_events_special')
    expect(buttons[0].getAttribute('aria-label')).toContain('day_events(')
    // Special day carries a star.
    expect(buttons[2].querySelector('svg')).not.toBeNull()
  })

  it('mobile: announces today on a day with events', () => {
    render(<MonthCalendar view={view(OCT, EVENTS, '2026-10-02')} />)
    const { grid } = tables()
    const [today, other] = within(grid).getAllByRole('button', { hidden: true })
    expect(today.getAttribute('aria-label')).toMatch(/, today$/)
    expect(other.getAttribute('aria-label')).not.toContain('today')
  })

  it('mobile: selecting a day fills the detail panel with title, time, place and an Ludoya button', () => {
    render(<MonthCalendar view={view(OCT, EVENTS, '2026-10-10')} />)
    const { grid } = tables()
    const panel = screen.getByRole('status')
    expect(within(panel).getByText('Title big')).toBeInTheDocument()
    fireEvent.click(within(grid).getAllByRole('button', { hidden: true })[0])
    expect(within(panel).getByText('Title fri')).toBeInTheDocument()
    expect(within(panel).getByText(/Usual Venue/)).toBeInTheDocument()
    const open = within(panel).getByRole('link')
    expect(open).toHaveAttribute('href', 'https://ludoya.test/fri')
    expect(open).toHaveAttribute('target', '_blank')
    expect(within(panel).queryByText('Title big')).toBeNull()
  })

  it('shows a plain grid and a note for a month without events', () => {
    render(<MonthCalendar view={view({ year: 2026, month: 11 }, [], '2026-10-10')} />)
    const { sheet, grid } = tables()
    expect(within(sheet).queryAllByRole('link', { hidden: true })).toHaveLength(0)
    expect(within(grid).queryAllByRole('button', { hidden: true })).toHaveLength(0)
    expect(screen.getByText('empty_month')).toBeInTheDocument()
    expect(within(screen.getByRole('status')).getByText('panel_empty')).toBeInTheDocument()
  })
})
