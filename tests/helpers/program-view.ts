// Builders for the formatted event program (`ProgramView`) used by component tests.
import type { DayView, ItemView, ProgramView } from '@/lib/events/agenda-format'
import { countItems, type PlayItem, type ProgramItem } from '@/lib/events/program'

export const playView = (over: Partial<ItemView> = {}): PlayItem & { time: string | null } =>
  ({
    kind: 'play',
    id: 'p1',
    title: 'Emberleaf',
    gameName: 'Emberleaf',
    zone: null,
    coverUrl: 'https://img.test/emberleaf.jpg',
    startsAt: '2026-11-13T15:00:00Z',
    endsAt: null,
    placement: 'timed',
    participantCount: 3,
    capacity: 4,
    minParticipants: null,
    ludoyaUrl: 'https://ludoya.test/p1',
    time: '16:00',
    ...over,
  }) as PlayItem & { time: string | null }

export const tournamentView = (over: Partial<ItemView> = {}): ItemView =>
  playView({ kind: 'tournament', id: 't1', title: 'Torneig de Root', gameName: 'Root', format: 'SWISS', tickets: false, capacity: 16, ...over } as Partial<ItemView>)

export const activityView = (over: Partial<ItemView> = {}): ItemView =>
  ({
    kind: 'activity',
    id: 'a1',
    title: 'Pòdcast en directe',
    zone: null,
    coverUrl: null,
    startsAt: '2026-11-28T17:00:00Z',
    endsAt: '2026-11-28T19:00:00Z',
    placement: 'timed',
    ludoyaUrl: 'https://ludoya.test/a1',
    time: '18:00 – 20:00',
    ...over,
  }) as ItemView

export const demoView = (over: Partial<ItemView> = {}): ItemView =>
  ({
    kind: 'demo',
    id: 'd1',
    title: 'Fearsome Floors',
    zone: 'Demostracions de 2tomatoes',
    coverUrl: 'https://img.test/floors.jpg',
    startsAt: null,
    endsAt: null,
    placement: 'alwaysOpen',
    ludoyaUrl: 'https://ludoya.test/d1',
    time: null,
    ...over,
  }) as ItemView

export const dayView = (items: ItemView[], over: Partial<DayView> = {}): DayView => ({
  day: '2026-11-13',
  title: 'Divendres 13 de novembre',
  mode: 'grid',
  groups: [{ startsAt: null, time: null, items }],
  counts: countItems(items),
  ...over,
})

/** A program: the given days (or one grid day from `items`) plus always-open groups. */
export function programView(
  items: ItemView[],
  { days, alwaysOpen = [], multiDay = false }: { days?: DayView[]; alwaysOpen?: ProgramView['alwaysOpen']; multiDay?: boolean } = {}
): ProgramView {
  const dayList = days ?? (items.length > 0 ? [dayView(items)] : [])
  const all: ProgramItem[] = [...dayList.flatMap((d) => d.groups.flatMap((g) => g.items)), ...alwaysOpen.flatMap((g) => g.items)]
  return { multiDay, days: dayList, alwaysOpen, counts: countItems(all) }
}
