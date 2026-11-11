import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

// Messages come back as `key` or `key(values)`, so tests read the rule, not the copy.
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { quality, sizes, fill, ...rest } = props
    return <img alt="" data-quality={String(quality)} {...rest} />
  },
}))

import SeatPill from '@/components/events/SeatPill'
import ItemCard from '@/components/events/program/ItemCard'
import { activityView, demoView, playView, tournamentView } from '../../helpers/program-view'

const play = (over: Parameters<typeof playView>[0] = {}) =>
  playView({ coverUrl: 'https://img.test/emberleaf.jpg', ludoyaUrl: 'https://ludoya.test/events/p1', time: '18:00 – 20:00', ...over })

const chairs = (container: HTMLElement, variant: 'mobile' | 'desktop') =>
  container.querySelector(`[data-chairs="${variant}"]`)!

describe('SeatPill', () => {
  it('is one image with the seat label and the X/N counter', () => {
    render(<SeatPill play={play({ participantCount: 2, capacity: 4, minParticipants: 3 })} />)

    const pill = screen.getByRole('img', { name: 'aria_seats_needed(2,4,1)' })
    expect(within(pill).getByText('2/4')).toBeInTheDocument()
  })

  it('draws taken, needed and free chairs, one row per breakpoint', () => {
    const { container } = render(<SeatPill play={play({ participantCount: 2, capacity: 4, minParticipants: 3 })} />)

    for (const variant of ['mobile', 'desktop'] as const) {
      const kinds = [...chairs(container, variant).querySelectorAll('[data-seat]')].map((el) => el.getAttribute('data-seat'))
      expect(kinds).toEqual(['taken', 'taken', 'needed', 'free'])
    }
  })

  it('cuts many chairs with an ellipsis: 5 + … on desktop, 4 + … on mobile', () => {
    const { container } = render(<SeatPill play={play({ participantCount: 3, capacity: 8 })} />)

    expect(chairs(container, 'desktop').querySelectorAll('[data-seat]')).toHaveLength(5)
    expect(chairs(container, 'mobile').querySelectorAll('[data-seat]')).toHaveLength(4)
    expect(chairs(container, 'desktop')).toHaveTextContent('…')
    expect(screen.getByText('3/8')).toBeInTheDocument()
  })

  it('draws one segment per seat from 9 to 20 seats', () => {
    const { container } = render(<SeatPill play={play({ participantCount: 12, capacity: 16 })} />)

    const segments = [...container.querySelectorAll('[data-segment]')].map((el) => el.getAttribute('data-segment'))
    expect(segments).toHaveLength(16)
    expect(segments.filter((s) => s === 'taken')).toHaveLength(12)
    expect(container.querySelector('[data-chairs]')).toBeNull()
  })

  it('fills a plain bar above 20 seats', () => {
    const { container } = render(<SeatPill play={play({ participantCount: 45, capacity: 60 })} />)

    expect(container.querySelector<HTMLElement>('[data-bar-fill]')!.style.width).toBe('75%')
    expect(screen.getByText('45/60')).toBeInTheDocument()
  })

  it('shows a people icon and the sign-up count without a limit', () => {
    render(<SeatPill play={play({ participantCount: 21, capacity: null })} />)

    expect(screen.getByRole('img', { name: 'aria_open(21)' })).toHaveTextContent('count_open(21)')
  })
})

const inList = (ui: React.ReactNode) => render(<ul>{ui}</ul>)

