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
vi.mock('@/components/admin/member-file/MemberFile', () => ({ default: () => null }))

import AdminMemberFilePage from '@/app/[locale]/admin/members/[number]/page'

const member = (over: Record<string, unknown> = {}) => ({ id: 'uuid-1', member_number: '000-203', state: 'active', ...over })

function session(opts: { member?: unknown[]; memberError?: { code: string }; activity?: unknown[] }) {
  const rpc = vi.fn((name: string) => {
    if (name === 'admin_get_member') {
      return Promise.resolve({ data: opts.member ?? [], error: opts.memberError ?? null })
    }
    return Promise.resolve({ data: opts.activity ?? [], error: null })
  })
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = (number: string, search: Record<string, string> = {}) =>
  AdminMemberFilePage({
    params: Promise.resolve({ locale: 'ca', number }),
    searchParams: Promise.resolve(search),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
})

describe('admin member file page', () => {
  it.each(['', 'a'.repeat(33), '000/203', '..%2F', '000 203'])(
    'is a 404 for the invalid number %j without a guard or database call',
    async (number) => {
      const rpc = session({})
      await expect(render(number)).rejects.toThrow('NEXT_NOT_FOUND')
      expect(mocks.requireRole).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    }
  )

  it('guards with board and a return path, then asks admin_get_member with the number', async () => {
    const rpc = session({ member: [member()] })
    await render('000-203')
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/members/000-203')
    expect(rpc).toHaveBeenCalledWith('admin_get_member', { p_member_number: '000-203' })
    expect(rpc).toHaveBeenCalledWith('admin_list_activity', { p_target: 'uuid-1', p_limit: 5 })
  })

  it('is a 404 when the RPC returns zero rows (unknown, purged or unconfirmed)', async () => {
    const rpc = session({ member: [] })
    await expect(render('999-999')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(rpc).not.toHaveBeenCalledWith('admin_list_activity', expect.anything())
  })

  it('is a 404 when the RPC fails, logging only the code', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    session({ memberError: { code: '42501' } })
    await expect(render('000-203')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(spy).toHaveBeenCalledWith(expect.any(String), '42501')
    spy.mockRestore()
  })

  it('lets a board member export an active member but not a former one; a superadmin both', async () => {
    session({ member: [member({ state: 'former' })] })
    let element: any = await render('000-203')
    expect(element.props.canExportData).toBe(false)

    mocks.requireRole.mockResolvedValue({ id: 'u2', role: 'superadmin' })
    element = await render('000-203')
    expect(element.props.canExportData).toBe(true)

    mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
    session({ member: [member()] })
    element = await render('000-203')
    expect(element.props.canExportData).toBe(true)
  })

  it('passes the signed-in id so the file can block a self-baixa', async () => {
    session({ member: [member()] })
    const element: any = await render('000-203')
    expect(element.props.viewerId).toBe('u1')
  })

  it('lets only a superadmin reveal a former member\'s DNI', async () => {
    session({ member: [member({ state: 'former' })] })
    let element: any = await render('000-203')
    expect(element.props.canRevealFormerDni).toBe(false)

    mocks.requireRole.mockResolvedValue({ id: 'u2', role: 'superadmin' })
    element = await render('000-203')
    expect(element.props.canRevealFormerDni).toBe(true)
    mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
  })

  it('validates the back link through the list whitelist', async () => {
    session({ member: [member()] })
    let element: any = await render('000-203', { list: 'state=former&q=laia' })
    expect(element.props.backHref).toBe('/admin/members?state=former&q=laia')
    element = await render('000-203', { list: 'https://evil.example' })
    expect(element.props.backHref).toBe('/admin/members')
  })

  it('still renders when the activity query fails', async () => {
    const rpc = vi.fn((name: string) =>
      Promise.resolve(
        name === 'admin_get_member'
          ? { data: [member()], error: null }
          : { data: null, error: { code: 'XX000' } }
      )
    )
    mocks.createClient.mockResolvedValue({ rpc })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const element: any = await render('000-203')
    expect(element.props.activity).toEqual([])
  })
})
