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

import { GET, POST } from '@/app/api/admin/members/export/route'
import { postJson } from '../../helpers/admin-route'

// T9b: POST with the filter in a JSON body and a same-origin Origin header (CSRF). GET is 405.
const URL_BASE = 'http://localhost:3000/api/admin/members/export'
const req = (body: unknown = {}, opts?: Parameters<typeof postJson>[2]) => postJson(URL_BASE, body, opts)
const call = (body: unknown = {}, opts?: Parameters<typeof postJson>[2]) => POST(req(body, opts))

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

describe('POST /api/admin/members/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(decrypt).mockImplementation((t: string) => `decrypted:${t}`)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('method and origin', () => {
    it('answers GET with 405 and Allow: POST, without touching the session', async () => {
      const { client } = setupMock(board)
      const res = await GET()
      expect(res.status).toBe(405)
      expect(res.headers.get('Allow')).toBe('POST')
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(await res.json()).toEqual({ error: 'method_not_allowed' })
      expect(client.auth.getUser).not.toHaveBeenCalled()
    })

    it.each([null, 'https://evil.com', 'https://darkstone.cat.evil.com', 'null'])(
      'refuses Origin %j with 403 forbidden_origin before the session or the database',
      async (origin) => {
        const { client } = setupMock({ ...board, rpcData: rowsOf(fakeMember) })
        const res = await call({}, { origin })
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ error: 'forbidden_origin' })
        expect(res.headers.get('Cache-Control')).toBe('no-store')
        expect(client.auth.getUser).not.toHaveBeenCalled()
        expect(client.rpc).not.toHaveBeenCalled()
      }
    )

    it.each(['https://darkstone.cat', 'https://www.darkstone.cat', 'http://localhost:3100'])(
      'accepts Origin %s (localhost outside production)',
      async (origin) => {
        setupMock({ ...board, rpcData: rowsOf(fakeMember) })
        expect((await call({}, { origin })).status).toBe(200)
      }
    )

    it('refuses the localhost origin in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      try {
        setupMock({ ...board, rpcData: rowsOf(fakeMember) })
        expect((await call({}, { origin: 'http://localhost:3000' })).status).toBe(403)
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  describe('access', () => {
    it('returns 401 when not authenticated, without calling the export', async () => {
      const { client } = setupMock({ user: null })
      const res = await call()
      expect(res.status).toBe(401)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('returns 403 for a plain member, without calling the export', async () => {
      const { client } = setupMock({ user: { id: 'u1' }, member: { role: 'member', left_on: null } })
      expect((await call()).status).toBe(403)
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('returns 403 for a former member who still holds a role', async () => {
      setupMock({ user: { id: 'u1' }, member: { role: 'board', left_on: '2026-09-01' } })
      expect((await call()).status).toBe(403)
    })

    it('returns 403 for an unknown role', async () => {
      setupMock({ user: { id: 'u1' }, member: { role: 'owner', left_on: null } })
      expect((await call()).status).toBe(403)
    })

    it.each(['board', 'superadmin', 'admin'])('exports for an active %s', async (role) => {
      setupMock({ user: { id: 'u1' }, member: { role, left_on: null }, rpcData: rowsOf(fakeMember) })
      expect((await call()).status).toBe(200)
    })

    it('maps a database refusal (42501) to 403', async () => {
      setupMock({ ...board, rpcError: { code: '42501', message: 'admin:forbidden: board role required' } })
      expect((await call()).status).toBe(403)
    })
  })

  describe('database call', () => {
    it('reads through admin_export_members with the session client, never the admin client', async () => {
      const { client } = setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      expect((await call()).status).toBe(200)
      expect(client.rpc).toHaveBeenCalledTimes(1)
      expect(client.rpc).toHaveBeenCalledWith('admin_export_members', { p_role: 'all' })
      expect(createAdminClient).not.toHaveBeenCalled()
    })

    it.each(['member', 'board', 'superadmin', 'all'])('passes the role filter %s from the body', async (role) => {
      const { client } = setupMock({ ...board, rpcData: [] })
      expect((await call({ role })).status).toBe(200)
      expect(client.rpc).toHaveBeenCalledWith('admin_export_members', { p_role: role })
    })

    it('accepts state "active", the only state the CSV holds, and an empty body', async () => {
      const { client } = setupMock({ ...board, rpcData: [] })
      expect((await call({ state: 'active', role: 'board' })).status).toBe(200)
      expect(client.rpc).toHaveBeenCalledWith('admin_export_members', { p_role: 'board' })
      expect((await POST(postJson(URL_BASE, undefined))).status).toBe(200)
      expect(client.rpc).toHaveBeenLastCalledWith('admin_export_members', { p_role: 'all' })
    })

    it.each([
      [{ state: 'former' }], // BR-21: blocked records are never exported
      [{ state: 'all' }],
      [{ role: 'admin' }],
      [{ role: 'Board' }],
      [{ role: '' }],
      [{ role: ['board'] }],
      [{ role: null }],
      [{ q: 'laia' }],
      [{ sort: 'name_asc' }],
    ])('rejects the filter %j with 400 before calling the database', async (body) => {
      const { client } = setupMock({ ...board, rpcData: [] })
      const res = await call(body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_filter' })
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('rejects a filter in the query string (the body carries it now)', async () => {
      const { client } = setupMock({ ...board, rpcData: [] })
      const res = await POST(postJson(`${URL_BASE}?role=board`, {}))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_filter' })
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it.each(['not json', '[]', '"board"', '42'])('rejects the body %s with 400 invalid_request', async (raw) => {
      const { client } = setupMock({ ...board, rpcData: [] })
      const res = await POST(postJson(URL_BASE, null, { raw }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_request' })
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('rejects an oversized body with 413', async () => {
      const { client } = setupMock({ ...board, rpcData: [] })
      const res = await call({ role: 'all', pad: 'x'.repeat(5000) })
      expect(res.status).toBe(413)
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('returns 500 on a database error and logs only the code', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      setupMock({ ...board, rpcError: { code: 'XX000', message: 'boom Laia 12345678Z' } })
      expect((await call()).status).toBe(500)
      expect(JSON.stringify(error.mock.calls)).not.toContain('12345678Z')
      expect(JSON.stringify(error.mock.calls)).toContain('XX000')
    })

    it('refuses to serve a truncated response (fewer rows than the export counted)', async () => {
      setupMock({ ...board, rpcData: [{ ...fakeMember, total_rows: 1001 }] })
      expect((await call()).status).toBe(500)
    })
  })

  describe('CSV', () => {
    it('returns CSV with BOM, the A-10 columns and decrypted DNI/phone', async () => {
      setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      const { bytes, text } = await bodyOf(await call())
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
      await call()
      expect(decrypt).toHaveBeenCalledWith('enc_phone', fakeMember.id)
      expect(decrypt).toHaveBeenCalledWith('enc_dni', fakeMember.id)
      expect(decrypt).toHaveBeenCalledWith('p2', other.id)
      expect(decrypt).toHaveBeenCalledTimes(3)
    })

    it('sets Content-Type, Disposition and Cache-Control', async () => {
      setupMock({ ...board, rpcData: [] })
      const res = await call()
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(res.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="darkstone_members_\d{4}-\d{2}-\d{2}\.csv"$/
      )
      expect(res.headers.get('Cache-Control')).toBe('no-store')
    })

    it('names a role-filtered file after the filter', async () => {
      setupMock({ ...board, rpcData: [] })
      const res = await call({ role: 'board' })
      expect(res.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="darkstone_members_board_\d{4}-\d{2}-\d{2}\.csv"$/
      )
    })

    it('an empty export has only the header line', async () => {
      setupMock({ ...board, rpcData: [] })
      const { text } = await bodyOf(await call())
      expect(text.slice(1).split('\n')).toHaveLength(1)
    })

    it('escapes CSV fields with commas and quotes', async () => {
      setupMock({
        ...board,
        rpcData: rowsOf({ ...fakeMember, first_name: 'Name, With Comma', last_name: 'Has "Quotes"' }),
      })
      const { text } = await bodyOf(await call())
      expect(text).toContain('"Name, With Comma"')
      expect(text).toContain('"Has ""Quotes"""')
    })

    it('neutralises formula injection in member-controlled cells', async () => {
      setupMock({
        ...board,
        rpcData: rowsOf({ ...fakeMember, first_name: '=HYPERLINK("http://evil.test")', last_name: '@SUM(A1)' }),
      })
      const { text } = await bodyOf(await call())
      expect(text).toContain(`"'=HYPERLINK(""http://evil.test"")"`)
      expect(text).toContain("'@SUM(A1)")
    })

    it('leaves a cell empty when a value cannot be decrypted', async () => {
      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error('decrypt failed')
      })
      setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      const res = await call()
      expect(res.status).toBe(200)
      const { text } = await bodyOf(res)
      expect(text.split('\n')[1]).toContain('test@test.com,,,08221')
    })
  })

  describe('logs', () => {
    it('logs one line with the user id and row count only', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      setupMock({ ...board, rpcData: rowsOf(fakeMember, { ...fakeMember, id: '22222222-2222-4333-8444-555555555555' }) })
      await call()
      expect(info).toHaveBeenCalledTimes(1)
      expect(info).toHaveBeenCalledWith('[admin-export] user=%s rows=%d', 'u1', 2)
    })

    it('never logs a decrypted value', async () => {
      const spies = (['info', 'log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
      setupMock({ ...board, rpcData: rowsOf(fakeMember) })
      await call()
      const logged = JSON.stringify(spies.map((s) => s.mock.calls))
      expect(logged).not.toContain('decrypted:')
      expect(logged).not.toContain('test@test.com')
    })
  })
})
