import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/encryption'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((text: string) => `decrypted:${text}`),
}))

import { GET, POST } from '@/app/api/admin/members/register/route'
import { mockAdminSession, postJson, bodyOf, spyConsole, type RpcResult } from '../../helpers/admin-route'

// S-4: POST /api/admin/members/register with `{ reason }`. Superadmin only (route guard and
// admin_export_register()), every member active or former (never purged), the D-B fields with
// the DNI decrypted with the row id; the function checks the reason and writes
// export.member_register in the same transaction.

const URL = 'http://localhost:3000/api/admin/members/register'
const superadmin = { user: { id: 'u1' }, member: { role: 'superadmin', left_on: null } }
const REASON = "Requeriment del Registre d'Associacions"

const ACTIVE_ID = '11111111-2222-4333-8444-555555555555'
const FORMER_ID = '99999999-2222-4333-8444-555555555555'
const active = {
  id: ACTIVE_ID,
  member_number: '000-203',
  first_name: 'Laia',
  last_name: 'Serra',
  dni_nie_encrypted: 'enc_dni_a',
  membership_start_date: '2020-01-01',
  current_joined_on: '2025-06-10',
  left_on: null,
  left_by: null,
}
const former = {
  id: FORMER_ID,
  member_number: '000-154',
  first_name: 'Albert',
  last_name: '@Roca',
  dni_nie_encrypted: 'enc_dni_f',
  membership_start_date: '2019-02-01',
  current_joined_on: '2019-02-01',
  left_on: '2026-09-01',
  left_by: 'board',
}
const rowsOf = (...rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, total_rows: rows.length }))

function setup(
  session: Parameters<typeof mockAdminSession>[0] = superadmin,
  result: RpcResult = { data: rowsOf(former, active), error: null }
) {
  return mockAdminSession({
    ...session,
    rpc: (name) => (name === 'admin_export_register' ? result : { data: null, error: { code: '42883', message: 'unknown' } }),
  })
}
const call = (body: unknown = { reason: REASON }, opts?: Parameters<typeof postJson>[2]) => POST(postJson(URL, body, opts))

