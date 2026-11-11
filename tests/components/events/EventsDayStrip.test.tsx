import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn((ns?: string) => (key: string, values?: Record<string, unknown>) => {
    const name = ns ? `${ns}.${key}` : key
    return values ? `${name}(${Object.values(values).join(',')})` : name
  }),
  useLocale: vi.fn(() => 'ca'),
}))

import EventsDayStrip from '@/components/events/EventsDayStrip'
import type { StripWeek } from '@/lib/events/agenda-format'
import { toEventsCalendar } from '@/lib/events/calendar-view'
import ca from '@/messages/ca.json'
import es from '@/messages/es.json'
import en from '@/messages/en.json'

const strip: StripWeek[] = [
  {
    start: '2026-11-09',
    current: true,
    label: '9–15 de nov.',
    days: [
      { date: '2026-11-13', weekday: 'DV', day: '13', label: 'Divendres 13 de novembre', special: false, titles: ['Divendres de jocs!'], eventId: 'fri' },
    ],
  },
  {
    start: '2026-11-23',
    current: false,
    label: '23–29 de nov.',
    days: [
      { date: '2026-11-28', weekday: 'DS', day: '28', label: 'Dissabte 28 de novembre', special: true, titles: ['Egara Juga'], eventId: 'egara' },
    ],
  },
]
const calendar = toEventsCalendar({ year: 2026, month: 11 }, [], new Date('2026-11-11T11:00:00Z'), 'ca')

const renderStrip = () => render(<EventsDayStrip strip={strip} calendar={calendar} loadedIds={['fri', 'egara']} />)

describe('EventsDayStrip', () => {
  it('lists the upcoming days as links to their cards, with week labels', () => {
    renderStrip()
    const list = screen.getByRole('list', { name: 'events.strip.title' })

    const fri = within(list).getByRole('link', { name: 'events.calendar.day_link(Divendres 13 de novembre,Divendres de jocs!)' })
    expect(fri.getAttribute('href')).toBe('#event-fri')
    expect(fri.textContent).toContain('DV')
    expect(fri.textContent).toContain('13')

    const egara = within(list).getByRole('link', { name: /Dissabte 28 de novembre/ })
    expect(egara.getAttribute('href')).toBe('#event-egara')
    expect(egara.className).toContain('bg-brand-orange')
    expect(egara.textContent).toContain('★')

    expect(within(list).getByText('events.this_week')).toBeTruthy()
    expect(within(list).getByText('23–29 de nov.')).toBeTruthy()
    // Never a countdown in the strip.
    expect(list.textContent).not.toMatch(/countdown/)
  })

  it('shows this week dark and later weeks light', () => {
    renderStrip()
    expect(screen.getByRole('link', { name: /Divendres 13/ }).className).toContain('bg-stone-custom')
  })

  it('expands and collapses the month grid', () => {
    renderStrip()
    const toggle = screen.getByRole('button', { name: /events.strip.show_month/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(panel.hidden).toBe(true)

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.textContent).toContain('events.strip.hide_month')
    expect(panel.hidden).toBe(false)
    expect(within(panel).getByRole('heading', { name: /Novembre 2026/ })).toBeTruthy()
    expect(within(panel).getByText('events.calendar.hint_touch')).toBeTruthy()
  })

  it('has the strip messages in the three locales', () => {
    for (const messages of [ca, es, en]) {
      expect(Object.keys(messages.events.strip).sort()).toEqual(['hide_month', 'show_month', 'title'])
      expect(messages.events.calendar.hint_touch).toBeTruthy()
    }
  })
})
