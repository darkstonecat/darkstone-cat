import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({
  getAlternates: vi.fn(() => ({ canonical: 'x' })),
  getBreadcrumbJsonLd: vi.fn(() => ({})),
  getWebPageJsonLd: vi.fn(() => ({})),
}))
vi.mock('@/components/admin/activity/ActivityList', () => ({ default: () => null, ActivityLoadError: () => null }))
vi.mock('@/components/admin/activity/ActivityFilters', () => ({ default: () => null }))

import AdminActivityPage from '@/app/[locale]/admin/activity/page'

const entry = (id: number) => ({ id, created_at: '2026-10-05T08:00:00Z', action: 'member.update', total_count: 60 })

function session(opts: { activity?: unknown[]; activityError?: { code: string }; actorsError?: { code: string } } = {}) {
  const rpc = vi.fn((name: string, args: any) => {
    if (name === 'admin_list_activity') {
      return Promise.resolve(opts.activityError ? { data: null, error: opts.activityError } : { data: opts.activity ?? [], error: null })
    }
    if (opts.actorsError) return Promise.resolve({ data: null, error: opts.actorsError })
    return Promise.resolve({
      data: [{ id: args.p_role === 'board' ? 'b1' : 's1', first_name: args.p_role, last_name: 'X', member_number: '000-001' }],
      error: null,
    })
  })
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = (search: Record<string, string | string[]> = {}) =>
  AdminActivityPage({ params: Promise.resolve({ locale: 'ca' }), searchParams: Promise.resolve(search) })
const body = (element: any) => element.props.children[1].props.children

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
})

describe('admin activity page', () => {
  it('guards with board and a return path before any database call', async () => {
    mocks.requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    const rpc = session()
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/activity')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends only sanitised filters to admin_list_activity through the session client', async () => {
    const rpc = session()
    await render({ action: "member.update' or 1=1", actor: 'nobody', target: '000/1', from: '2026-02-30', before: 'x' })
    expect(rpc).toHaveBeenCalledWith('admin_list_activity', {
      p_action: null,
      p_actor: null,
      p_actor_kind: null,
      p_target_number: null,
      p_from: null,
      p_to: null,
      p_limit: 26,
      p_before_id: null,
    })
  })

  it('passes valid filters through', async () => {
    const rpc = session()
    await render({ action: 'badge.*', actor: 'system', target: '000-203', from: '2026-10-01', to: '2026-10-05', before: '99' })
    expect(rpc).toHaveBeenCalledWith(
      'admin_list_activity',
      expect.objectContaining({
        p_action: 'badge.*',
        p_actor_kind: 'system',
        p_target_number: '000-203',
        p_from: '2026-09-30T22:00:00.000Z',
        p_to: '2026-10-05T22:00:00.000Z',
        p_before_id: 99,
      })
    )
  })

  it('shows 25 rows and a next page when the RPC returns the extra one', async () => {
    session({ activity: Array.from({ length: 26 }, (_, i) => entry(100 - i)) })
    const [, , list]: any[] = body(await render())
    expect(list.props.rows).toHaveLength(25)
    expect(list.props.hasMore).toBe(true)
    expect(list.props.total).toBe(60)
  })

  it('has no next page with 25 rows or fewer', async () => {
    session({ activity: Array.from({ length: 25 }, (_, i) => entry(100 - i)) })
    const [, , list]: any[] = body(await render())
    expect(list.props.rows).toHaveLength(25)
    expect(list.props.hasMore).toBe(false)
  })

  it('lists board members and superadmins once for the Qui select', async () => {
    session()
    const [, filters]: any[] = body(await render())
    expect(filters.props.actors.map((a: any) => a.id).sort()).toEqual(['b1', 's1'])
  })

  it('renders the error state when the log fails, logging only the code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    session({ activityError: { code: '42501' } })
    const [, , content]: any[] = body(await render())
    expect(content.props.query).toBeDefined()
    expect(content.props.rows).toBeUndefined()
    expect(spy).toHaveBeenCalledWith('[admin/activity] list failed code=%s', '42501')
    spy.mockRestore()
  })

  it('still renders when the actor list fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    session({ actorsError: { code: 'XX000' } })
    const [, filters]: any[] = body(await render())
    expect(filters.props.actors).toEqual([])
    expect(spy).toHaveBeenCalledWith('[admin/activity] actors failed code=%s', 'XX000')
    spy.mockRestore()
  })
})
