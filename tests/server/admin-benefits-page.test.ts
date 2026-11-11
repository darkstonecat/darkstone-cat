import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({ getAlternates: vi.fn(() => ({ canonical: 'x' })) }))
vi.mock('@/components/admin/benefits/BenefitList', () => ({ default: () => null }))

import AdminBenefitsPage, { dynamic, generateMetadata } from '@/app/[locale]/admin/benefits/page'

const ROW = { id: 'b1', name: { ca: 'Outlet Games' }, archived_at: null }

function session(answer: { data: unknown; error: { code: string } | null }) {
  const rpc = vi.fn(() => Promise.resolve(answer))
  mocks.createClient.mockResolvedValue({ rpc })
  return rpc
}

const render = () => AdminBenefitsPage({ params: Promise.resolve({ locale: 'ca' }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
})

describe('admin benefits page (S7)', () => {
  it('is dynamic and noindex', async () => {
    expect(dynamic).toBe('force-dynamic')
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'ca' }) })
    expect(meta.robots).toEqual({ index: false, follow: false })
    expect(meta.title).toBe('admin_benefits_title')
  })

  it('guards with board and reads admin_list_benefits with the session client', async () => {
    const rpc = session({ data: [ROW], error: null })
    const element: any = await render()
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/benefits')
    expect(rpc).toHaveBeenCalledWith('admin_list_benefits', {})
    expect(element.props.benefits).toEqual([ROW])
    expect(element.props.loadError).toBe(false)
  })

  it('renders an empty list with the load error, logging only the code', async () => {
    session({ data: null, error: { code: '42501' } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const element: any = await render()
    expect(element.props.benefits).toEqual([])
    expect(element.props.loadError).toBe(true)
    expect(log).toHaveBeenCalledWith(expect.any(String), '42501')
    log.mockRestore()
  })
})
