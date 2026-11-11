import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

// Messages come back as `key` or `key(values)`, so tests read the rule, not the copy.
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { quality, sizes, fill, ...rest } = props
    return <img alt="" {...rest} />
  },
}))

import EventProgram from '@/components/events/program/EventProgram'
import { activityView, dayView, demoView, playView, programView, tournamentView } from '../../helpers/program-view'

const PROPOSE = <li data-testid="propose">propose</li>

const saturday = dayView(
  [playView({ id: 's1' }), tournamentView({ id: 's2', time: '10:00 – 16:00' }), activityView({ id: 's3' })],
  {
    day: '2026-11-28',
    title: 'Dissabte 28 de novembre',
    mode: 'slots',
    groups: [
      { startsAt: '2026-11-28T09:00:00Z', time: '10:00', items: [playView({ id: 's1' }), tournamentView({ id: 's2' })] },
      { startsAt: '2026-11-28T17:00:00Z', time: '18:00', items: [activityView({ id: 's3' })] },
    ],
  }
)
const sunday = dayView([playView({ id: 'u1', title: 'Arkham', gameName: 'Arkham' })], { day: '2026-11-29', title: 'Diumenge 29 de novembre' })
const alwaysOpen = [
  { zone: 'Demostracions de 2tomatoes', items: [demoView({ id: 'd1' }), demoView({ id: 'd2', title: 'La Cuenta' })] },
  { zone: null, items: [activityView({ id: 'risk', title: 'A Risk Cat', zone: null, placement: 'alwaysOpen', startsAt: null, time: null })] },
]
const weekend = programView([], { days: [saturday, sunday], alwaysOpen, multiDay: true })

const sections = () => screen.getAllByRole('heading', { level: 4 })
const toggleOf = (name: RegExp) => screen.getByRole('button', { name })

describe('EventProgram on a multi-day event', () => {
  it('shows every day as its own section, all open, with a summary', () => {
    render(<EventProgram program={weekend} trailing={PROPOSE} />)

    expect(sections().map((h) => h.textContent)).toEqual([
      expect.stringContaining('Dissabte 28 de novembre'),
      expect.stringContaining('Diumenge 29 de novembre'),
      expect.stringContaining('always_open_event'),
    ])
    expect(toggleOf(/Dissabte/)).toHaveAttribute('aria-expanded', 'true')
    expect(toggleOf(/Dissabte/)).toHaveTextContent('summary_plays(1) · summary_tournaments(1) · summary_activities(1)')
    expect(toggleOf(/Diumenge/)).toHaveAttribute('aria-expanded', 'true')
  })

  it('folds and unfolds a day', () => {
    render(<EventProgram program={weekend} />)
    const button = toggleOf(/Dissabte/)
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel).not.toBeVisible()
    fireEvent.click(button)
    expect(panel).toBeVisible()
  })

  it('draws one row per start time in slots mode', () => {
    const { container } = render(<EventProgram program={weekend} />)

    const slots = [...container.querySelectorAll('[data-program-slot]')]
    expect(slots.map((s) => s.querySelector('time')!.textContent)).toEqual(['10:00', '18:00'])
    expect(slots[0].querySelectorAll('[data-item-kind]')).toHaveLength(2)
  })

  it('closes the last day with the propose tile, once', () => {
    render(<EventProgram program={weekend} trailing={PROPOSE} />)
    const sundayPanel = document.getElementById(toggleOf(/Diumenge/).getAttribute('aria-controls')!)!

    expect(screen.getAllByTestId('propose')).toHaveLength(1)
    expect(within(sundayPanel).getByTestId('propose')).toBeInTheDocument()
  })

  it('groups the always-open block by zone, other activities last, and folds it', () => {
    const { container } = render(<EventProgram program={weekend} />)

    const groups = [...container.querySelectorAll('[data-always-open-group]')]
    expect(groups.map((g) => g.querySelector('p')!.firstChild!.textContent)).toEqual(['Demostracions de 2tomatoes', 'other_activities'])
    expect(screen.getByText('always_open_pill')).toBeInTheDocument()
    const button = toggleOf(/always_open_event/)
    expect(button).toHaveTextContent('summary_items(3)')
    fireEvent.click(button)
    expect(screen.getByText('always_open_pill')).not.toBeVisible()
  })
})

describe('EventProgram on a one-day event', () => {
  it('shows the grid directly, without day sections, and the propose tile after it', () => {
    const program = programView([playView({ id: 'a' }), playView({ id: 'b' })])
    render(<EventProgram program={program} trailing={PROPOSE} />)

    expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0)
    expect(document.querySelectorAll('[data-item-kind="play"]')).toHaveLength(2)
    expect(screen.getByTestId('propose')).toBeInTheDocument()
  })

  it('calls the always-open block "all day"', () => {
    render(<EventProgram program={programView([playView()], { alwaysOpen: [{ zone: null, items: [demoView({ zone: null })] }] })} />)

    expect(toggleOf(/always_open_day/)).toBeInTheDocument()
  })

  it('still offers the propose tile when there is nothing yet', () => {
    render(<EventProgram program={programView([])} trailing={PROPOSE} />)

    expect(screen.getByTestId('propose')).toBeInTheDocument()
  })
})
