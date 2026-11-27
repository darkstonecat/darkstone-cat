import { describe, it, expect, vi } from 'vitest'
import { Suspense, isValidElement, type ReactElement, type ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  loadEventsPageData: vi.fn(() => new Promise<never>(() => {})),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/events/page-data', () => ({ loadEventsPageData: mocks.loadEventsPageData }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({
  getAlternates: vi.fn(() => ({ canonical: 'x' })),
  getOgImageUrl: vi.fn(() => 'x'),
  getBreadcrumbJsonLd: vi.fn(() => ({})),
  getWebPageJsonLd: vi.fn(() => ({})),
  serializeJsonLd: (data: unknown) => JSON.stringify(data),
}))

import EventsPage from '@/app/[locale]/events/page'
import EventsHeader from '@/components/events/EventsHeader'
import HowItWorks from '@/components/events/HowItWorks'
import { EventsBanners, EventsMain, EventsSidebarCalendar } from '@/components/events/EventsContent'
import { BannerSkeleton, CalendarSkeleton, TimelineSkeleton } from '@/components/events/EventsSkeletons'

function findAll(node: ReactNode, match: (el: ReactElement) => boolean, out: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findAll(child, match, out)
    return out
  }
  if (!isValidElement(node)) return out
  if (match(node)) out.push(node)
  const props = node.props as Record<string, unknown>
  findAll(props.children as ReactNode, match, out)
  // EventsHeader takes the banner boundary as a prop.
  if (isValidElement(props.banners)) findAll(props.banners as ReactNode, match, out)
  return out
}

describe('events page', () => {
  it('renders the static parts without waiting for Ludoya and streams the rest', async () => {
    // The data never resolves: a page that awaited it would never return.
    const page = await EventsPage({ params: Promise.resolve({ locale: 'es' }) })

    expect(mocks.loadEventsPageData).toHaveBeenCalledTimes(1)
    expect(mocks.loadEventsPageData).toHaveBeenCalledWith('es', expect.any(Date))
    expect(findAll(page, (el) => el.type === EventsHeader)).toHaveLength(1)
    expect(findAll(page, (el) => el.type === HowItWorks)).toHaveLength(1)

    const boundaries = findAll(page, (el) => el.type === Suspense).map((el) => {
      const props = el.props as { fallback: ReactElement; children: ReactElement }
      return [props.children.type, props.fallback.type, props.children.props] as const
    })
    expect(boundaries.map(([child, fallback]) => [child, fallback])).toEqual([
      [EventsBanners, BannerSkeleton],
      [EventsSidebarCalendar, CalendarSkeleton],
      [EventsMain, TimelineSkeleton],
    ])
    // All three share the one data promise.
    const data = (boundaries[0][2] as { data: unknown }).data
    expect(data).toBeInstanceOf(Promise)
    for (const [, , props] of boundaries) expect((props as { data: unknown }).data).toBe(data)
  })
})
