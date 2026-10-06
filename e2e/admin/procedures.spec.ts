import { test, expect } from '../fixtures'

test.describe('Admin procedures', () => {
  test('a board member sees the index and every procedure anchor', async ({ adminPage: page }) => {
    const response = await page.goto('/admin/procedures')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'Procediments' })).toBeVisible()

    const index = page.getByRole('navigation', { name: 'Índex de procediments' })
    await expect(index.getByRole('link')).toHaveCount(7)
    for (let n = 1; n <= 7; n++) {
      await expect(page.locator(`article#p-${n}`)).toHaveCount(1)
    }
    await expect(page.getByRole('heading', { level: 2, name: "Reincorporació d'un exsoci" })).toBeVisible()
  })

  test('an anchor link scrolls to its procedure', async ({ adminPage: page }) => {
    await page.goto('/admin/procedures#p-5')
    await expect(page.locator('article#p-5')).toBeInViewport()
  })

  test('the page is noindex', async ({ adminPage: page }) => {
    await page.goto('/admin/procedures')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})
