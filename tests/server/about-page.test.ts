import { describe, it, expect, vi } from 'vitest'
import { Suspense, isValidElement, type ReactElement, type ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  fetchBggCollectionCount: vi.fn(() => new Promise<never>(() => {})),
  fetchActiveMemberCount: vi.fn(() => new Promise<never>(() => {})),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/bgg', () => ({ fetchBggCollectionCount: mocks.fetchBggCollectionCount }))
vi.mock('@/lib/supabase/member-count', () => ({ fetchActiveMemberCount: mocks.fetchActiveMemberCount }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({
  getAlternates: vi.fn(() => ({ canonical: 'x' })),
  getOgImageUrl: vi.fn(() => 'x'),
  getBreadcrumbJsonLd: vi.fn(() => ({})),
  getWebPageJsonLd: vi.fn(() => ({})),
  serializeJsonLd: (data: unknown) => JSON.stringify(data),
}))

import AboutPage from '@/app/[locale]/about/page'
import AboutStats from '@/components/about/AboutStats'
import AboutStatsLoader from '@/components/about/AboutStatsLoader'

function find(node: ReactNode, match: (el: ReactElement) => boolean): ReactElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement(node)) return undefined
  if (match(node)) return node
  return find((node.props as { children?: ReactNode }).children, match)
}

describe('about page', () => {
  it('renders without waiting for the game and member counts', async () => {
    // Both counts never resolve: a page that awaited them would never return.
    const page = await AboutPage({ params: Promise.resolve({ locale: 'ca' }) })

    const boundary = find(page, (el) => el.type === Suspense)
    expect(boundary).toBeDefined()
    const props = boundary!.props as { fallback: ReactElement; children: ReactElement }
    expect(props.children.type).toBe(AboutStatsLoader)
    // The fallback is the stats section with its default texts ("150+" and the games text).
    expect(props.fallback.type).toBe(AboutStats)
    expect(props.fallback.props).toEqual({ gameCount: 0, memberCount: null })
  })
})
