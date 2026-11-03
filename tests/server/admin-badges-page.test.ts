import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({ getAlternates: vi.fn(() => ({ canonical: 'x' })) }))
vi.mock('@/components/admin/badges/BadgeCatalogue', () => ({ default: () => null }))

import AdminBadgesPage, { dynamic, generateMetadata } from '@/app/[locale]/admin/badges/page'

const ROW = { key: 'ludoteca_donor', name: { ca: 'Donant de la ludoteca' }, archived_at: null }

function session(answer: { data: unknown; error: { code: string } | null }) {
  const rpc = vi.fn(() => Promise.resolve(answer))
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = () => AdminBadgesPage({ params: Promise.resolve({ locale: 'ca' }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
})

describe('admin badges page (S7.2)', () => {
  it('is dynamic and noindex', async () => {
    expect(dynamic).toBe('force-dynamic')
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'ca' }) })
    expect(meta.robots).toEqual({ index: false, follow: false })
    expect(meta.title).toBe('admin_badges_title')
  })

  it('guards with board and reads admin_list_badges with the session client', async () => {
    const rpc = session({ data: [ROW], error: null })
    const element: any = await render()
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/badges')
    expect(rpc).toHaveBeenCalledWith('admin_list_badges', {})
    expect(element.props.badges).toEqual([ROW])
    expect(element.props.isSuperadmin).toBe(false)
    expect(element.props.loadError).toBe(false)
  })

  it('tells the catalogue a superadmin is looking (delete)', async () => {
    session({ data: [ROW], error: null })
    mocks.requireRole.mockResolvedValue({ id: 'u2', role: 'superadmin' })
    const element: any = await render()
    expect(element.props.isSuperadmin).toBe(true)
  })

  it('renders an empty list with the load error, logging only the code', async () => {
    session({ data: null, error: { code: '42501' } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element: any = await render()
    expect(element.props.badges).toEqual([])
    expect(element.props.loadError).toBe(true)
    expect(log).toHaveBeenCalledWith(expect.any(String), '42501')
    log.mockRestore()
  })
})
