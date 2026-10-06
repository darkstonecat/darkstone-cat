import { test, expect } from '../fixtures'

// V-6. LUDOYA_MOCK is set by the E2E server and the BGG job falls back to its local fixtures
// without an API key, so a refresh never reaches the network.
test.describe('Admin tools', () => {
  // The refresh is limited to one per minute per member, so a retry would hit the limit.
  test.describe.configure({ retries: 0 })

  test('a board member sees both jobs and the event images link', async ({ adminPage: page }) => {
    const response = await page.goto('/admin/tools')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'Eines' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Obre l'eina/ })).toHaveAttribute('href', '/admin/tools/event-images')
    await expect(page.getByText('Ludoya (sessions i esdeveniments)')).toBeVisible()
    await expect(page.getByText('Ludoteca (BGG)')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test('refreshing everything shows the per-job results, then the rate limit', async ({ adminPage: page }) => {
    test.slow()
    await page.goto('/admin/tools')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Refresca-ho tot' }).click()
    await expect(page.getByText("Resultat de l'actualització")).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/^Ludoya \(sessions i esdeveniments\): (correcte|error)/)).toBeVisible()
    await expect(page.getByText(/^Ludoteca \(BGG\): (correcte|error)/)).toBeVisible()

    // The status line now says who ran it.
    await expect(page.getByText('Avui', { exact: false }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Refresca ara' }).first().click()
    await expect(page.getByRole('region', { name: 'Memòria cau' }).getByRole('alert')).toContainText("fa menys d'un minut")
  })

  test('a member gets 404', async ({ memberPage: page }) => {
    const response = await page.goto('/admin/tools')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Event images tool path', () => {
  test('the old path redirects permanently to the new one', async ({ request }) => {
    for (const [from, to] of [
      ['/events/images', '/admin/tools/event-images'],
      ['/es/events/images', '/es/admin/tools/event-images'],
      ['/en/events/images', '/en/admin/tools/event-images'],
    ]) {
      const res = await request.get(from, { maxRedirects: 0 })
      expect(res.status(), from).toBe(308)
      expect(new URL(res.headers()['location'], 'http://x').pathname, from).toBe(to)
    }
  })

  test('a board member opens the tool at the new path', async ({ adminPage: page }) => {
    test.slow()
    const response = await page.goto('/events/images')
    expect(page.url()).toContain('/admin/tools/event-images')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 2, name: "Imatges d'esdeveniments" })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Torna a Eines' })).toBeVisible()
  })

  test('a member gets 404 at the new path', async ({ memberPage: page }) => {
    const response = await page.goto('/admin/tools/event-images')
    expect(response?.status()).toBe(404)
  })
})
