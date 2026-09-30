import { test, expect } from '@playwright/test'
import { PAGES, TEXT, MEMBER_EMAIL, MEMBER_PASSWORD } from '../helpers/constants'

const MAILPIT = 'http://127.0.0.1:54324'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.login)
  })

  test('renders login form', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#email-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#password-error')).toContainText(TEXT.required_field)
  })

  test('shows email format error', async ({ page }) => {
    await page.locator('#email').fill('not-an-email')
    await page.locator('#password').fill('somepassword')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#email-error')).toContainText(TEXT.invalid_email)
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('#email').fill('wrong@test.local')
    await page.locator('#password').fill('WrongPassword1!')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(TEXT.login_error_invalid)).toBeVisible()
  })

  test('disables both buttons while submitting', async ({ page }) => {
    await page.locator('#email').fill(MEMBER_EMAIL)
    await page.locator('#password').fill(MEMBER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
    await expect(page.getByRole('button', { name: TEXT.login_magic_button })).toBeDisabled()
  })

  test('successful login redirects to profile', async ({ page }) => {
    await page.locator('#email').fill(MEMBER_EMAIL)
    await page.locator('#password').fill(MEMBER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/profile', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/profile/)
  })

  test('login with redirect param', async ({ page }) => {
    await page.goto(`${PAGES.login}?redirect=/about`)
    await page.locator('#email').fill(MEMBER_EMAIL)
    await page.locator('#password').fill(MEMBER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/about', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/about/)
  })

  test('has link to register page', async ({ page }) => {
    const registerLink = page.locator('a[href*="/register"]')
    await expect(registerLink).toBeVisible()
    await registerLink.click()
    await expect(page).toHaveURL(/\/register/)
  })

  test('has link to forgot password page', async ({ page }) => {
    const forgotLink = page.locator('a[href*="/forgot-password"]')
    await expect(forgotLink).toBeVisible()
    await forgotLink.click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })

  test('login with an unsafe redirect param falls back to profile', async ({ page }) => {
    await page.goto(`${PAGES.login}?redirect=//evil.com`)
    await page.locator('#email').fill(MEMBER_EMAIL)
    await page.locator('#password').fill(MEMBER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/profile', { timeout: 15_000 })
    await expect(page).toHaveURL(/localhost:3100\/profile/)
  })

  test('shows magic=error banner', async ({ page }) => {
    await page.goto(`${PAGES.login}?magic=error`)
    await expect(page.getByRole('alert')).toContainText(TEXT.login_magic_error)
  })

  test('shows confirmed=success banner', async ({ page }) => {
    await page.goto(`${PAGES.login}?confirmed=success`)
    await expect(page.locator('[role="status"]')).toBeVisible()
  })
})


test.describe('Login with magic link', () => {
  const magicButton = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: TEXT.login_magic_button })

  test('magic link button is disabled until the email is valid', async ({ page }) => {
    await page.goto(PAGES.login)
    await expect(magicButton(page)).toBeDisabled()
    await page.locator('#email').fill('not-an-email')
    await expect(magicButton(page)).toBeDisabled()
    await page.locator('#email').fill('someone@test.local')
    await expect(magicButton(page)).toBeEnabled()
  })

  test('unknown email gets the same neutral confirmation', async ({ page }) => {
    await page.goto(PAGES.login)
    await page.locator('#email').fill('nobody-e2e@test.local')
    await magicButton(page).click()
    await expect(page.getByRole('heading', { name: TEXT.login_magic_sent_title })).toBeVisible()
    await expect(page.getByText('nobody-e2e@test.local')).toBeVisible()
  })

  test('link from the local mailbox signs the member in', async ({ page, baseURL }) => {
    // Start from an empty mailbox for this member so the poll cannot pick a stale link.
    await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${MEMBER_EMAIL}`)}`, {
      method: 'DELETE',
    })
    await page.goto(PAGES.login)
    await page.locator('#email').fill(MEMBER_EMAIL)
    await magicButton(page).click()
    await expect(page.getByRole('heading', { name: TEXT.login_magic_sent_title })).toBeVisible()

    // Local Supabase delivers to Mailpit; poll for the newest message to this member.
    let link = ''
    await expect
      .poll(async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${MEMBER_EMAIL}`)}`)
        const list = (await res.json()) as { messages: { ID: string }[] }
        if (!list.messages.length) return ''
        const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()
        const match = (msg.HTML as string).match(/href="([^"]*\/auth\/magic-link\?[^"]+)"/)
        link = match ? match[1].replace(/&amp;/g, '&') : ''
        return link
      }, { timeout: 15_000 })
      .not.toBe('')

    const url = new URL(link)
    await page.goto(`${baseURL}${url.pathname}${url.search}`)
    await page.waitForURL('**/profile', { timeout: 15_000 })
    await expect(page).toHaveURL(/\/profile/)

    // Links are single use (logged-out, otherwise /login redirects to /profile).
    await page.context().clearCookies()
    await page.goto(`${baseURL}${url.pathname}${url.search}`)
    await page.waitForURL('**/login?magic=error')
  })
})
