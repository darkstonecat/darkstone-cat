import { test, expect } from '@playwright/test'
import { PAGES, TEXT } from '../helpers/constants'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.home)
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Darkstone/i)
  })

  test('hero section is visible', async ({ page }) => {
    await expect(page.getByText(TEXT.hero_tagline)).toBeVisible({ timeout: 10_000 })
  })

  test('the hero button sends a visitor to the web sign-up', async ({ page }) => {
    const cta = page.locator('#hero').getByRole('link', { name: /Fes-te soci/ })
    await expect(cta).toBeVisible({ timeout: 10_000 })
    await expect(cta).toHaveAttribute('href', '/register')
  })

  test('a visitor sees the navbar login link', async ({ page, isMobile }) => {
    // On phones the login link lives in the menu.
    if (isMobile) await page.getByRole('button', { name: 'Botó de menú' }).first().click()
    const login = page.getByRole('link', { name: TEXT.nav_login, exact: true })
    await expect(login).toBeVisible({ timeout: 10_000 })
    await expect(login).toHaveAttribute('href', '/login')
  })

  test('the "join us" button opens the web sign-up', async ({ page }) => {
    const cta = page.locator('#join-us').getByRole('link', { name: /Registra't/ })
    await expect(cta).toHaveAttribute('href', '/register')
    await expect(cta).not.toHaveAttribute('target', '_blank')
  })

  test('about section exists', async ({ page }) => {
    const about = page.locator('#about')
    await expect(about).toBeAttached()
  })

  test('schedule section exists', async ({ page }) => {
    const schedule = page.locator('#schedule')
    await expect(schedule).toBeAttached()
  })

  test('location section exists', async ({ page }) => {
    const location = page.locator('#location')
    await expect(location).toBeAttached()
  })
})
