import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// The export reads through admin_export_members() with the SESSION client (T9a): the function
// checks the role and writes export.members_csv in the same transaction. The admin client
// must never be used here.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((text: string) => `decrypted:${text}`),
}))

import { GET } from '@/app/api/admin/members/export/route'

const URL_BASE = 'http://localhost:3000/api/admin/members/export'
const req = (query = '') => new Request(`${URL_BASE}${query}`)

function setupMock(opts: {
  user?: { id: string } | null
  member?: { role: string; left_on?: string | null } | null
  rpcData?: unknown[] | null
  rpcError?: { code?: string; message: string } | null
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
  return { client }
}

const fakeMember = {
  id: '11111111-2222-4333-8444-555555555555',
  member_number: '000-001',
  first_name: 'Test',
  last_name: 'User',
  email: 'test@test.com',
  phone_encrypted: 'enc_phone',
  dni_nie_encrypted: 'enc_dni',
  postal_code: '08221',
  ludoya_username: 'ludo',
  bgg_username: null,
  role: 'member',
  newsletter_accepted: true,
  membership_start_date: '2020-01-01',
  current_joined_on: '2025-06-10',
  created_at: '2020-01-01T10:00:00+00:00',
  total_rows: 1,
}

const rowsOf = (...rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, total_rows: rows.length }))

const board = { user: { id: 'u1' }, member: { role: 'board', left_on: null } }

async function bodyOf(res: Response) {
  const buffer = await res.arrayBuffer()
  return { bytes: new Uint8Array(buffer), text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer) }
}

