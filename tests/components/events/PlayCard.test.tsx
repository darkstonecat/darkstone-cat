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
import PlayCard from '@/components/events/PlayCard'
import type { AgendaPlay } from '@/lib/events/agenda-view'

const play = (over: Partial<AgendaPlay> = {}): AgendaPlay => ({
  id: 'p1',
  gameName: 'Emberleaf',
  coverUrl: 'https://img.test/emberleaf.jpg',
  startsAt: '2026-11-13T17:00:00Z',
  endsAt: '2026-11-13T19:00:00Z',
  place: null,
  participantCount: 3,
  capacity: 4,
  minParticipants: null,
  ludoyaUrl: 'https://ludoya.test/events/p1',
  ...over,
})

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

describe('PlayCard', () => {
  it('shows the cover, time, game name, status and the sign-up link', () => {
    render(<PlayCard play={play()} time="18:00" />)

    expect(screen.getByText('Emberleaf')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
    const cover = document.querySelector('img')!
    expect(cover).toHaveAttribute('src', 'https://img.test/emberleaf.jpg')
    expect(cover).toHaveAttribute('data-quality', '60')

    const link = screen.getByRole('link', { name: /join/ })
    expect(link).toHaveAttribute('href', 'https://ludoya.test/events/p1')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('offers the queue when the play is full', () => {
    render(<PlayCard play={play({ participantCount: 4, capacity: 4 })} time="18:00" />)

    expect(screen.getByRole('link', { name: /queue/ })).toBeInTheDocument()
  })

  it('writes no status text under the cover, the seat pill already shows it', () => {
    const { rerender } = render(<PlayCard play={play({ participantCount: 1, capacity: 6, minParticipants: 3 })} time="18:00" />)
    expect(screen.queryByText(/^status_/)).toBeNull()

    for (const p of [
      play({ participantCount: 1, capacity: 4 }),
      play({ participantCount: 3, capacity: 4 }),
      play({ participantCount: 4, capacity: 4 }),
      play({ participantCount: 1, capacity: null }),
    ]) {
      rerender(<PlayCard play={p} time="18:00" />)
      expect(screen.queryByText(/^status_/)).toBeNull()
    }
  })

  it('opens the play on Ludoya from the cover, like the sign-up button', () => {
    const { container } = render(<PlayCard play={play()} time="18:00" />)

    const cover = container.querySelector('a[data-play-cover]')!
    expect(cover).toHaveAttribute('href', 'https://ludoya.test/events/p1')
    expect(cover).toHaveAttribute('target', '_blank')
    expect(cover).toHaveAttribute('rel', 'noopener noreferrer')
    // The button is the keyboard target; the cover is a mouse and touch shortcut.
    expect(cover).toHaveAttribute('tabindex', '-1')
  })

  it('draws a placeholder when the play has no cover', () => {
    const { container } = render(<PlayCard play={play({ coverUrl: null })} time="18:00" />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-cover-placeholder]')).not.toBeNull()
  })
})
