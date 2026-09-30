import { test, expect } from '@playwright/test'
import { PAGES, TEXT } from '../helpers/constants'
import { deleteTestUser } from '../helpers/supabase-admin'

test.describe('Register page', () => {
  const testEmails: string[] = []

  test.afterAll(async () => {
    for (const email of testEmails) {
      await deleteTestUser(email)
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.register)
  })

  test('renders registration form', async ({ page }) => {
    await expect(page.locator('#first_name')).toBeVisible()
    await expect(page.locator('#last_name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows validation errors for empty required fields', async ({ page }) => {
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#first_name-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#last_name-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#email-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#password-error')).toContainText(TEXT.required_field)
  })

  test('shows email format error', async ({ page }) => {
    await page.locator('#first_name').fill('Test')
    await page.locator('#last_name').fill('User')
    await page.locator('#email').fill('invalid-email')
    await page.locator('#password').fill('Test1234!')
    await page.locator('input[name="conduct"]').check()
    await page.locator('input[name="privacy"]').check()
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#email-error')).toContainText(TEXT.invalid_email)
  })

  test('shows password min length error', async ({ page }) => {
    await page.locator('#first_name').fill('Test')
    await page.locator('#last_name').fill('User')
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('short')
    await page.locator('input[name="conduct"]').check()
    await page.locator('input[name="privacy"]').check()
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password-error')).toContainText(TEXT.password_min_length)
  })

  test('shows consent required errors', async ({ page }) => {
    await page.locator('#first_name').fill('Test')
    await page.locator('#last_name').fill('User')
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('Test1234!')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText(TEXT.must_accept_conduct)).toBeVisible()
    await expect(page.getByText(TEXT.must_accept_privacy)).toBeVisible()
  })

  test('consents start unchecked and the three steps are shown', async ({ page }) => {
    await expect(page.locator('input[name="conduct"]')).not.toBeChecked()
    await expect(page.locator('input[name="privacy"]')).not.toBeChecked()
    await expect(page.locator('input[name="newsletter"]')).not.toBeChecked()
    await expect(page.getByRole('list', { name: /passos/i }).locator('li')).toHaveCount(3)
    await expect(page.locator('a[href="/conduct"]').first()).toBeVisible()
    await expect(page.locator('a[href="/privacy"]').first()).toBeVisible()
  })

  test('successful registration swaps to the confirmation screen, resends and goes back', async ({ page }) => {
    // Server action compilation on first call can be slow in dev mode
    test.slow()

    const uniqueEmail = `e2e-reg-${Date.now()}@test.local`
    testEmails.push(uniqueEmail)

    await page.locator('#first_name').fill('Reg')
    await page.locator('#last_name').fill('Test')
    await page.locator('#email').fill(uniqueEmail)
    await page.locator('#password').fill('Register1234!')
    await page.locator('input[name="conduct"]').check()
    await page.locator('input[name="privacy"]').check()
    await page.locator('button[type="submit"]').click()

    const h1 = page.getByRole('heading', { level: 1, name: TEXT.register_done_title })
    await expect(h1).toBeVisible({ timeout: 60_000 })
    await expect(h1).toBeFocused()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.locator('main').getByText(uniqueEmail)).toBeVisible()
    await expect(page.getByRole('link', { name: TEXT.register_done_login })).toHaveAttribute('href', /\/login$/)

    // Resend: local Supabase has confirmations off (no signup email is sent), so the
    // auth call is stubbed and its payload checked instead of reading Mailpit.
    await page.route('**/auth/v1/resend', (route) => route.fulfill({ status: 200, json: {} }))
    const resendRequest = page.waitForRequest('**/auth/v1/resend')
    await page.getByRole('button', { name: TEXT.register_done_resend }).click()
    expect((await resendRequest).postDataJSON()).toMatchObject({ type: 'signup', email: uniqueEmail })
    await expect(page.getByRole('button', { name: TEXT.register_done_resent })).toBeDisabled()

    // Back to the form keeps the values
    await page.getByRole('button', { name: TEXT.register_done_back }).click()
    await expect(page.locator('#email')).toHaveValue(uniqueEmail)
    await expect(page.locator('#first_name')).toHaveValue('Reg')
    await expect(page.locator('input[name="conduct"]')).toBeChecked()
  })

  test('has link to login page', async ({ page }) => {
    const loginLink = page.locator('main a[href*="/login"]')
    await expect(loginLink).toBeVisible()
    await loginLink.click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('optional fields are visible', async ({ page }) => {
    await expect(page.locator('#phone')).toBeVisible()
    await expect(page.locator('#dni')).toBeVisible()
    await expect(page.locator('#postal_code')).toBeVisible()
    await expect(page.locator('#ludoya_username')).toBeVisible()
    await expect(page.locator('#bgg_username')).toBeVisible()
  })
})
