import { createClient } from '@supabase/supabase-js'
import { test, expect } from '../fixtures'
import { MEMBER_EMAIL } from '../helpers/constants'
import { findUserByEmail } from '../helpers/supabase-admin'

// A-10 / A-11 / A-16 / S-4 through the real stack: route → admin_export_* (session client) →
// audit entry. The exports only read member data (and add an audit entry), so the shared
// read-only fixtures are safe here. Every export is POST with a same-origin Origin header
// (CSRF); Playwright's request context sends no Origin of its own, so the tests set it the way
// a browser does for a same-origin POST.

const ORIGIN = 'http://localhost:3100'
const post = (data: unknown, origin: string | null = ORIGIN) => {
  const headers: Record<string, string> = {}
  if (origin) headers.Origin = origin
  return { data, headers }
}

async function memberNumberOf(email: string): Promise<string> {
  const id = await findUserByEmail(email)
  expect(id).not.toBeNull()
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.from('members').select('member_number').eq('id', id!).single()
  expect(error).toBeNull()
  return data!.member_number as string
}

test.describe('Admin exports', () => {
  test('a board member downloads the member CSV with BOM and the A-10 columns', async ({ adminPage: page }) => {
    const res = await page.request.post('/api/admin/members/export', post({}))
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers()['cache-control']).toContain('no-store')
    expect(res.headers()['content-disposition']).toMatch(/^attachment; filename="darkstone_members_\d{4}-\d{2}-\d{2}\.csv"$/)

    const body = await res.body()
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const header = body.subarray(3).toString('utf-8').split('\n')[0]
    expect(header).toContain('Primera alta,Alta actual')
  })

  test('GET is 405 and a cross-site or missing Origin is 403', async ({ adminPage: page }) => {
    expect((await page.request.get('/api/admin/members/export')).status()).toBe(405)

    const evil = await page.request.post('/api/admin/members/export', post({}, 'https://evil.example'))
    expect(evil.status()).toBe(403)
    expect(await evil.json()).toEqual({ error: 'forbidden_origin' })
    expect((await page.request.post('/api/admin/members/export', post({}, null))).status()).toBe(403)
  })

  test('an unknown filter is refused', async ({ adminPage: page }) => {
    const res = await page.request.post('/api/admin/members/export', post({ state: 'former' }))
    expect(res.status()).toBe(400)
  })

  test('a plain member gets 403 for every export', async ({ memberPage: page }) => {
    expect((await page.request.post('/api/admin/members/export', post({}))).status()).toBe(403)
    expect((await page.request.post('/api/admin/members/000-001/data', post({}))).status()).toBe(403)
    expect((await page.request.post('/api/admin/members/emails', post({ list: 'association' }))).status()).toBe(403)
    expect((await page.request.post('/api/admin/members/register', post({ reason: 'Requeriment legal' }))).status()).toBe(403)
  })

  test('member data of an unknown member number is 404', async ({ adminPage: page }) => {
    const res = await page.request.post('/api/admin/members/999-999/data', post({}))
    expect(res.status()).toBe(404)
    expect(res.headers()['cache-control']).toContain('no-store')
  })

  test("a board member downloads an active member's data as JSON (A-11)", async ({ adminPage: page }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)
    const res = await page.request.post(`/api/admin/members/${number}/data`, post({}))
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers()['cache-control']).toContain('no-store')
    expect(res.headers()['content-disposition']).toBe(`attachment; filename="darkstone-data-${number}.json"`)

    const json = await res.json()
    expect(json).toMatchObject({ email: MEMBER_EMAIL, member_number: number, left_on: null })
    expect(json.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('a board member exports the association and newsletter e-mail lists (A-16)', async ({ adminPage: page }) => {
    const csv = await page.request.post('/api/admin/members/emails', post({ list: 'association' }))
    expect(csv.status()).toBe(200)
    expect(csv.headers()['content-type']).toBe('text/csv; charset=utf-8')
    expect(csv.headers()['content-disposition']).toMatch(/^attachment; filename="darkstone_emails_association_\d{4}-\d{2}-\d{2}\.csv"$/)
    const text = (await csv.body()).subarray(3).toString('utf-8')
    expect(text.split('\n')[0]).toBe('Nom,Cognoms,Email')
    expect(text).toContain(MEMBER_EMAIL)

    const json = await page.request.post('/api/admin/members/emails', post({ list: 'newsletter', format: 'json' }))
    expect(json.status()).toBe(200)
    const body = await json.json()
    expect(body).toMatchObject({ list: 'newsletter', count: body.addresses.length })

    expect((await page.request.post('/api/admin/members/emails', post({ list: 'former' }))).status()).toBe(400)
  })

  test('the llibre de socis is superadmin only (S-4)', async ({ adminPage: page }) => {
    const res = await page.request.post('/api/admin/members/register', post({ reason: 'Requeriment del Registre' }))
    expect(res.status()).toBe(403)
    expect((await page.request.get('/api/admin/members/register')).status()).toBe(405)
  })
})
