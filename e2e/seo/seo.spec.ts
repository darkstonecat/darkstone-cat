import { test, expect } from '@playwright/test'

const SEO_PAGES = [
  { path: '/', expectTitle: /Darkstone/i },
  { path: '/about', expectTitle: /qui som|about/i },
  { path: '/ludoteca', expectTitle: /ludoteca/i },
  { path: '/contact', expectTitle: /contacte|contact/i },
  { path: '/events', expectTitle: /esdeveniments|events/i },
  { path: '/faq', expectTitle: /faq|preguntes/i },
] as const

for (const seoPage of SEO_PAGES) {
  test.describe(`SEO: ${seoPage.path}`, () => {
    test('has title tag', async ({ page }) => {
      await page.goto(seoPage.path)
      await expect(page).toHaveTitle(seoPage.expectTitle)
    })

    test('has meta description', async ({ page }) => {
      await page.goto(seoPage.path)
      const content = await page.locator('meta[name="description"]').first().getAttribute('content')
      expect(content?.length).toBeGreaterThan(10)
    })

    test('has Open Graph tags', async ({ page }) => {
      await page.goto(seoPage.path)
      const ogTitle = page.locator('meta[property="og:title"]')
      await expect(ogTitle.first()).toBeAttached()
    })

    test('has canonical or hreflang', async ({ page }) => {
      await page.goto(seoPage.path)
      const canonical = page.locator('link[rel="canonical"]')
      const hreflang = page.locator('link[rel="alternate"][hreflang]')
      const hasCanonical = (await canonical.count()) > 0
      const hasHreflang = (await hreflang.count()) > 0
      expect(hasCanonical || hasHreflang).toBeTruthy()
    })

    test('has lang attribute on html', async ({ page }) => {
      await page.goto(seoPage.path)
      await expect(page.locator('html')).toHaveAttribute('lang', /ca|es|en/)
    })

    test('has JSON-LD structured data', async ({ page }) => {
      await page.goto(seoPage.path)
      const jsonLd = page.locator('script[type="application/ld+json"]')
      const count = await jsonLd.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })
}
