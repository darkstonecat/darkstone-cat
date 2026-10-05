import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const guard = vi.hoisted(() => ({
  getAdminAccess: vi.fn(),
}))
const gen = vi.hoisted(() => ({
  fetchUpcomingEvents: vi.fn(),
  fetchBggCollection: vi.fn(),
  generateEventImage: vi.fn(),
  composeEventImage: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => guard)
vi.mock('@/lib/ludoya', () => ({ fetchUpcomingEvents: gen.fetchUpcomingEvents }))
vi.mock('@/lib/bgg', () => ({ fetchBggCollection: gen.fetchBggCollection }))
vi.mock('@/lib/event-image/generator', () => ({ generateEventImage: gen.generateEventImage }))
vi.mock('@/lib/event-image/composer', () => ({ composeEventImage: gen.composeEventImage }))

import { GET as getEventImage } from '@/app/api/events/[eventId]/image/route'
import { GET as getTestImage } from '@/app/api/test-image/[count]/route'

const eventCtx = (eventId: string) => ({ params: Promise.resolve({ eventId }) })
const countCtx = (count: string) => ({ params: Promise.resolve({ count }) })
const req = new Request('http://localhost/x')

describe('GET /api/events/[eventId]/image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gen.fetchUpcomingEvents.mockResolvedValue({
      regularEvents: [{ id: 'e1' }],
      specialEvents: [],
    })
    gen.fetchBggCollection.mockResolvedValue({ games: [] })
    gen.generateEventImage.mockResolvedValue(new Response('png'))
  })

  it('returns 401 without a session and does no work', async () => {
    guard.getAdminAccess.mockResolvedValue({ status: 'unauthenticated' })
    const res = await getEventImage(req, eventCtx('e1'))
    expect(res.status).toBe(401)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(gen.fetchUpcomingEvents).not.toHaveBeenCalled()
  })

  it('returns 403 for a signed-in non-board member and does no work', async () => {
    guard.getAdminAccess.mockResolvedValue({ status: 'forbidden' })
    const res = await getEventImage(req, eventCtx('e1'))
    expect(res.status).toBe(403)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(gen.generateEventImage).not.toHaveBeenCalled()
  })

  it('renders the image for a board member', async () => {
    guard.getAdminAccess.mockResolvedValue({ status: 'ok', actor: { id: 'u1', role: 'board' } })
    const res = await getEventImage(req, eventCtx('e1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(gen.generateEventImage).toHaveBeenCalledTimes(1)
  })

  it('asks the guard for the board level', async () => {
    guard.getAdminAccess.mockResolvedValue({ status: 'forbidden' })
    await getEventImage(req, eventCtx('e1'))
    expect(guard.getAdminAccess).toHaveBeenCalledWith('board')
  })

  it('returns 404 for an unknown event (board)', async () => {
    guard.getAdminAccess.mockResolvedValue({ status: 'ok', actor: { id: 'u1', role: 'superadmin' } })
    expect((await getEventImage(req, eventCtx('nope'))).status).toBe(404)
  })
})

describe('GET /api/test-image/[count]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    gen.composeEventImage.mockResolvedValue(new Response('png'))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is a 404 in production and renders nothing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await getTestImage(req, countCtx('3'))
    expect(res.status).toBe(404)
    expect(gen.composeEventImage).not.toHaveBeenCalled()
  })

  it('still renders in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const res = await getTestImage(req, countCtx('3'))
    expect(res.status).toBe(200)
    expect(gen.composeEventImage).toHaveBeenCalledTimes(1)
  })
})
