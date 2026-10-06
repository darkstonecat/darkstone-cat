import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => {
  throw new Error('the dashboard must not use the service-role client')
})
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({
  getAlternates: vi.fn(() => ({ canonical: 'x' })),
  getBreadcrumbJsonLd: vi.fn(() => ({})),
  getWebPageJsonLd: vi.fn(() => ({})),
}))
vi.mock('@/components/admin/overview/AdminOverview', () => ({ default: () => null }))

import AdminPage from '@/app/[locale]/admin/page'

const stats = {
  active_members: 5,
  former_members: 1,
  joined_this_month: 2,
  left_this_month: 0,
  left_this_month_self: 0,
  left_this_month_board: 0,
  rejoined_this_year: 0,
  newsletter_members: 3,
  board_members: 2,
  superadmins: 1,
}

function session(opts: { stats?: unknown; statsError?: { code: string }; activity?: unknown[]; activityError?: { code: string } } = {}) {
  const rpc = vi.fn((name: string) => {
    if (name === 'admin_stats') {
      return Promise.resolve(opts.statsError ? { data: null, error: opts.statsError } : { data: opts.stats ?? [stats], error: null })
    }
    return Promise.resolve(opts.activityError ? { data: null, error: opts.activityError } : { data: opts.activity ?? [], error: null })
  })
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = () => AdminPage({ params: Promise.resolve({ locale: 'ca' }) })
const overview = (element: any) => element.props.children[1]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
})

describe('admin overview page', () => {
  it('requires board before touching the database', async () => {
    mocks.requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    const rpc = session()
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reads admin_stats and the last 10 entries through the session client', async () => {
    const rpc = session({ activity: [{ id: 1 }] })
    const element: any = await render()
    expect(rpc).toHaveBeenCalledWith('admin_stats')
    expect(rpc).toHaveBeenCalledWith('admin_list_activity', { p_limit: 10 })
    expect(overview(element).props.stats).toEqual(stats)
    expect(overview(element).props.activity).toEqual([{ id: 1 }])
  })

  it('passes an empty activity list through as empty, not as an error', async () => {
    session({ activity: [] })
    expect(overview(await render()).props.activity).toEqual([])
  })

  it('flags each failure separately, logging only the code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    session({ statsError: { code: '42501' }, activityError: { code: 'XX000' } })
    const element: any = await render()
    expect(overview(element).props.stats).toBeNull()
    expect(overview(element).props.activity).toBeNull()
    expect(spy).toHaveBeenCalledWith('[admin/overview] stats failed code=%s', '42501')
    expect(spy).toHaveBeenCalledWith('[admin/overview] activity failed code=%s', 'XX000')
    spy.mockRestore()
  })

  it('treats an unusable stats answer as a failure', async () => {
    session({ stats: [{ active_members: 'many' }] })
    expect(overview(await render()).props.stats).toBeNull()
  })
})
