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
vi.mock('@/components/admin/roles/RolesContent', () => ({ default: () => null }))

import AdminRolesPage from '@/app/[locale]/admin/roles/page'

const row = (id: string, number: string, first: string) => ({ id, member_number: number, first_name: first, last_name: 'X' })

function session(lists: Record<string, unknown[] | { code: string }>) {
  const rpc = vi.fn((name: string, args: any) => {
    if (name === 'admin_list_members') {
      const list = lists[args.p_role]
      return Promise.resolve(Array.isArray(list) ? { data: list, error: null } : { data: null, error: list })
    }
    return Promise.resolve({ data: [{ role_since: '2026-09-14T09:00:00Z' }], error: null })
  })
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = () => AdminRolesPage({ params: Promise.resolve({ locale: 'ca' }) })
const content = (element: any) => element.props.children[1]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'su1', role: 'superadmin' })
})

describe('admin roles page', () => {
  it('requires superadmin before touching the database (a board member gets the 404)', async () => {
    mocks.requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    const rpc = session({})
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireRole).toHaveBeenCalledWith('superadmin', '/admin/roles')
    expect(rpc).not.toHaveBeenCalled()
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('lists active superadmins and board with their role_since through the session client', async () => {
    const rpc = session({
      superadmin: [row('a', '000-001', 'Marta')],
      board: [row('b', '000-002', 'Pau'), row('c', '000-003', 'Nuria')],
    })
    const element: any = await render()
    expect(rpc).toHaveBeenCalledWith('admin_list_members', expect.objectContaining({ p_state: 'active', p_role: 'superadmin' }))
    expect(rpc).toHaveBeenCalledWith('admin_list_members', expect.objectContaining({ p_state: 'active', p_role: 'board' }))
    const props = content(element).props
    expect(props.viewerId).toBe('su1')
    expect(props.loadError).toBe(false)
    expect(props.superadmins).toEqual([{ id: 'a', member_number: '000-001', name: 'Marta X', role_since: '2026-09-14T09:00:00Z' }])
    expect(props.board).toHaveLength(2)
  })

  it('flags a load error without throwing, logging only the code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    session({ superadmin: { code: '42501' }, board: [] })
    const element: any = await render()
    expect(content(element).props.loadError).toBe(true)
    expect(spy).toHaveBeenCalledWith('[admin/roles] list failed code=%s', '42501')
    spy.mockRestore()
  })
})
