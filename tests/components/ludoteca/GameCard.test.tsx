import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BggGame } from '@/lib/bgg'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}))

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, fetchPriority, quality, sizes, ...rest } = props
    return <img alt="" data-fill={fill} data-priority={priority} {...rest} />
  },
}))

import GameCard from '@/components/ludoteca/GameCard'

function makeGame(overrides: Partial<BggGame> = {}): BggGame {
  return {
    id: '1',
    name: 'Catan',
    subtype: 'boardgame',
    year: 1995,
    thumbnail: 'https://example.com/thumb.jpg',
    image: 'https://example.com/image.jpg',
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 90,
    rating: 7.5,
    weight: 2.8,
    minAge: 10,
    categories: ['Strategy'],
    mechanics: ['Trading'],
    rankTypes: ['strategygames'],
    expansions: [],
    ...overrides,
  }
}

describe('GameCard', () => {
  it('renders game name', () => {
    render(<GameCard game={makeGame()} onClick={vi.fn()} />)
    expect(screen.getByText('Catan')).toBeInTheDocument()
  })

  it('displays player range', () => {
    render(<GameCard game={makeGame()} onClick={vi.fn()} />)
    expect(screen.getByText('2–4')).toBeInTheDocument()
  })

  it('displays single player count when min equals max', () => {
    render(
      <GameCard
        game={makeGame({ minPlayers: 2, maxPlayers: 2 })}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('displays playing time', () => {
    render(<GameCard game={makeGame()} onClick={vi.fn()} />)
    expect(screen.getByText(/90/)).toBeInTheDocument()
  })

  it('displays rating', () => {
    render(<GameCard game={makeGame()} onClick={vi.fn()} />)
    expect(screen.getByText('7.5')).toBeInTheDocument()
  })

  it('displays minimum age', () => {
    render(<GameCard game={makeGame()} onClick={vi.fn()} />)
    expect(screen.getByText('+10')).toBeInTheDocument()
  })

  it('shows expansion badge when game has expansions', () => {
    const game = makeGame({
      expansions: [
        { id: '2', name: 'Catan: Seafarers', year: 1997, thumbnail: '' },
        { id: '3', name: 'Catan: Cities', year: 1998, thumbnail: '' },
      ],
    })
    render(<GameCard game={game} onClick={vi.fn()} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('hides expansion badge when no expansions', () => {
    // Use minAge: 0 so the "+N" age display doesn't interfere
    render(
      <GameCard game={makeGame({ minAge: 0 })} onClick={vi.fn()} />
    )
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })

  it('hides stats when values are 0', () => {
    const game = makeGame({
      minPlayers: 0,
      maxPlayers: 0,
      playingTime: 0,
      rating: 0,
      weight: 0,
      minAge: 0,
    })
    render(<GameCard game={game} onClick={vi.fn()} />)
    // Only the name should be visible, no stat indicators
    expect(screen.queryByText(/^\d+–\d+$/)).not.toBeInTheDocument()
  })

  it('fires onClick when card is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<GameCard game={makeGame()} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
