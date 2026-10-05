import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { GET, POST } from '@/app/api/admin/members/emails/route'
import { mockAdminSession, postJson, bodyOf, spyConsole, type RpcResult } from '../../helpers/admin-route'

// A-16: POST /api/admin/members/emails with `{ list: "association" | "newsletter", format?:
// "csv" | "json" }`. admin_export_emails() (session client) checks board+, picks the list
// (BR-23) and writes export.emails in the same transaction. CSV = name and e-mail (Google Group
// / Contacts import); JSON = the addresses for "Copia les adreces".

const URL = 'http://localhost:3000/api/admin/members/emails'
const board = { user: { id: 'u1' }, member: { role: 'board', left_on: null } }

const rowsOf = (...rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, total_rows: rows.length }))
const laia = { first_name: 'Laia', last_name: 'Serra', email: 'laia@example.test' }
const marc = { first_name: '=Marc', last_name: 'Garcia, Puig', email: 'marc@example.test' }

function setup(session: Parameters<typeof mockAdminSession>[0] = board, result: RpcResult = { data: rowsOf(laia, marc), error: null }) {
  return mockAdminSession({
    ...session,
    rpc: (name) => (name === 'admin_export_emails' ? result : { data: null, error: { code: '42883', message: 'unknown' } }),
  })
}
const call = (body: unknown, opts?: Parameters<typeof postJson>[2]) => POST(postJson(URL, body, opts))

describe('POST /api/admin/members/emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      const res = await call({ list: 'association' }, { origin })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'forbidden_origin' })
      expect(client.auth.getUser).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    })

    it('returns 401 without a session and 403 for a plain member, without calling the export', async () => {
      const anon = setup({ user: null })
      expect((await call({ list: 'association' })).status).toBe(401)
      expect(anon.rpc).not.toHaveBeenCalled()

      const member = setup({ user: { id: 'u2' }, member: { role: 'member', left_on: null } })
      expect((await call({ list: 'association' })).status).toBe(403)
      expect(member.rpc).not.toHaveBeenCalled()
    })

    it('maps a database refusal (42501) to 403', async () => {
      setup(board, { data: null, error: { code: '42501', message: 'admin:forbidden: board role required' } })
      expect((await call({ list: 'association' })).status).toBe(403)
    })
  })

  describe('body', () => {
    it.each(['association', 'newsletter'])('passes the list %s to admin_export_emails with the session client', async (list) => {
      const { rpc } = setup()
      expect((await call({ list })).status).toBe(200)
      expect(rpc).toHaveBeenCalledWith('admin_export_emails', { p_list: list })
      expect(createAdminClient).not.toHaveBeenCalled()
    })

    it.each([
      [{}],
      [{ list: 'all' }],
      [{ list: 'Newsletter' }],
      [{ list: ['association'] }],
      [{ list: 'association', format: 'xlsx' }],
      [{ list: 'association', extra: true }],
    ])('rejects %j with 400 before the database', async (body) => {
      const { rpc } = setup()
      const res = await call(body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_request' })
      expect(rpc).not.toHaveBeenCalled()
    })

    it('returns 500 on a database error and on a truncated response', async () => {
      setup(board, { data: null, error: { code: 'XX000', message: 'boom laia@example.test' } })
      expect((await call({ list: 'association' })).status).toBe(500)
      setup(board, { data: [{ ...laia, total_rows: 1001 }], error: null })
      expect((await call({ list: 'association' })).status).toBe(500)
    })
  })

  describe('outputs', () => {
    it('CSV (default): BOM, name and e-mail columns, escaped cells, attachment, no-store', async () => {
      setup()
      const res = await call({ list: 'newsletter' })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(res.headers.get('Content-Disposition')).toMatch(
        /^attachment; filename="darkstone_emails_newsletter_\d{4}-\d{2}-\d{2}\.csv"$/
      )
      const { bytes, text } = await bodyOf(res)
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
      expect(text.slice(1).split('\n')).toEqual([
        'Nom,Cognoms,Email',
        'Laia,Serra,laia@example.test',
        `'=Marc,"Garcia, Puig",marc@example.test`,
      ])
    })

    it('JSON: the list, the count and the addresses for "Copia les adreces"', async () => {
      setup()
      const res = await call({ list: 'association', format: 'json' })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('application/json')
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(res.headers.get('Content-Disposition')).toBeNull()
      expect(await res.json()).toEqual({
        list: 'association',
        count: 2,
        addresses: ['laia@example.test', 'marc@example.test'],
      })
    })

    it('an empty list has only the header line', async () => {
      setup(board, { data: [], error: null })
      const { text } = await bodyOf(await call({ list: 'newsletter' }))
      expect(text.slice(1).split('\n')).toEqual(['Nom,Cognoms,Email'])
    })
  })

  describe('logs', () => {
    it('logs the actor, the list and the count only, never an address or a name', async () => {
      const spies = spyConsole()
      setup()
      await call({ list: 'newsletter' })
      expect(spies.info).toHaveBeenCalledWith('[admin-export] user=%s emails list=%s rows=%d', 'u1', 'newsletter', 2)
      setup(board, { data: null, error: { code: 'XX000', message: 'boom laia@example.test' } })
      await call({ list: 'association' })
      const logged = spies.logged()
      expect(logged).not.toContain('example.test')
      expect(logged).not.toContain('Serra')
    })
  })
})
