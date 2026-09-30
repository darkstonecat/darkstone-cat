import { describe, it, expect } from 'vitest'
import {
  formatSessionWhen,
  formatTile,
  playSeats,
  summarizeSession,
  toMemberSessions,
} from '@/lib/member-home/sessions-view'
import type { MemberSession, MemberSessionPlay } from '@/lib/member-sessions'

const play = (over: Partial<MemberSessionPlay> = {}): MemberSessionPlay => ({
  id: 'p1',
  gameName: 'Game',
  imageUrl: null,
  yearPublished: 0,
  slug: null,
  startsAt: '2026-10-02T14:00:00Z',
  endsAt: null,
  place: null,
  participantCount: 0,
  capacity: 4,
  minParticipants: null,
  organizerName: null,
  ludoyaUrl: 'https://ludoya.test/p1',
  visibility: 'PUBLIC',
  coverUrl: null,
  ...over,
})

const session = (over: Partial<MemberSession> = {}): MemberSession => ({
  id: 's1',
  title: 'Session',
  description: '',
  startsAt: '2026-10-02T14:00:00Z',
  endsAt: '2026-10-02T18:30:00Z',
  timeZone: 'Europe/Madrid',
  imageUrl: null,
  thumbnailUrl: null,
  plannedPlayCount: 0,
  ludoyaUrl: 'https://ludoya.test/s1',
  type: 'regular',
  visibility: 'PUBLIC',
  place: null,
  participantCount: 0,
  capacity: null,
  minParticipants: null,
  queuedParticipantCount: null,
  organizerName: null,
  plannedPlays: [],
  ...over,
})

describe('playSeats', () => {
  it.each([
    [{ participantCount: 1, capacity: 4 }, 'free', 3],
    [{ participantCount: 3, capacity: 4 }, 'last', 1],
    [{ participantCount: 4, capacity: 4 }, 'full', 0],
    [{ participantCount: 6, capacity: 4 }, 'full', 0],
  ] as const)('%j is %s', (input, kind, free) => {
    expect(playSeats(input)).toMatchObject({ kind, free })
  })

  it('has no limit and no free count when capacity is null', () => {
    expect(playSeats({ participantCount: 6, capacity: null })).toEqual({
      kind: 'unlimited',
      taken: 6,
      capacity: null,
      free: null,
    })
  })
})

describe('summarizeSession', () => {
  it('sums free seats over all plays', () => {
    const s = session({ plannedPlays: [play({ participantCount: 1 }), play({ id: 'p2', participantCount: 4 })] })
    expect(summarizeSession(s)).toEqual({ playCount: 2, availability: { kind: 'seats', free: 3 } })
  })

  it('reports all full only when every limited play is full', () => {
    const s = session({ plannedPlays: [play({ participantCount: 4 }), play({ id: 'p2', participantCount: 4 })] })
    expect(summarizeSession(s).availability).toEqual({ kind: 'all_full' })
  })

  it('reports unlimited when nothing limited is free but a play has no limit', () => {
    const s = session({ plannedPlays: [play({ participantCount: 4 }), play({ id: 'p2', capacity: null })] })
    expect(summarizeSession(s).availability).toEqual({ kind: 'unlimited' })
  })

  it('handles a session without plays', () => {
    expect(summarizeSession(session())).toEqual({ playCount: 0, availability: { kind: 'none' } })
  })
})

describe('toMemberSessions', () => {
  it('keeps public and group-only sessions and plays', () => {
    const result = toMemberSessions([
      session({ id: 'a', plannedPlays: [play({ id: 'x' }), play({ id: 'y', visibility: 'ONLY_GROUP' })] }),
      session({ id: 'b', visibility: 'ONLY_GROUP' }),
    ])
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
    expect(result[0].plannedPlays.map((p) => p.id)).toEqual(['x', 'y'])
  })

  it('drops any other visibility defensively', () => {
    const odd = { ...session({ id: 'c' }), visibility: 'PRIVATE' } as unknown as ReturnType<typeof session>
    expect(toMemberSessions([odd])).toEqual([])
  })
})

describe('date formatting (Europe/Madrid)', () => {
  it('formats the tile and the when-line in Catalan', () => {
    expect(formatTile('2026-10-02T14:00:00Z', 'ca')).toEqual({ weekday: 'DV', day: '2' })
    const when = formatSessionWhen({ startsAt: '2026-10-02T14:00:00Z', endsAt: '2026-10-02T18:30:00Z' }, 'ca')
    expect(when).toMatch(/^Divendres 2 d.octubre · 16:00 – 20:30$/)
  })

  it('uses the Madrid day, not the UTC one', () => {
    expect(formatTile('2026-10-02T22:30:00Z', 'en').day).toBe('3')
  })

  it('names the end day when the session spans several days', () => {
    const when = formatSessionWhen({ startsAt: '2026-11-28T09:00:00Z', endsAt: '2026-11-29T16:00:00Z' }, 'en')
    expect(when).toContain('·')
    expect(when).toMatch(/10:00 – 29 Nov 17:00$/)
  })
})
