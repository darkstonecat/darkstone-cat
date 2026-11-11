import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'

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
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => null }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))

import EventsTimeline from '@/components/events/EventsTimeline'
import EventsHeader from '@/components/events/EventsHeader'
import type { EventView, WeekView } from '@/lib/events/agenda-format'
import { activityView, dayView, demoView, playView as play, programView, tournamentView } from '../../helpers/program-view'

const icons = (el: HTMLElement) => [...el.querySelectorAll('svg[data-icon]')].map((svg) => svg.getAttribute('data-icon'))

const event = (over: Partial<EventView> = {}): EventView => ({
  id: 'fri',
  title: 'Divendres de jocs!',
  description: '',
  startsAt: '2026-11-13T15:00:00Z',
  endsAt: '2026-11-13T19:30:00Z',
  type: 'regular',
  imageUrl: null,
  ludoyaUrl: 'https://ludoya.test/fri',
  place: null,
  participantCount: 3,
  capacity: null,
  countdown: null,
  program: programView([play(), play({ id: 'p2', title: 'Signorie', gameName: 'Signorie', participantCount: 2 })]),
  tile: { days: [{ weekday: 'DV', day: '13' }], gap: false },
  dates: 'Divendres 13 de novembre',
  time: '16:00 – 20:30',
  when: 'Divendres 13 de novembre · 16:00 – 20:30',
  ...over,
})

const egara = event({
  id: 'egara',
  title: 'Egara Juga 2026',
  type: 'special',
  description: 'Programa complet',
  participantCount: 21,
  capacity: null,
  countdown: { kind: 'days', days: 17 },
  place: { name: 'Recinte Firal', address: 'Carrer Firal, 1' },
  program: programView([]),
  tile: { days: [{ weekday: 'DS', day: '28' }, { weekday: 'DG', day: '29' }], gap: false },
  dates: 'Ds., 28 – dg., 29 de novembre',
  time: '10:00 – 17:00',
})

const week = (over: Partial<WeekView> = {}): WeekView => ({
  start: '2026-11-09',
  end: '2026-11-15',
  isCurrent: true,
  range: '9–15 de novembre',
  title: { start: '9', end: '15 de novembre', startElided: 'no', endElided: 'no' },
  events: [event()],
  ...over,
})

const laterWeek = week({
  start: '2026-11-23',
  end: '2026-11-29',
  isCurrent: false,
  range: '23–29 de novembre',
  title: { start: '23', end: '29 de novembre', startElided: 'no', endElided: 'no' },
  events: [event({ id: 'fri27', program: programView([]) }), egara],
})

const weeks = () => [week(), laterWeek]

const card = (id: string) => document.getElementById(`event-${id}`)!
const toggle = (id: string) => card(id).querySelector<HTMLButtonElement>('button[aria-expanded]')!
const panel = (id: string) => document.getElementById(`event-${id}-panel`)!

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.history.replaceState(null, '', '/events')
})
afterEach(() => vi.restoreAllMocks())

