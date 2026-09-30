import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from '@/app/api/members/card/route'

const TOKEN_A = '0123456789abcdef0123456789abcdef'
const TOKEN_B = 'fedcba9876543210fedcba9876543210'

function setupMock(opts: { user?: { id: string } | null; member?: Record<string, unknown> | null }) {
  const select = vi.fn()
  const eq = vi.fn()
  const single = vi.fn().mockResolvedValue({ data: opts.member ?? null })
  eq.mockReturnValue({ single })
  select.mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }) },
    from,
  } as any)
  return { from, select, eq }
}

const member = (token: string) => ({
  first_name: 'Test',
  last_name: 'Member',
  member_number: '000-042',
  membership_start_date: '2026-09-14',
  card_token: token,
})

async function pngSize(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  const view = new DataView(bytes.buffer)
  return {
    bytes,
    signature: Array.from(bytes.slice(0, 8)),
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

describe('GET /api/members/card', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    setupMock({ user: null })
    const res = await GET(new Request('http://localhost/api/members/card'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when the member row is missing', async () => {
    setupMock({ user: { id: 'u1' }, member: null })
    const res = await GET(new Request('http://localhost/api/members/card'))
    expect(res.status).toBe(404)
  })

  it('reads the card token of the signed-in member and returns a 1011x639 PNG download', async () => {
    const { select, eq } = setupMock({ user: { id: 'u1' }, member: member(TOKEN_A) })
    const res = await GET(new Request('http://localhost/api/members/card'))

    expect(select.mock.calls[0][0]).toContain('card_token')
    expect(eq).toHaveBeenCalledWith('id', 'u1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="carnet_Test_Member.png"')

    const png = await pngSize(res)
    expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect([png.width, png.height]).toEqual([1011, 639])
  })

  it('serves the preview inline with ?preview=1', async () => {
    setupMock({ user: { id: 'u1' }, member: member(TOKEN_A) })
    const res = await GET(new Request('http://localhost/api/members/card?preview=1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('content-disposition')).toBeNull()
  })

  it('renders a different image for a different card token (the QR depends on it)', async () => {
    setupMock({ user: { id: 'u1' }, member: member(TOKEN_A) })
    const a = await pngSize(await GET(new Request('http://localhost/api/members/card')))
    setupMock({ user: { id: 'u1' }, member: member(TOKEN_B) })
    const b = await pngSize(await GET(new Request('http://localhost/api/members/card')))
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(false)
  })
})
