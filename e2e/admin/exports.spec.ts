import { test, expect } from '../fixtures'

// A-10 / A-11 through the real stack: route → admin_export_* (session client) → audit entry.
// The exports only read member data (and add an audit entry), so the shared read-only fixtures
// are safe here.

test.describe('Admin exports', () => {
  test('a board member downloads the member CSV with BOM and the A-10 columns', async ({ adminPage: page }) => {
    const res = await page.request.get('/api/admin/members/export')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers()['cache-control']).toContain('no-store')
    expect(res.headers()['content-disposition']).toMatch(/^attachment; filename="darkstone_members_\d{4}-\d{2}-\d{2}\.csv"$/)

    const body = await res.body()
    expect([...body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const header = body.subarray(3).toString('utf-8').split('\n')[0]
    expect(header).toContain('Primera alta,Alta actual')
  })

  test('an unknown filter is refused', async ({ adminPage: page }) => {
    const res = await page.request.get('/api/admin/members/export?state=former')
    expect(res.status()).toBe(400)
  })

  test('a plain member gets 403 for both exports', async ({ memberPage: page }) => {
    expect((await page.request.get('/api/admin/members/export')).status()).toBe(403)
    expect((await page.request.get('/api/admin/members/000-001/data')).status()).toBe(403)
  })

  test('member data of an unknown member number is 404', async ({ adminPage: page }) => {
    const res = await page.request.get('/api/admin/members/999-999/data')
    expect(res.status()).toBe(404)
    expect(res.headers()['cache-control']).toContain('no-store')
  })
})
