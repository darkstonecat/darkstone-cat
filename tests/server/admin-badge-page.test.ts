import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  requireRole: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@/lib/admin/guard', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({ getAlternates: vi.fn(() => ({ canonical: 'x' })) }))
vi.mock('@/components/admin/badges/BadgeDetail', () => ({ default: () => null }))

import AdminBadgePage, { dynamic, generateMetadata } from '@/app/[locale]/admin/badges/[key]/page'

const ROW = { key: 'ludoteca_donor', name: { ca: 'Donant de la ludoteca' }, archived_at: null }
const HOLDER = {
  member_id: 'id-1',
  member_number: '000-203',
  first_name: 'Laia',
  last_name: 'Serra',
  state: 'active',
  awarded_at: '2026-10-05T09:00:00Z',
}

function session(opts: { list?: unknown; listError?: { code: string }; holders?: unknown; holdersError?: { code: string } }) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve(
      name === 'admin_list_badges'
        ? { data: opts.list ?? [ROW], error: opts.listError ?? null }
        : { data: opts.holders ?? [HOLDER], error: opts.holdersError ?? null }
    )
  )
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = (key: string) => AdminBadgePage({ params: Promise.resolve({ locale: 'ca', key }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
})

describe('admin badge page (S7.3)', () => {
  it('is dynamic and noindex', async () => {
    expect(dynamic).toBe('force-dynamic')
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'ca', key: 'ludoteca_donor' }) })
    expect(meta.robots).toEqual({ index: false, follow: false })
    expect(meta.title).toBe('admin_badge_title')
  })

  it.each(['', 'ab', 'Ludoteca', '1abc', 'a'.repeat(49), 'bad-key', 'member_tenure', '..%2F'])(
    'is a 404 for the invalid key %j without a guard or database call',
    async (key) => {
      const rpc = session({})
      await expect(render(key)).rejects.toThrow('NEXT_NOT_FOUND')
      expect(mocks.requireRole).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    }
  )

  it('is a 404 for an unknown badge, without reading holders', async () => {
    const rpc = session({ list: [ROW] })
    await expect(render('no_such_badge')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/badges/no_such_badge')
    expect(rpc).not.toHaveBeenCalledWith('admin_list_badge_holders', expect.anything())
  })

  it('is a 404 when the list fails, logging only the code', async () => {
    session({ listError: { code: '42501' } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(render('ludoteca_donor')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(log).toHaveBeenCalledWith(expect.any(String), '42501')
    log.mockRestore()
  })

  it('passes the badge and its holders', async () => {
    const rpc = session({})
    const element: any = await render('ludoteca_donor')
    expect(rpc).toHaveBeenCalledWith('admin_list_badge_holders', { p_key: 'ludoteca_donor' })
    expect(element.props.badge).toEqual(ROW)
    expect(element.props.holders).toEqual([
      { memberId: 'id-1', memberNumber: '000-203', firstName: 'Laia', lastName: 'Serra', state: 'active', awardedAt: HOLDER.awarded_at },
    ])
    expect(element.props.holdersError).toBe(false)
  })

  it('still renders when the holders query fails', async () => {
    session({ holdersError: { code: 'XX000' } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element: any = await render('ludoteca_donor')
    expect(element.props.holders).toEqual([])
    expect(element.props.holdersError).toBe(true)
    log.mockRestore()
  })
})