describe('EventsTimeline defaults', () => {
  it("opens this week's sessions and every special, closes later sessions", () => {
    render(<EventsTimeline weeks={weeks()} />)

    expect(toggle('fri')).toHaveAttribute('aria-expanded', 'true')
    expect(panel('fri')).toBeVisible()
    expect(toggle('fri27')).toHaveAttribute('aria-expanded', 'false')
    expect(panel('fri27')).not.toBeVisible()
    expect(toggle('egara')).toHaveAttribute('aria-expanded', 'true')
    expect(toggle('fri')).toHaveAttribute('aria-controls', 'event-fri-panel')
  })

  it('names the weeks and sums them up', () => {
    render(<EventsTimeline weeks={weeks()} />)

    expect(screen.getByRole('heading', { level: 2, name: 'this_week' })).toBeInTheDocument()
    expect(screen.getByText('9–15 de novembre · summary_plays(2) · summary_free(3)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'week_title(23,29 de novembre,no,no)' })).toBeInTheDocument()
    expect(screen.getByText('summary_sessions(1) · summary_specials(1)')).toBeInTheDocument()
  })
})

describe('EventsTimeline cards', () => {
  it('shows one day on a one-day tile and both days on a two-day tile', () => {
    render(<EventsTimeline weeks={weeks()} />)
    const tile = (id: string) => card(id).querySelector('[data-timeline-tile]')!

    expect(tile('fri').textContent).toBe('DV13')
    expect(tile('egara').textContent).toBe('DS28DG29')
  })

  it('marks the days left out between the first and last day of a longer event', () => {
    const camp = event({ id: 'camp', type: 'special', tile: { days: [{ weekday: 'DV', day: '27' }, { weekday: 'DL', day: '30' }], gap: true } })
    render(<EventsTimeline weeks={[week({ events: [camp] })]} />)

    expect(card('camp').querySelector('[data-timeline-tile]')!.textContent).toBe('DV27⋮DL30')
  })

  it('toggles a card', () => {
    render(<EventsTimeline weeks={weeks()} />)

    fireEvent.click(toggle('fri'))
    expect(toggle('fri')).toHaveAttribute('aria-expanded', 'false')
    expect(panel('fri')).not.toBeVisible()
    fireEvent.click(toggle('fri'))
    expect(panel('fri')).toBeVisible()
  })

  it('expands and collapses a whole later week', () => {
    render(<EventsTimeline weeks={weeks()} />)

    fireEvent.click(screen.getByRole('button', { name: 'expand_all' }))
    expect(toggle('fri27')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'collapse_all' }))
    expect(toggle('fri27')).toHaveAttribute('aria-expanded', 'false')
    expect(toggle('egara')).toHaveAttribute('aria-expanded', 'false')
  })

  it('has no toggle-all for this week', () => {
    render(<EventsTimeline weeks={[week()]} />)

    expect(screen.queryByRole('button', { name: /expand_all|collapse_all/ })).toBeNull()
  })

  it('shows the plays grid with seats and the propose card when open', () => {
    render(<EventsTimeline weeks={weeks()} />)

    const grid = within(panel('fri'))
    expect(grid.getByText('Emberleaf')).toBeInTheDocument()
    expect(grid.getAllByText('16:00')).toHaveLength(2)
    expect(grid.getByRole('link', { name: /propose_title/ })).toHaveAttribute('href', 'https://ludoya.test/fri')
    expect(grid.getByText('propose_hint')).toBeInTheDocument()
  })

  it('sums up a closed session: plays, free seats and a stack of covers', () => {
    render(<EventsTimeline weeks={weeks()} />)
    fireEvent.click(toggle('fri'))

    const header = within(card('fri'))
    expect(header.getByText('summary_plays(2)')).toBeInTheDocument()
    expect(header.getByText('summary_free(3)')).toBeInTheDocument()
    const stack = card('fri').querySelectorAll('[aria-hidden="true"] img')
    expect(stack).toHaveLength(2)
  })

  it('invites to propose the first play of a session without plays', () => {
    render(<EventsTimeline weeks={weeks()} />)

    const header = within(card('fri27'))
    expect(header.getByText('plays_none')).toBeInTheDocument()
    expect(header.getByText('propose_short')).toBeInTheDocument()
    expect(within(panel('fri27')).getByText('propose_hint_first')).toBeInTheDocument()
  })

  it('gives the countdown to specials only', () => {
    render(<EventsTimeline weeks={weeks()} />)

    expect(within(card('egara')).getByText(/countdown_days\(17\)/)).toBeInTheDocument()
    expect(within(card('fri')).queryByText(/countdown/)).toBeNull()
  })

  it('names a place only when it is not the usual venue, with directions', () => {
    render(<EventsTimeline weeks={weeks()} />)

    const special = within(panel('egara'))
    expect(special.getByText('away')).toBeInTheDocument()
    const directions = special.getByRole('link', { name: /directions/ })
    expect(directions).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Recinte%20Firal%2C%20Carrer%20Firal%2C%201'
    )
    expect(icons(directions)).toEqual(['arrow_outward'])
    expect(within(card('fri')).queryByText('away')).toBeNull()
  })

  it('names no place for a special at the usual venue', () => {
    render(<EventsTimeline weeks={[week({ events: [{ ...egara, place: null }] })]} />)

    expect(within(card('egara')).queryByText('away')).toBeNull()
    expect(within(card('egara')).queryByRole('link', { name: /directions/ })).toBeNull()
  })

  it('shows the program of a special: count chips, day sections and the always-open block', () => {
    const program = programView([], {
      multiDay: true,
      days: [
        dayView([play({ id: 'sp1' }), tournamentView({ id: 'sp2' })], { day: '2026-11-28', title: 'Dissabte 28 de novembre' }),
        dayView([activityView({ id: 'sp3' })], { day: '2026-11-29', title: 'Diumenge 29 de novembre' }),
      ],
      alwaysOpen: [{ zone: '2tomatoes', items: [demoView()] }],
    })
    render(<EventsTimeline weeks={[week({ events: [event({ ...egara, program })] })]} />)

    const chips = card('egara').querySelector('[data-program-counts]')!
    expect([...chips.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'summary_plays(1)',
      'summary_tournaments(1)',
      'summary_activities(1)',
      'summary_demos(1)',
    ])
    const days = within(panel('egara')).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(days).toEqual([expect.stringContaining('Dissabte'), expect.stringContaining('Diumenge'), expect.stringContaining('always_open_event')])
  })

  it('shows the special details: sign-ups, description and the Ludoya link', () => {
    render(<EventsTimeline weeks={weeks()} />)

    const special = within(panel('egara'))
    expect(special.getByText(/signups\(21\)/)).toHaveTextContent('signups(21) · capacity_unlimited')
    expect(special.getByText('Programa complet')).toBeInTheDocument()
    expect(special.getByText('special_plays_none')).toBeInTheDocument()
    const join = special.getByRole('link', { name: /special_join/ })
    expect(join).toHaveAttribute('href', 'https://ludoya.test/fri')
    expect(icons(join)).toEqual(['ludoya'])
    expect(icons(special.getByRole('link', { name: /propose_short/ }))).toEqual(['arrow_outward'])
  })

  it('ends with the link to more dates on Ludoya', () => {
    render(<EventsTimeline weeks={weeks()} />)

    const more = screen.getByRole('link', { name: /more_on_ludoya/ })
    expect(more).toHaveAttribute('target', '_blank')
    expect(icons(more)).toEqual(['ludoya'])
    expect(more).not.toHaveTextContent('↗')
  })
})