describe('GET /api/admin/members/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(decrypt).mockImplementation((t: string) => `decrypted:${t}`)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('access', () => {
    it('returns 401 when not authenticated, without calling the export', async () => {
      const { client } = setupMock({ user: null })
      const res = await GET(req())
      expect(res.status).toBe(401)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('returns 403 for a plain member, without calling the export', async () => {
      const { client } = setupMock({ user: { id: 'u1' }, member: { role: 'member', left_on: null } })
      expect((await GET(req())).status).toBe(403)
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('returns 403 for a former member who still holds a role', async () => {
      setupMock({ user: { id: 'u1' }, member: { role: 'board', left_on: '2026-09-01' } })
      expect((await GET(req())).status).toBe(403)
    })

    it('returns 403 for an unknown role', async () => {
      setupMock({ user: { id: 'u1' }, member: { role: 'owner', left_on: null } })
      expect((await GET(req())).status).toBe(403)
    })

    it.each(['board', 'superadmin', 'admin'])('exports for an active %s', async (role) => {
      setupMock({ user: { id: 'u1' }, member: { role, left_on: null }, rpcData: rowsOf(fakeMember) })
      expect((await GET(req())).status).toBe(200)
    })

    it('maps a database refusal (42501) to 403', async () => {
      setupMock({ ...board, rpcError: { code: '42501', message: 'admin:forbidden: board role required' } })
      expect((await GET(req())).status).toBe(403)
    })
  })

  describe('database call', () => {
    it('reads through admin_export_members with the session client, never the admin client', async () => {
      const { client } = setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      expect((await GET(req())).status).toBe(200)
      expect(client.rpc).toHaveBeenCalledTimes(1)
      expect(client.rpc).toHaveBeenCalledWith('admin_export_members', { p_role: 'all' })
      expect(createAdminClient).not.toHaveBeenCalled()
    })

    it.each(['member', 'board', 'superadmin', 'all'])('passes the role filter %s', async (role) => {
      const { client } = setupMock({ ...board, rpcData: [] })
      expect((await GET(req(`?role=${role}`))).status).toBe(200)
      expect(client.rpc).toHaveBeenCalledWith('admin_export_members', { p_role: role })
    })

    it('accepts state=active, the only state the CSV holds', async () => {
      const { client } = setupMock({ ...board, rpcData: [] })
      expect((await GET(req('?state=active&role=board'))).status).toBe(200)
      expect(client.rpc).toHaveBeenCalledWith('admin_export_members', { p_role: 'board' })
    })

    it.each([
      '?state=former', // BR-21: blocked records are never exported
      '?state=all',
      '?role=admin',
      '?role=Board',
      '?role=',
      '?role=board&role=member',
      '?q=laia',
      '?sort=name_asc',
    ])('rejects %s with 400 before calling the database', async (query) => {
      const { client } = setupMock({ ...board, rpcData: [] })
      const res = await GET(req(query))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_filter' })
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('returns 500 on a database error and logs only the code', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      setupMock({ ...board, rpcError: { code: 'XX000', message: 'boom Laia 12345678Z' } })
      expect((await GET(req())).status).toBe(500)
      expect(JSON.stringify(error.mock.calls)).not.toContain('12345678Z')
      expect(JSON.stringify(error.mock.calls)).toContain('XX000')
    })

    it('refuses to serve a truncated response (fewer rows than the export counted)', async () => {
      setupMock({ ...board, rpcData: [{ ...fakeMember, total_rows: 1001 }] })
      expect((await GET(req())).status).toBe(500)
    })
  })

  describe('CSV', () => {
    it('returns CSV with BOM, the A-10 columns and decrypted DNI/phone', async () => {
      setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      const { bytes, text } = await bodyOf(await GET(req()))
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])

      const [header, row, ...rest] = text.slice(1).split('\n')
      expect(rest).toEqual([])
      expect(header).toBe(
        'Número,Nom,Cognoms,Email,Telèfon,DNI/NIE,CP,Ludoya,BGG,Rol,Newsletter,Primera alta,Alta actual,Creat'
      )
      expect(row).toBe(
        '000-001,Test,User,test@test.com,decrypted:enc_phone,decrypted:enc_dni,08221,ludo,,member,Sí,2020-01-01,2025-06-10,2020-01-01T10:00:00+00:00'
      )
    })

    it("decrypts each value with the row's own member id", async () => {
      const other = { ...fakeMember, id: '99999999-2222-4333-8444-555555555555', phone_encrypted: 'p2', dni_nie_encrypted: null }
      setupMock({ ...board, rpcData: rowsOf(fakeMember, other) })
      await GET(req())
      expect(decrypt).toHaveBeenCalledWith('enc_phone', fakeMember.id)
      expect(decrypt).toHaveBeenCalledWith('enc_dni', fakeMember.id)
      expect(decrypt).toHaveBeenCalledWith('p2', other.id)
      expect(decrypt).toHaveBeenCalledTimes(3)
    })

    it('sets Content-Type, Disposition and Cache-Control', async () => {
      setupMock({ ...board, rpcData: [] })
      const res = await GET(req())
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(res.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="darkstone_members_\d{4}-\d{2}-\d{2}\.csv"$/
      )
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    })

    it('names a role-filtered file after the filter', async () => {
      setupMock({ ...board, rpcData: [] })
      const res = await GET(req('?role=board'))
      expect(res.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="darkstone_members_board_\d{4}-\d{2}-\d{2}\.csv"$/
      )
    })

    it('an empty export has only the header line', async () => {
      setupMock({ ...board, rpcData: [] })
      const { text } = await bodyOf(await GET(req()))
      expect(text.slice(1).split('\n')).toHaveLength(1)
    })

    it('escapes CSV fields with commas and quotes', async () => {
      setupMock({
        ...board,
        rpcData: rowsOf({ ...fakeMember, first_name: 'Name, With Comma', last_name: 'Has "Quotes"' }),
      })
      const { text } = await bodyOf(await GET(req()))
      expect(text).toContain('"Name, With Comma"')
      expect(text).toContain('"Has ""Quotes"""')
    })

    it('neutralises formula injection in member-controlled cells', async () => {
      setupMock({
        ...board,
        rpcData: rowsOf({ ...fakeMember, first_name: '=HYPERLINK("http://evil.test")', last_name: '@SUM(A1)' }),
      })
      const { text } = await bodyOf(await GET(req()))
      expect(text).toContain(`"'=HYPERLINK(""http://evil.test"")"`)
      expect(text).toContain("'@SUM(A1)")
    })

    it('leaves a cell empty when a value cannot be decrypted', async () => {
      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error('decrypt failed')
      })
      setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      const res = await GET(req())
      expect(res.status).toBe(200)
      const { text } = await bodyOf(res)
      expect(text.split('\n')[1]).toContain('test@test.com,,,08221')
    })
  })

  describe('logs', () => {
    it('logs one line with the user id and row count only', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      setupMock({ ...board, rpcData: rowsOf(fakeMember, { ...fakeMember, id: '22222222-2222-4333-8444-555555555555' }) })
      await GET(req())
      expect(info).toHaveBeenCalledTimes(1)
      expect(info).toHaveBeenCalledWith('[admin-export] user=%s rows=%d', 'u1', 2)
    })

    it('never logs a decrypted value', async () => {
      const spies = (['info', 'log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
      setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      await GET(req())
      const logged = JSON.stringify(spies.map((s) => s.mock.calls))
      expect(logged).not.toContain('decrypted:')
      expect(logged).not.toContain('test@test.com')
    })
  })
})