describe('ItemCard: play', () => {
  it('shows the cover, time, game name and the sign-up link', () => {
    inList(<ItemCard item={play()} />)

    expect(screen.getByText('Emberleaf')).toBeInTheDocument()
    expect(screen.getByText('18:00 – 20:00')).toBeInTheDocument()
    const cover = document.querySelector('img')!
    expect(cover).toHaveAttribute('src', 'https://img.test/emberleaf.jpg')
    expect(cover).toHaveAttribute('data-quality', '60')

    const link = screen.getByRole('link', { name: /play\.join/ })
    expect(link).toHaveAttribute('href', 'https://ludoya.test/events/p1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(document.querySelector('[data-item-badge]')).toBeNull()
  })

  it('offers the queue when the play is full', () => {
    inList(<ItemCard item={play({ participantCount: 4, capacity: 4 })} />)

    expect(screen.getByRole('link', { name: /play\.queue/ })).toBeInTheDocument()
  })

  it('writes no status text under the cover, the seat pill already shows it', () => {
    inList(<ItemCard item={play({ participantCount: 1, capacity: 6, minParticipants: 3 })} />)
    expect(screen.queryByText(/^status_/)).toBeNull()
  })

  it('opens the play on Ludoya from the cover, out of the tab order', () => {
    const { container } = inList(<ItemCard item={play()} />)

    const cover = container.querySelector('a[data-item-cover]')!
    expect(cover).toHaveAttribute('href', 'https://ludoya.test/events/p1')
    expect(cover).toHaveAttribute('target', '_blank')
    expect(cover).toHaveAttribute('tabindex', '-1')
  })

  it('draws the placeholder when there is no cover', () => {
    const { container } = inList(<ItemCard item={play({ coverUrl: null })} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-cover-placeholder]')).toHaveTextContent('cover_none')
  })

  it('puts the play title and its zone under the game name', () => {
    inList(<ItemCard item={play({ title: 'Aquí nunca hubo campanas', gameName: 'D&D Yearbook 2024', zone: 'Partides de ROL' })} />)

    expect(screen.getByText('D&D Yearbook 2024')).toBeInTheDocument()
    expect(screen.getByText('Aquí nunca hubo campanas · Partides de ROL')).toBeInTheDocument()
  })
})

describe('ItemCard: tournament and activity', () => {
  it('marks a tournament with its format and the sign-up button', () => {
    inList(<ItemCard item={tournamentView()} />)

    expect(document.querySelector('[data-item-badge="tournament"]')).toHaveTextContent('badge_tournament_format(format.SWISS)')
    expect(screen.getByRole('img', { name: /aria_seats/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /program\.cta_tournament/ })).toBeInTheDocument()
  })

  it('says "tickets" for a ticketed tournament and plain "tournament" without a format', () => {
    inList(<ItemCard item={tournamentView({ format: null, tickets: true } as never)} />)

    expect(document.querySelector('[data-item-badge="tournament"]')).toHaveTextContent('badge_tournament')
    expect(screen.getByRole('link', { name: /program\.cta_tickets/ })).toBeInTheDocument()
  })

  it('shows an activity without seats, with its badge and "more info"', () => {
    inList(<ItemCard item={activityView()} />)

    expect(screen.queryByRole('img', { name: /aria_/ })).toBeNull()
    expect(document.querySelector('[data-item-badge="activity"]')).toHaveTextContent('badge_activity')
    expect(screen.getByRole('link', { name: /program\.cta_info/ })).toBeInTheDocument()
  })
})

describe('ItemCard: always-open items', () => {
  it('shows a demo as a full card with its badge, no seats and "more info"', () => {
    inList(<ItemCard item={demoView()} />)

    expect(document.querySelector('[data-item-badge="demo"]')).toHaveTextContent('badge_demo')
    expect(screen.getByRole('link', { name: /program\.cta_info/ })).toHaveAttribute('href', 'https://ludoya.test/d1')
    expect(screen.getByText('Fearsome Floors')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /aria_/ })).toBeNull()
  })

  it('fills the "more info" button like the sign-up one', () => {
    inList(<ItemCard item={demoView()} dark />)
    inList(<ItemCard item={play({ id: 'p2', participantCount: 0, capacity: 4 })} dark />)

    const info = screen.getByRole('link', { name: /program\.cta_info/ })
    const join = screen.getByRole('link', { name: /play\.join/ })
    expect(info.className).toBe(join.className)
  })

  it('leaves the zone out when the group already names it', () => {
    inList(<ItemCard item={demoView()} hideZone />)

    expect(screen.queryByText('Demostracions de 2tomatoes')).toBeNull()
  })
})