describe('POST /api/admin/members/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(decrypt).mockImplementation((t: string) => `decrypted:${t}`)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  describe('method, origin and access', () => {
    it('answers GET with 405', async () => {
      const res = await GET()
      expect(res.status).toBe(405)
      expect(res.headers.get('Allow')).toBe('POST')
    })

    it.each([null, 'https://evil.com'])('refuses Origin %j with 403 before the session', async (origin) => {
      const { client, rpc } = setup()
      const res = await call({ reason: REASON }, { origin })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'forbidden_origin' })
      expect(client.auth.getUser).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    })

    it('returns 401 without a session', async () => {
      const { rpc } = setup({ user: null })
      expect((await call()).status).toBe(401)
      expect(rpc).not.toHaveBeenCalled()
    })

    it.each(['member', 'board', 'admin'])('returns 403 for an active %s, without calling the export', async (role) => {
      const { rpc } = setup({ user: { id: 'u2' }, member: { role, left_on: null } })
      expect((await call()).status).toBe(403)
      expect(rpc).not.toHaveBeenCalled()
    })

    it('returns 403 for a former superadmin', async () => {
      setup({ user: { id: 'u2' }, member: { role: 'superadmin', left_on: '2026-01-01' } })
      expect((await call()).status).toBe(403)
    })
  })

  describe('reason', () => {
    it('passes the reason to admin_export_register with the session client', async () => {
      const { rpc } = setup()
      expect((await call()).status).toBe(200)
      expect(rpc).toHaveBeenCalledWith('admin_export_register', { p_reason: REASON })
      expect(createAdminClient).not.toHaveBeenCalled()
    })

    it.each([[{}], [{ reason: null }], [{ reason: '' }], [{ reason: '   ' }]])(
      'answers %j with 400 reason_required before the database',
      async (body) => {
        const { rpc } = setup()
        const res = await call(body)
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'reason_required' })
        expect(rpc).not.toHaveBeenCalled()
      }
    )

    it.each([[{ reason: 42 }], [{ reason: REASON, extra: 1 }]])('rejects %j with 400 invalid_request', async (body) => {
      const { rpc } = setup()
      const res = await call(body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_request' })
      expect(rpc).not.toHaveBeenCalled()
    })

    it.each([
      ['admin:reason_required: the llibre de socis needs a reason of at least 10 characters', 'reason_required'],
      ['admin:reason_too_long: at most 500 characters', 'reason_too_long'],
    ])('maps the database refusal %s to 400 %s', async (message, expected) => {
      setup(superadmin, { data: null, error: { code: '22023', message } })
      const res = await call({ reason: 'curt' })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: expected })
    })

    it('maps a database role refusal to 403 and other errors to 500', async () => {
      setup(superadmin, { data: null, error: { code: '42501', message: 'admin:forbidden: superadmin role required' } })
      expect((await call()).status).toBe(403)
      setup(superadmin, { data: null, error: { code: 'XX000', message: 'boom 12345678Z' } })
      expect((await call()).status).toBe(500)
    })

    it('refuses a truncated response', async () => {
      setup(superadmin, { data: [{ ...active, total_rows: 1001 }], error: null })
      expect((await call()).status).toBe(500)
    })
  })

  describe('CSV', () => {
    it('BOM, the D-B columns, DNI decrypted, baixa per in Catalan, escaped cells, attachment, no-store', async () => {
      setup()
      const res = await call()
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(res.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="darkstone_llibre_socis_\d{4}-\d{2}-\d{2}\.csv"$/
      )
      const { bytes, text } = await bodyOf(res)
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
      expect(text.slice(1).split('\n')).toEqual([
        'Número,Nom,Cognoms,DNI/NIE,Primera alta,Alta actual,Data de baixa,Baixa per',
        `000-154,Albert,'@Roca,decrypted:enc_dni_f,2019-02-01,2019-02-01,2026-09-01,Junta`,
        '000-203,Laia,Serra,decrypted:enc_dni_a,2020-01-01,2025-06-10,,',
      ])
    })

    it("decrypts each DNI with the row's own member id; an unreadable or missing DNI is an empty cell", async () => {
      vi.mocked(decrypt).mockImplementation((t: string) => {
        if (t === 'enc_dni_f') throw new Error('decrypt failed')
        return `decrypted:${t}`
      })
      setup(superadmin, { data: rowsOf(former, { ...active, dni_nie_encrypted: null }, { ...active, id: FORMER_ID.replace('9', '8'), member_number: '000-300', left_on: '2026-01-01', left_by: 'self' }), error: null })
      const { text } = await bodyOf(await call())
      expect(decrypt).toHaveBeenCalledWith('enc_dni_f', FORMER_ID)
      const lines = text.slice(1).split('\n')
      expect(lines[1]).toContain(`'@Roca,,2019-02-01`)
      expect(lines[2]).toBe('000-203,Laia,Serra,,2020-01-01,2025-06-10,,')
      expect(lines[3]).toMatch(/,2026-01-01,Soci$/)
    })
  })

  describe('logs', () => {
    it('logs the actor and the row count only, never a DNI, name or the reason', async () => {
      const spies = spyConsole()
      setup()
      await call()
      expect(spies.info).toHaveBeenCalledWith('[admin-export] user=%s register rows=%d', 'u1', 2)
      setup(superadmin, { data: null, error: { code: 'XX000', message: 'boom Serra 12345678Z' } })
      await call()
      const logged = spies.logged()
      for (const secret of ['decrypted:', 'Serra', 'Roca', '12345678Z', 'Registre']) {
        expect(logged).not.toContain(secret)
      }
    })
  })
})
