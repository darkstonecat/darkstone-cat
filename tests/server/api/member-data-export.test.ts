import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((text: string) => `decrypted:${text}`),
}))

import { GET } from '@/app/api/admin/members/[number]/data/route'

// A-11: GET /api/admin/members/<number>/data. Resolves the number with admin_get_member, then
// reads through admin_export_member_data (which writes export.member_data in the same
// transaction), both with the session client.

const MEMBER_ID = '11111111-2222-4333-8444-555555555555'

const dataRow = {
  id: MEMBER_ID,
  member_number: '000-203',
  state: 'active',
  email: 'laia@example.test',
  first_name: 'Laia',
  last_name: 'Serra',
  phone_encrypted: 'enc_phone',
  dni_nie_encrypted: 'enc_dni',
  postal_code: '08221',
  ludoya_username: 'laia_l',
  bgg_username: null,
  role: 'member',
  newsletter_accepted: true,
  membership_start_date: '2020-01-01',
  current_joined_on: '2025-06-10',
  left_on: null,
  left_by: null,
  leave_reason: null,
  created_at: '2020-01-01T10:00:00+00:00',
  badges: [{ key: 'ludoteca_donor', awarded_at: '2026-02-01T09:00:00+00:00' }],
}

type RpcResult = { data: unknown; error: { code?: string; message: string } | null }

function setupMock(opts: {
  user?: { id: string } | null
  member?: { role: string; left_on?: string | null } | null
  found?: RpcResult
  exported?: RpcResult
}) {
  const rpc = vi.fn((name: string) => {
    if (name === 'admin_get_member') return Promise.resolve(opts.found ?? { data: [{ id: MEMBER_ID }], error: null })
    if (name === 'admin_export_member_data') return Promise.resolve(opts.exported ?? { data: [dataRow], error: null })
    return Promise.resolve({ data: null, error: { code: '42883', message: 'unknown function' } })
  })
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: opts.member ?? null }),
        }),
      }),
    }),
    rpc,
  }
  vi.mocked(createClient).mockResolvedValue(client as any)
  return { client, rpc }
}

const board = { user: { id: 'u1' }, member: { role: 'board', left_on: null } }
const call = (number = '000-203') =>
  GET(new Request(`http://localhost:3000/api/admin/members/${number}/data`), {
    params: Promise.resolve({ number }),
  })

describe('GET /api/admin/members/[number]/data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(decrypt).mockImplementation((t: string) => `decrypted:${t}`)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('access', () => {
    it('returns 401 without a session and calls nothing', async () => {
      const { rpc } = setupMock({ user: null })
      const res = await call()
      expect(res.status).toBe(401)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(rpc).not.toHaveBeenCalled()
    })

    it('returns 403 for a plain member and calls nothing', async () => {
      const { rpc } = setupMock({ user: { id: 'u1' }, member: { role: 'member', left_on: null } })
      expect((await call()).status).toBe(403)
      expect(rpc).not.toHaveBeenCalled()
    })

    it('returns 403 when the database refuses (a board member on a former member, D-D)', async () => {
      setupMock({
        ...board,
        exported: { data: null, error: { code: '42501', message: "admin:forbidden: only a superadmin can export a former member's data" } },
      })
      expect((await call()).status).toBe(403)
    })
  })

  describe('lookup', () => {
    it('resolves the number, then exports by id, both with the session client', async () => {
      const { rpc } = setupMock(board)
      expect((await call()).status).toBe(200)
      expect(rpc).toHaveBeenNthCalledWith(1, 'admin_get_member', { p_member_number: '000-203' })
      expect(rpc).toHaveBeenNthCalledWith(2, 'admin_export_member_data', { p_member_id: MEMBER_ID })
      expect(createAdminClient).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown, purged or unconfirmed member number, without exporting', async () => {
      const { rpc } = setupMock({ ...board, found: { data: [], error: null } })
      const res = await call('000-999')
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
      expect(rpc).toHaveBeenCalledTimes(1)
    })

    it.each(['', 'a'.repeat(33), '000 203', '000-203;drop', '%00'])(
      'returns 404 for a malformed number %j without calling the database',
      async (number) => {
        const { rpc } = setupMock(board)
        expect((await call(number)).status).toBe(404)
        expect(rpc).not.toHaveBeenCalled()
      }
    )

    it('returns 404 when the member was purged between the lookup and the export', async () => {
      setupMock({ ...board, exported: { data: null, error: { code: '22023', message: 'admin:not_found: unknown member' } } })
      expect((await call()).status).toBe(404)
    })

    it('returns 500 on any other database error and logs only the code', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      setupMock({ ...board, exported: { data: null, error: { code: 'XX000', message: 'boom 12345678Z' } } })
      expect((await call()).status).toBe(500)
      expect(JSON.stringify(error.mock.calls)).not.toContain('12345678Z')
    })
  })

  describe('file', () => {
    it("serves the member's JSON as an attachment, never cached", async () => {
      setupMock(board)
      const res = await call()
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="darkstone-data-000-203.json"')
      expect(res.headers.get('Cache-Control')).toBe('no-store')

      const json = await res.json()
      // the keys of the member's own download, plus the membership fields the association holds
      expect(json).toEqual({
        email: 'laia@example.test',
        first_name: 'Laia',
        last_name: 'Serra',
        member_number: '000-203',
        phone: 'decrypted:enc_phone',
        dni: 'decrypted:enc_dni',
        postal_code: '08221',
        ludoya_username: 'laia_l',
        bgg_username: null,
        role: 'member',
        newsletter_accepted: true,
        membership_start_date: '2020-01-01',
        created_at: '2020-01-01T10:00:00+00:00',
        badges: [{ key: 'ludoteca_donor', awarded_at: '2026-02-01T09:00:00+00:00' }],
        current_joined_on: '2025-06-10',
        left_on: null,
        left_by: null,
        leave_reason: null,
        exported_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    })

    it("decrypts with the row's own member id", async () => {
      setupMock(board)
      await call()
      expect(decrypt).toHaveBeenCalledWith('enc_phone', MEMBER_ID)
      expect(decrypt).toHaveBeenCalledWith('enc_dni', MEMBER_ID)
    })

    it('gives null for a value that is not stored or cannot be decrypted', async () => {
      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error('decrypt failed')
      })
      setupMock({ ...board, exported: { data: [{ ...dataRow, phone_encrypted: null }], error: null } })
      const json = await (await call()).json()
      expect(json.phone).toBeNull()
      expect(json.dni).toBeNull()
      expect(decrypt).toHaveBeenCalledTimes(1)
    })

    it('exports a former member with whatever is still held', async () => {
      setupMock({
        ...board,
        exported: {
          data: [{ ...dataRow, state: 'former', email: null, phone_encrypted: null, postal_code: null, left_on: '2026-09-01', left_by: 'board', leave_reason: 'Compte duplicat', badges: [] }],
          error: null,
        },
      })
      const json = await (await call()).json()
      expect(json).toMatchObject({ email: null, phone: null, left_on: '2026-09-01', left_by: 'board', leave_reason: 'Compte duplicat', badges: [] })
    })
  })

  describe('logs', () => {
    it('logs the actor and the member id only, never a value', async () => {
      const spies = (['info', 'log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
      setupMock(board)
      await call()
      expect(spies[0]).toHaveBeenCalledWith('[admin-export] user=%s member_data=%s', 'u1', MEMBER_ID)
      const logged = JSON.stringify(spies.map((s) => s.mock.calls))
      expect(logged).not.toContain('decrypted:')
      expect(logged).not.toContain('laia@example.test')
      expect(logged).not.toContain('Serra')
    })
  })
})