describe('EventsTimeline anchors', () => {
  it('opens a closed card and updates the hash when a #event link is clicked', () => {
    render(
      <>
        <a href="#event-fri27">jump</a>
        <EventsTimeline weeks={weeks()} />
      </>
    )

    fireEvent.click(screen.getByRole('link', { name: 'jump' }))

    expect(toggle('fri27')).toHaveAttribute('aria-expanded', 'true')
    expect(window.location.hash).toBe('#event-fri27')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('ignores links to unknown events', () => {
    render(
      <>
        <a href="#event-nope">jump</a>
        <EventsTimeline weeks={weeks()} />
      </>
    )

    fireEvent.click(screen.getByRole('link', { name: 'jump' }))

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('opens the card named by the hash on load', async () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '/events#event-fri27')
    render(<EventsTimeline weeks={weeks()} />)

    await act(async () => {
      vi.advanceTimersByTime(50)
    })
    vi.useRealTimers()

    expect(toggle('fri27')).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('EventsHeader', () => {
  it('has the title, hours, venue and one banner per special', () => {
    render(<EventsHeader specials={[egara]} />)

    expect(screen.getByRole('heading', { level: 1, name: 'title' })).toBeInTheDocument()
    expect(screen.getByText(/hours_chip/)).toBeInTheDocument()
    expect(screen.getByText('free_chip')).toBeInTheDocument()
    const banners = within(screen.getByRole('list', { name: 'banners_label' })).getAllByRole('link')
    expect(banners).toHaveLength(1)
    expect(banners[0]).toHaveAttribute('href', '#event-egara')
    expect(within(banners[0]).getByText('Egara Juga 2026')).toBeInTheDocument()
    expect(within(banners[0]).getByLabelText('countdown_days(17)')).toHaveTextContent('17')
  })

  it('marks the venue link with the outward arrow', () => {
    render(<EventsHeader specials={[]} />)

    const venue = screen.getByRole('link', { name: /Ca N/ })
    expect(icons(venue)).toEqual(['arrow_outward'])
    expect(venue).not.toHaveTextContent('↗')
  })

  it('shows a word instead of a number tomorrow, today and while running', () => {
    render(<EventsHeader specials={[{ ...egara, countdown: { kind: 'running', days: 0 } }]} />)

    expect(screen.getByText('countdown_running')).toBeInTheDocument()
  })

  it('has no banner list without specials', () => {
    render(<EventsHeader specials={[]} />)

    expect(screen.queryByRole('list', { name: 'banners_label' })).toBeNull()
  })
})
