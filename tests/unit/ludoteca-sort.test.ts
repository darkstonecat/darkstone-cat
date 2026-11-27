import { describe, it, expect } from 'vitest'
import type { BggGame } from '@/lib/bgg'
import { DEFAULT_LUDOTECA_SORT, isLudotecaSort, sortGames } from '@/lib/ludoteca-sort'

function game(id: string, name: string, over: Partial<BggGame> = {}): BggGame {
  return {
    id,
    subtype: 'boardgame',
    name,
    year: 2020,
    thumbnail: '',
    image: '',
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 60,
    rating: 0,
    weight: 0,
    minAge: 0,
    categories: [],
    mechanics: [],
    rankTypes: [],
    expansions: [],
    ...over,
  }
}

const names = (games: BggGame[]) => games.map((g) => g.name)

describe('sortGames', () => {
  it('defaults to the newest additions first', () => {
    expect(DEFAULT_LUDOTECA_SORT).toBe('added-desc')
  })

  it('added-desc puts the latest addedAt first', () => {
    const games = [
      game('1', 'Old', { addedAt: '2024-06-01 01:28:53' }),
      game('2', 'Newest', { addedAt: '2026-11-20 10:00:00' }),
      game('3', 'Middle', { addedAt: '2026-02-25 11:23:08' }),
    ]
    expect(names(sortGames(games, 'added-desc'))).toEqual(['Newest', 'Middle', 'Old'])
  })

  it('added-desc breaks ties (the bulk-loaded games) by name and puts games without a date last', () => {
    const games = [
      game('1', 'No date'),
      game('2', 'Zombicide', { addedAt: '2026-02-25 11:23:08' }),
      game('3', 'Azul', { addedAt: '2026-02-25 11:23:08' }),
      game('4', 'Brand new', { addedAt: '2026-11-20 10:00:00' }),
    ]
    expect(names(sortGames(games, 'added-desc'))).toEqual(['Brand new', 'Azul', 'Zombicide', 'No date'])
  })

  it('keeps the existing name, rating and weight orders', () => {
    const games = [
      game('1', 'Bravo', { rating: 7, weight: 3 }),
      game('2', 'Alpha', { rating: 8, weight: 2 }),
      game('3', 'Charlie', { rating: 6, weight: 4 }),
    ]
    expect(names(sortGames(games, 'name-asc'))).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(names(sortGames(games, 'name-desc'))).toEqual(['Charlie', 'Bravo', 'Alpha'])
    expect(names(sortGames(games, 'rating-desc'))).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(names(sortGames(games, 'rating-asc'))).toEqual(['Charlie', 'Bravo', 'Alpha'])
    expect(names(sortGames(games, 'weight-desc'))).toEqual(['Charlie', 'Bravo', 'Alpha'])
    expect(names(sortGames(games, 'weight-asc'))).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('added-desc compares the day only, so a bulk load spread over seconds stays in name order', () => {
    const games = [
      game('1', 'Shogun', { addedAt: '2026-10-31 13:07:27' }),
      game('2', 'Azul', { addedAt: '2026-10-31 13:06:22' }),
      game('3', 'Catan', { addedAt: '2026-10-31 13:06:52' }),
      game('4', 'Arrived later', { addedAt: '2026-11-02 09:00:00' }),
    ]
    expect(names(sortGames(games, 'added-desc'))).toEqual(['Arrived later', 'Azul', 'Catan', 'Shogun'])
  })

  it('does not mutate the input array', () => {
    const games = [game('1', 'B'), game('2', 'A')]
    sortGames(games, 'name-asc')
    expect(names(games)).toEqual(['B', 'A'])
  })
})

describe('isLudotecaSort', () => {
  it('accepts every known order and rejects anything else', () => {
    for (const s of ['added-desc', 'name-asc', 'name-desc', 'rating-desc', 'rating-asc', 'weight-desc', 'weight-asc']) {
      expect(isLudotecaSort(s)).toBe(true)
    }
    expect(isLudotecaSort('added-asc')).toBe(false)
    expect(isLudotecaSort('')).toBe(false)
  })
})
