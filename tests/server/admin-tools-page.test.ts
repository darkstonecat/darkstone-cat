import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
  fetchUpcomingEvents: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => {
  throw new Error('the tools pages must not use the service-role client')
})
vi.mock('@/lib/ludoya', () => ({ fetchUpcomingEvents: mocks.fetchUpcomingEvents }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn().mockResolvedValue((k: string) => k) }))
vi.mock('@/lib/seo', () => ({
  getAlternates: vi.fn(() => ({ canonical: 'x' })),
  getBreadcrumbJsonLd: vi.fn(() => ({})),
  getWebPageJsonLd: vi.fn(() => ({})),
}))
vi.mock('@/components/admin/tools/ToolsContent', () => ({ default: () => null }))
vi.mock('@/components/events/EventImagesContent', () => ({ default: () => null }))
vi.mock('@/i18n/routing', () => ({ Link: () => null }))

import ToolsPage from '@/app/[locale]/admin/tools/page'
import EventImagesPage from '@/app/[locale]/admin/tools/event-images/page'

const params = { params: Promise.resolve({ locale: 'ca' }) }
const toolsContent = (element: any) => element.props.children[1]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ id: 'u1', role: 'board' })
  mocks.fetchUpcomingEvents.mockResolvedValue({ regularEvents: [], specialEvents: [] })
})

describe('admin tools page', () => {
  it('requires board before touching the database', async () => {
    mocks.requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    const rpc = vi.fn()
    mocks.createClient.mockResolvedValue({ rpc })
    await expect(ToolsPage(params)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/tools')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reads admin_ops_status through the session client', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ job: 'ludoya', last_ok: true }], error: null })
    mocks.createClient.mockResolvedValue({ rpc })
    const element: any = await ToolsPage(params)
    expect(rpc).toHaveBeenCalledWith('admin_ops_status')
    expect(toolsContent(element).props.jobs.map((j: any) => j.job)).toEqual(['ludoya', 'bgg'])
    expect(toolsContent(element).props.jobs[0].lastOk).toBe(true)
  })

  it('passes null and logs only the code when the status fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'secret' } }) })
    const element: any = await ToolsPage(params)
    expect(toolsContent(element).props.jobs).toBeNull()
    expect(spy).toHaveBeenCalledWith('[admin/tools] ops_status failed code=%s', '42501')
    spy.mockRestore()
  })
})

describe('admin event images page', () => {
  it('requires board for its new path before loading events', async () => {
    mocks.requireRole.mockRejectedValue(new Error('NEXT_NOT_FOUND'))
    await expect(EventImagesPage(params)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireRole).toHaveBeenCalledWith('board', '/admin/tools/event-images')
    expect(mocks.fetchUpcomingEvents).not.toHaveBeenCalled()
  })

  it('renders for a board member', async () => {
    await expect(EventImagesPage(params)).resolves.toBeTruthy()
    expect(mocks.fetchUpcomingEvents).toHaveBeenCalled()
  })
})
