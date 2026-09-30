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

  test('successful registration swaps to the confirmation screen', async ({ page }) => {
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

    await expect(page.getByRole('heading', { level: 1, name: TEXT.register_done_title })).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('main').getByText(uniqueEmail)).toBeVisible()
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
