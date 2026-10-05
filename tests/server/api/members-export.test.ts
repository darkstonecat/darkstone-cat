import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((text: string) => `decrypted:${text}`),
}))

import { GET } from '@/app/api/admin/members/export/route'

function setupMock(opts: {
  user?: { id: string } | null
  member?: { role: string; left_on?: string | null } | null
  rpcData?: unknown[] | null
  rpcError?: { message: string } | null
}) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user ?? null },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: opts.member ?? null,
          }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({
      data: opts.rpcData ?? null,
      error: opts.rpcError ?? null,
    }),
  }
  vi.mocked(createClient).mockResolvedValue(client as any)
  return client
}

const fakeMember = {
  member_number: 'DS-001',
  first_name: 'Test',
  last_name: 'User',
  email: 'test@test.com',
  phone_encrypted: 'enc_phone',
  dni_nie_encrypted: 'enc_dni',
  postal_code: '08221',
  ludoya_username: null,
  bgg_username: null,
  role: 'member',
  newsletter_accepted: true,
  membership_start_date: '2026-01-01',
  created_at: '2026-01-01',
}

describe('GET /api/admin/members/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(decrypt).mockImplementation((t: string) => `decrypted:${t}`)
  })

  it('returns 401 when not authenticated', async () => {
    setupMock({ user: null })
    expect((await GET()).status).toBe(401)
  })

  it('returns 403 when user is not a board member', async () => {
    setupMock({ user: { id: 'u1' }, member: { role: 'member', left_on: null } })
    expect((await GET()).status).toBe(403)
  })

  it('returns 403 for a former member who still holds a role', async () => {
    setupMock({ user: { id: 'u1' }, member: { role: 'board', left_on: '2026-09-01' }, rpcData: [] })
    expect((await GET()).status).toBe(403)
  })

  it('returns 403 for an unknown role', async () => {
    setupMock({ user: { id: 'u1' }, member: { role: 'owner', left_on: null }, rpcData: [] })
    expect((await GET()).status).toBe(403)
  })

  it.each(['board', 'superadmin', 'admin'])('exports for an active %s', async (role) => {
    setupMock({ user: { id: 'u1' }, member: { role, left_on: null }, rpcData: [fakeMember] })
    expect((await GET()).status).toBe(200)
  })

  it('returns CSV with BOM and correct headers for admin', async () => {
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcData: [fakeMember],
    })
    const res = await GET()
    expect(res.status).toBe(200)

    // Check BOM via raw bytes (Response.text() strips it)
    const buffer = await res.clone().arrayBuffer()
    const bytes = new Uint8Array(buffer)
    expect(bytes[0]).toBe(0xef) // UTF-8 BOM: EF BB BF
    expect(bytes[1]).toBe(0xbb)
    expect(bytes[2]).toBe(0xbf)

    const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer)
    expect(body).toContain('Número,Nom,Cognoms')
    expect(body).toContain('DS-001')
    expect(body).toContain('decrypted:enc_phone')
  })

  it('sets correct Content-Type, Disposition, Cache-Control', async () => {
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcData: [],
    })
    const res = await GET()
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /attachment; filename="darkstone_members_\d{4}-\d{2}-\d{2}\.csv"/
    )
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('escapes CSV fields with commas and quotes', async () => {
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcData: [
        {
          ...fakeMember,
          first_name: 'Name, With Comma',
          last_name: 'Has "Quotes"',
        },
      ],
    })
    const csv = await (await GET()).text()
    expect(csv).toContain('"Name, With Comma"')
    expect(csv).toContain('"Has ""Quotes"""')
  })

  it('neutralises formula injection in member-controlled cells', async () => {
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcData: [
        { ...fakeMember, first_name: '=HYPERLINK("http://evil.test")', last_name: '@SUM(A1)' },
      ],
    })
    const csv = await (await GET()).text()
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.test"")"`)
    expect(csv).toContain("'@SUM(A1)")
  })

  it('logs one audit line with the user id and row count only', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcData: [fakeMember, fakeMember],
    })
    await GET()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('[admin-export] user=%s rows=%d', 'u1', 2)
    info.mockRestore()
  })

  it('handles decryption errors gracefully (empty cells)', async () => {
    vi.mocked(decrypt).mockImplementation(() => {
      throw new Error('decrypt failed')
    })
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcData: [
        { ...fakeMember, phone_encrypted: 'bad', dni_nie_encrypted: 'bad' },
      ],
    })
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('returns 500 on RPC error', async () => {
    setupMock({
      user: { id: 'u1' },
      member: { role: 'admin' },
      rpcError: { message: 'function not found' },
    })
    expect((await GET()).status).toBe(500)
  })
})
