import { test, expect } from '../fixtures'

// The image route is used only by the admin tool /admin/tools/event-images.
const ROUTE = '/api/events/does-not-exist/image'

test.describe('Event image API access control', () => {
  test('anonymous request gets 401', async ({ request }) => {
    const res = await request.get(ROUTE)
    expect(res.status()).toBe(401)
    expect(res.headers()['cache-control']).toBe('no-store')
  })

  test('member gets 403', async ({ memberPage: page }) => {
    const res = await page.request.get(ROUTE)
    expect(res.status()).toBe(403)
  })

  test('admin passes the guard (unknown event is a 404, not 401/403)', async ({ adminPage: page }) => {
    test.slow()
    const res = await page.request.get(ROUTE)
    expect(res.status()).toBe(404)
  })
})
