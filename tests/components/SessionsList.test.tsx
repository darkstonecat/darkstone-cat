import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

// Messages come back as `key` or `key(values)`, so tests read the rule, not the copy.
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
  useLocale: vi.fn(() => 'ca'),
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { quality, sizes, ...rest } = props
    return <img alt="" {...rest} />
  },
}))

import SessionsList from '@/components/profile/SessionsList'
import type { MemberSession, MemberSessionPlay } from '@/lib/member-sessions'
import { toSessionRow } from '@/lib/member-home/sessions-view'

// jsdom has no matchMedia; tests default to a desktop viewport.
const stubViewport = (mobile: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: mobile && query.includes('max-width'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
beforeEach(() => stubViewport(false))
afterEach(() => vi.unstubAllGlobals())

const LUDOYA = 'https://ludoya.test'

const play = (over: Partial<MemberSessionPlay> = {}): MemberSessionPlay => ({
  id: 'p1',
  gameName: 'Game One',
  imageUrl: null,
  yearPublished: 0,
  slug: null,
  startsAt: '2026-10-02T14:00:00Z',
  endsAt: null,
  place: null,
  participantCount: 1,
  capacity: 4,
  minParticipants: null,
  organizerName: null,
  ludoyaUrl: 'https://ludoya.test/events/p1',
  visibility: 'PUBLIC',
  coverUrl: 'https://img.test/1.jpg',
  ...over,
})

const baseSession = (over: Partial<MemberSession> = {}): MemberSession => ({
  id: 's1',
  title: 'Friday session',
  description: '',
  startsAt: '2026-10-02T14:00:00Z',
  endsAt: '2026-10-02T18:30:00Z',
  timeZone: 'Europe/Madrid',
  imageUrl: null,
  thumbnailUrl: null,
  plannedPlayCount: 0,
  ludoyaUrl: 'https://ludoya.test/events/s1',
  type: 'regular',
  visibility: 'PUBLIC',
  place: { id: 'l1', name: 'Usual Venue', address: null, isUsual: true },
  participantCount: 0,
  capacity: null,
  minParticipants: null,
  queuedParticipantCount: null,
  organizerName: null,
  plannedPlays: [play()],
  ...over,
})

const session = (over: Partial<MemberSession> = {}) => toSessionRow(baseSession(over), 'ca')

describe('SessionsList states', () => {
  it('shows an error card with a Ludoya link and no session list', () => {
    render(<SessionsList sessions={[]} error="timeout" ludoyaUrl={LUDOYA} />)
    expect(screen.getByRole('status')).toHaveTextContent('error_title')
    expect(screen.getByRole('link', { name: /open_ludoya/ })).toHaveAttribute('href', LUDOYA)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows the empty week message with a Ludoya link', () => {
    render(<SessionsList sessions={[]} ludoyaUrl={LUDOYA} />)
    expect(screen.getByText('empty_title')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open_ludoya/ })).toHaveAttribute('href', LUDOYA)
  })
})

describe('SessionsList session rows', () => {
  it('shows title, when-line, place from data and the counts line', () => {
    render(<SessionsList sessions={[session({ plannedPlays: [play(), play({ id: 'p2', participantCount: 3 })] })]} ludoyaUrl={LUDOYA} />)
    const region = screen.getByRole('region', { name: 'Friday session' })
    expect(within(region).getByRole('heading', { level: 3 })).toHaveTextContent('Friday session')
    expect(within(region).getByText(/Divendres 2 d.octubre · 16:00 – 20:30/)).toBeInTheDocument()
    expect(within(region).getByText('Usual Venue')).toBeInTheDocument()
    expect(within(region).getByText('plays(2)')).toBeInTheDocument()
    expect(within(region).getByText('seats_free(4)')).toBeInTheDocument()
  })

  it('marks special sessions with a text chip, not colour alone', () => {
    render(<SessionsList sessions={[session({ type: 'special' })]} ludoyaUrl={LUDOYA} />)
    expect(screen.getByText('special')).toBeInTheDocument()
  })

  it('does not show the chip for regular sessions', () => {
    render(<SessionsList sessions={[session()]} ludoyaUrl={LUDOYA} />)
    expect(screen.queryByText('special')).toBeNull()
  })

  it('highlights an away place and never hardcodes a venue', () => {
    render(
      <SessionsList
        sessions={[session({ place: { id: 'l2', name: 'Some Friendly Shop', address: null, isUsual: false } })]}
        ludoyaUrl={LUDOYA}
      />
    )
    const place = screen.getByText('Some Friendly Shop')
    expect(place.className).toContain('text-brand-orange-text')
  })

  it('renders no place line when Ludoya gives none', () => {
    render(<SessionsList sessions={[session({ place: null })]} ludoyaUrl={LUDOYA} />)
    expect(screen.queryByText('Usual Venue')).toBeNull()
  })

  it('says all full when no seat is free', () => {
    render(<SessionsList sessions={[session({ plannedPlays: [play({ participantCount: 4 })] })]} ludoyaUrl={LUDOYA} />)
    expect(screen.getByText('all_full')).toBeInTheDocument()
  })

  it('hides the cover stack from assistive tech', () => {
    const { container } = render(<SessionsList sessions={[session()]} ludoyaUrl={LUDOYA} />)
    const stack = container.querySelector('[aria-hidden="true"].md\\:flex')
    expect(stack).not.toBeNull()
    expect(stack?.querySelector('img')).not.toBeNull()
  })
})

