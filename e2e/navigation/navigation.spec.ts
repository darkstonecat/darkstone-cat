import { test, expect } from '@playwright/test'
import { PAGES, TEXT } from '../helpers/constants'

const mainNav = 'nav[aria-label="Main navigation"]'

/**
 * On mobile viewports, nav links are behind a hamburger menu.
 * This helper opens it if present.
 */
async function openMobileMenuIfNeeded(page: import('@playwright/test').Page) {
  const hamburger = page.getByLabel('Botó de menú')
  if (await hamburger.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await hamburger.click()
    // Wait for menu animation
    await page.waitForTimeout(400)
  }
}

test.describe('Navigation', () => {
  test('home page loads', async ({ page }) => {
    await page.goto(PAGES.home)
    await expect(page).toHaveTitle(/Darkstone/i)
  })

  test('navbar has all main links', async ({ page }) => {
    await page.goto(PAGES.home)
    await openMobileMenuIfNeeded(page)

    for (const link of [
      TEXT.nav_about,
      TEXT.nav_events,
      TEXT.nav_ludoteca,
      TEXT.nav_contact,
    ]) {
      await expect(page.getByRole('link', { name: link, exact: true }).first()).toBeVisible()
    }
  })

  test('navigates to about page', async ({ page }) => {
    await page.goto(PAGES.home)
    await openMobileMenuIfNeeded(page)
    await page.getByRole('link', { name: TEXT.nav_about, exact: true }).first().click()
    await expect(page).toHaveURL(/\/about/)
  })

  test('navigates to ludoteca page', async ({ page }) => {
    await page.goto(PAGES.home)
    await openMobileMenuIfNeeded(page)
    await page.getByRole('link', { name: TEXT.nav_ludoteca, exact: true }).first().click()
    await expect(page).toHaveURL(/\/ludoteca/)
  })

  test('navigates to contact page', async ({ page }) => {
    await page.goto(PAGES.home)
    await openMobileMenuIfNeeded(page)
    await page.getByRole('link', { name: TEXT.nav_contact, exact: true }).first().click()
    await expect(page).toHaveURL(/\/contact/)
  })

  test('navigates to events page', async ({ page }) => {
    await page.goto(PAGES.home)
    await openMobileMenuIfNeeded(page)
    await page.getByRole('link', { name: TEXT.nav_events, exact: true }).first().click()
    await expect(page).toHaveURL(/\/events/)
  })

  test('navbar does not link to the code of conduct (it opens from the footer, About and sign-up)', async ({ page }) => {
    await page.goto(PAGES.home)
    await openMobileMenuIfNeeded(page)
    await expect(page.getByRole('navigation', { name: /Main navigation|Mobile navigation/ }).getByRole('link', { name: TEXT.doc_conduct })).toHaveCount(0)
  })

  test('footer is visible on subpages', async ({ page }) => {
    await page.goto(PAGES.about)
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer).toContainText(TEXT.footer_rights)
  })

  test('footer links work', async ({ page }) => {
    await page.goto(PAGES.about)
    const footer = page.locator('footer')
    const legalLink = footer.locator('a[href*="/legal"]')
    await expect(legalLink).toBeVisible()
  })

  test('logo links to home', async ({ page }) => {
    await page.goto(PAGES.about)
    const logo = page.locator(`${mainNav} a[href="/"]`).first()
    await logo.click()
    await page.waitForURL('**/', { timeout: 10_000 })
    expect(page.url()).toMatch(/:\d+\/$/)
  })

  test('protected route redirects to login', async ({ page }) => {
    await page.goto(PAGES.profile)
    await expect(page).toHaveURL(/\/login/)
  })

  test('protected route preserves redirect param', async ({ page }) => {
    await page.goto(PAGES.profile)
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })

  test('admin route redirects to login', async ({ page }) => {
    await page.goto(PAGES.admin)
    await expect(page).toHaveURL(/\/login/)
  })

  test('skip to content link exists', async ({ page }) => {
    await page.goto(PAGES.home)
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })
})
