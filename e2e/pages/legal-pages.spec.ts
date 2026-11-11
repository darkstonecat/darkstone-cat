import { test, expect } from '@playwright/test'

const LEGAL_PAGES = [
  { path: '/legal', titlePattern: /legal|avís/i },
  { path: '/privacy', titlePattern: /privad|privacy/i },
  { path: '/cookies', titlePattern: /cookie/i },
] as const

for (const legalPage of LEGAL_PAGES) {
  test.describe(`Legal page: ${legalPage.path}`, () => {
    test('loads and has heading', async ({ page }) => {
      await page.goto(legalPage.path)
      const heading = page.locator('h1')
      await expect(heading).toBeVisible()
    })

    test('has content', async ({ page }) => {
      await page.goto(legalPage.path)
      // Should have substantial content
      const main = page.locator('main, [role="main"], article').first()
      await expect(main).toBeVisible()
      const text = await main.textContent()
      expect(text!.length).toBeGreaterThan(100)
    })

    test('has footer', async ({ page }) => {
      await page.goto(legalPage.path)
      await expect(page.locator('footer')).toBeVisible()
    })

    test('has proper title', async ({ page }) => {
      await page.goto(legalPage.path)
      await expect(page).toHaveTitle(legalPage.titlePattern)
    })
  })
}