describe('SessionsList accordion', () => {
  it('toggles a session with aria-expanded and aria-controls', () => {
    render(<SessionsList sessions={[session()]} ludoyaUrl={LUDOYA} />)
    const button = screen.getByRole('button', { name: /show_plays/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(panel).toBeInTheDocument()
    expect(panel).toHaveAttribute('hidden')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('hidden')
    expect(button).toHaveTextContent('hide_plays')
  })

  it('opens sessions independently', () => {
    render(<SessionsList sessions={[session(), session({ id: 's2', title: 'Saturday session' })]} ludoyaUrl={LUDOYA} />)
    const [first, second] = screen.getAllByRole('button', { name: /show_plays/ })
    fireEvent.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SessionsList plays', () => {
  const open = (s: ReturnType<typeof session>) => {
    render(<SessionsList sessions={[s]} ludoyaUrl={LUDOYA} />)
    fireEvent.click(screen.getByRole('button', { name: /show_plays/ }))
    return within(screen.getByRole('list', { name: /plays_list/ }))
  }

  it.each([
    [{ participantCount: 1, capacity: 4 }, 'status_free(3)', 'join'],
    [{ participantCount: 3, capacity: 4 }, 'status_last', 'join'],
    [{ participantCount: 4, capacity: 4 }, 'status_full', 'join_queue'],
    [{ participantCount: 6, capacity: null }, 'status_unlimited', 'join'],
  ] as const)('%j shows %s and the %s action', (seats, status, action) => {
    const plays = open(session({ plannedPlays: [play(seats)] }))
    expect(plays.getByText(status)).toBeInTheDocument()
    expect(plays.getByRole('link', { name: /join_label|queue_label/ })).toHaveTextContent(action)
  })

  it('links each play to Ludoya in a new tab with a descriptive name', () => {
    const plays = open(session({ plannedPlays: [play({ gameName: 'Emberleaf' })] }))
    const join = plays.getByRole('link', { name: /join_label\(Emberleaf\)/ })
    expect(join).toHaveAttribute('href', 'https://ludoya.test/events/p1')
    expect(join).toHaveAttribute('target', '_blank')
    expect(join).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says full without a queue number', () => {
    const plays = open(session({ plannedPlays: [play({ participantCount: 4 })] }))
    expect(plays.getByText('status_full')).toBeInTheDocument()
    expect(plays.getByText('status_full')).toHaveTextContent(/^status_full$/)
  })

  it('shows count as taken/capacity, or a signed-up count without a limit', () => {
    const plays = open(session({ plannedPlays: [play({ participantCount: 2 }), play({ id: 'p2', participantCount: 6, capacity: null })] }))
    expect(plays.getByText('taken(2,4)')).toBeInTheDocument()
    expect(plays.getByText('taken_unlimited(6)')).toBeInTheDocument()
  })

  it('shows the organizer only when there is one', () => {
    const plays = open(session({ plannedPlays: [play({ organizerName: 'Host X' }), play({ id: 'p2' })] }))
    expect(plays.getByText('organizer(Host X)')).toBeInTheDocument()
    expect(plays.getAllByText(/^organizer/)).toHaveLength(1)
  })

  it('draws decorative seat dots only for capacities up to 8', () => {
    const plays = open(session({ plannedPlays: [play({ capacity: 4, participantCount: 3 }), play({ id: 'p2', capacity: 9 }), play({ id: 'p3', capacity: null })] }))
    const dots = document.querySelectorAll('[aria-hidden="true"].w-\\[136px\\]')
    expect(dots).toHaveLength(1)
    expect(dots[0].children).toHaveLength(4)
    expect(dots[0].querySelectorAll('.bg-brand-orange')).toHaveLength(3)
    expect(plays).toBeDefined()
  })

  it('shows at most five plays and a link to the rest on Ludoya', () => {
    const many = Array.from({ length: 7 }, (_, i) => play({ id: `p${i}`, gameName: `Game ${i}` }))
    const plays = open(session({ plannedPlays: many }))
    expect(plays.getAllByRole('link', { name: /join_label/ })).toHaveLength(5)
    expect(plays.getByText('Game 4')).toBeInTheDocument()
    expect(plays.queryByText('Game 5')).toBeNull()
    const more = screen.getByRole('link', { name: /more\(2\)/ })
    expect(more).toHaveAttribute('href', 'https://ludoya.test/events/s1')
  })

  it('offers to propose a game even without plays, and no "more" link', () => {
    const plays = open(session({ plannedPlays: [] }))
    expect(plays.getByText('propose_title')).toBeInTheDocument()
    expect(plays.getByRole('link', { name: /propose_label\(Friday session\)/ })).toHaveAttribute('href', 'https://ludoya.test/events/s1')
    expect(screen.queryByRole('link', { name: /more/ })).toBeNull()
  })
})

describe('SessionsList default expansion', () => {
  it('expands only the first session on mobile', () => {
    stubViewport(true)
    render(<SessionsList sessions={[session({ id: 'a', title: 'A' }), session({ id: 'b', title: 'B' })]} ludoyaUrl={LUDOYA} />)
    const buttons = screen.getAllByRole('button', { name: /(show|hide)_plays/ })
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false'])
    fireEvent.click(buttons[0])
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('starts all collapsed on desktop', () => {
    stubViewport(false)
    render(<SessionsList sessions={[session({ id: 'a', title: 'A' }), session({ id: 'b', title: 'B' })]} ludoyaUrl={LUDOYA} />)
    const buttons = screen.getAllByRole('button', { name: /(show|hide)_plays/ })
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false'])
  })
})
