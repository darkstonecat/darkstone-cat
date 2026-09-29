import { describe, it, expect } from 'vitest'
import {
  textValue,
  parseCollectionItems,
  rawToGame,
  extractRankTypes,
  enrichWithThingData,
  linkExpansionsByThing,
  type BggGame,
  type ThingData,
} from '@/lib/bgg'

// Helper to create a minimal BggGame for linking tests
function makeGame(
  id: string,
  name: string,
  subtype: 'boardgame' | 'boardgameexpansion' = 'boardgame'
): BggGame {
  return {
    id,
    name,
    subtype,
    year: 2020,
    thumbnail: '',
    image: '',
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 60,
    rating: 7,
    weight: 2,
    minAge: 10,
    categories: [],
    mechanics: [],
    rankTypes: [],
    expansions: [],
    originalName: undefined,
  }
}

describe('textValue', () => {
  it('returns string directly', () => {
    expect(textValue('hello')).toBe('hello')
  })

  it('extracts #text from object', () => {
    expect(textValue({ '#text': 'world' })).toBe('world')
  })

  it('returns empty string for undefined', () => {
    expect(textValue(undefined)).toBe('')
  })
})

describe('extractRankTypes', () => {
  it('extracts family rank names', () => {
    const ranks = [
      { '@_type': 'family', '@_name': 'strategygames', '@_value': '42' },
      { '@_type': 'subtype', '@_name': 'boardgame', '@_value': '100' },
    ]
    expect(extractRankTypes(ranks)).toEqual(['strategygames'])
  })

  it('filters out "Not Ranked"', () => {
    const ranks = [
      {
        '@_type': 'family',
        '@_name': 'strategygames',
        '@_value': 'Not Ranked',
      },
    ]
    expect(extractRankTypes(ranks)).toEqual([])
  })

  it('handles null / undefined', () => {
    expect(extractRankTypes(null)).toEqual([])
    expect(extractRankTypes(undefined)).toEqual([])
  })

  it('handles single rank (not wrapped in array)', () => {
    const rank = {
      '@_type': 'family',
      '@_name': 'partygames',
      '@_value': '10',
    }
    expect(extractRankTypes(rank)).toEqual(['partygames'])
  })
})

describe('parseCollectionItems', () => {
  it('parses valid collection XML', () => {
    const xml = `<?xml version="1.0"?>
      <items totalitems="2">
        <item objectid="123" subtype="boardgame">
          <name>Catan</name>
          <yearpublished>1995</yearpublished>
        </item>
        <item objectid="456" subtype="boardgame">
          <name>Carcassonne</name>
        </item>
      </items>`
    const items = parseCollectionItems(xml)
    expect(items).toHaveLength(2)
    expect(items[0]['@_objectid']).toBe('123')
    expect(items[1]['@_objectid']).toBe('456')
  })

  it('returns empty array for empty collection', () => {
    const xml = `<?xml version="1.0"?><items totalitems="0"></items>`
    expect(parseCollectionItems(xml)).toEqual([])
  })

  it('wraps single item in array', () => {
    const xml = `<?xml version="1.0"?>
      <items><item objectid="1" subtype="boardgame"><name>X</name></item></items>`
    expect(parseCollectionItems(xml)).toHaveLength(1)
  })
})

describe('rawToGame', () => {
  it('converts raw item to BggGame', () => {
    const raw = {
      '@_objectid': '42',
      '@_subtype': 'boardgame',
      name: 'Test Game',
      yearpublished: '2020',
      thumbnail: 'thumb.jpg',
      image: 'image.jpg',
      stats: {
        '@_minplayers': '2',
        '@_maxplayers': '4',
        '@_playingtime': '60',
        rating: {
          average: { '@_value': '7.5' },
          averageweight: { '@_value': '2.8' },
          ranks: {
            rank: [
              {
                '@_type': 'family',
                '@_name': 'strategygames',
                '@_value': '100',
              },
            ],
          },
        },
      },
    }
    const game = rawToGame(raw as any)
    expect(game.id).toBe('42')
    expect(game.name).toBe('Test Game')
    expect(game.year).toBe(2020)
    expect(game.minPlayers).toBe(2)
    expect(game.maxPlayers).toBe(4)
    expect(game.playingTime).toBe(60)
    expect(game.rating).toBe(7.5)
    expect(game.weight).toBe(2.8)
    expect(game.rankTypes).toEqual(['strategygames'])
    expect(game.expansions).toEqual([])
  })

  it('handles missing stats gracefully (defaults to 0)', () => {
    const raw = {
      '@_objectid': '1',
      '@_subtype': 'boardgame',
      name: 'No Stats',
    }
    const game = rawToGame(raw as any)
    expect(game.minPlayers).toBe(0)
    expect(game.rating).toBe(0)
    expect(game.weight).toBe(0)
  })
})

describe('enrichWithThingData', () => {
  it('merges weight, minAge, categories, mechanics', () => {
    const games = [makeGame('1', 'Test')]
    games[0].weight = 0
    games[0].minAge = 0
    const thingMap = new Map<string, ThingData>([
      [
        '1',
        {
          weight: 3.5,
          minAge: 14,
          categories: ['Strategy'],
          mechanics: ['Worker Placement'],
          rankTypes: ['strategygames'],
          baseGameIds: [],
        },
      ],
    ])
    enrichWithThingData(games, thingMap)
    expect(games[0].weight).toBe(3.5)
    expect(games[0].minAge).toBe(14)
    expect(games[0].categories).toEqual(['Strategy'])
    expect(games[0].mechanics).toEqual(['Worker Placement'])
  })

  it('preserves original weight when thing weight is zero', () => {
    const games = [makeGame('1', 'Test')]
    games[0].weight = 2.5
    const thingMap = new Map<string, ThingData>([
      [
        '1',
        {
          weight: 0,
          minAge: 0,
          categories: [],
          mechanics: [],
          rankTypes: [],
          baseGameIds: [],
        },
      ],
    ])
    enrichWithThingData(games, thingMap)
    expect(games[0].weight).toBe(2.5)
  })
})

describe('linkExpansionsByThing', () => {
  it('links expansion to base via inbound link', () => {
    const bases = [makeGame('1', 'Catan')]
    const exps = [makeGame('2', 'Catan: Seafarers', 'boardgameexpansion')]
    const thingMap = new Map<string, ThingData>([
      [
        '2',
        {
          weight: 2,
          minAge: 10,
          categories: [],
          mechanics: [],
          rankTypes: [],
          baseGameIds: ['1'],
        },
      ],
    ])
    linkExpansionsByThing(bases, exps, thingMap)
    expect(bases[0].expansions).toHaveLength(1)
    expect(bases[0].expansions[0].id).toBe('2')
  })

  it('does nothing when expansion has no thing data', () => {
    const bases = [makeGame('1', 'Catan')]
    const exps = [makeGame('2', 'Unknown Exp', 'boardgameexpansion')]
    const thingMap = new Map<string, ThingData>()
    linkExpansionsByThing(bases, exps, thingMap)
    expect(bases[0].expansions).toHaveLength(0)
  })
})
