import { test, expect } from '@playwright/test'
import { PAGES, TEXT } from '../helpers/constants'

test.describe('Contact form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGES.contact)
  })

  test('renders contact form', async ({ page }) => {
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#subject')).toBeVisible()
    await expect(page.locator('#message')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#name-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#email-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#subject-error')).toContainText(TEXT.required_field)
    await expect(page.locator('#message-error')).toContainText(TEXT.required_field)
  })

  test('shows email format error', async ({ page }) => {
    await page.locator('#name').fill('Test User')
    await page.locator('#email').fill('bad-email')
    await page.locator('#subject').fill('Subject')
    await page.locator('#message').fill('Message body')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#email-error')).toContainText(TEXT.invalid_email)
  })

  test('successful submission shows success message', async ({ page }) => {
    // Mock the contact API endpoint
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    )

    await page.locator('#name').fill('E2E Tester')
    await page.locator('#email').fill('test@example.com')
    await page.locator('#subject').fill('E2E Test Subject')
    await page.locator('#message').fill('This is an automated test message.')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="status"]')).toContainText(
      TEXT.contact_success_title,
      { timeout: 5_000 },
    )
  })

  test('sends the bot-trap fields and keeps the honeypot out of reach', async ({ page }) => {
    const trap = page.locator('input[name="website"]')
    await expect(trap).toHaveAttribute('tabindex', '-1')
    await expect(trap).toHaveAttribute('autocomplete', 'off')
    await expect(trap.locator('xpath=..')).toHaveAttribute('aria-hidden', 'true')
    // Off-screen: a person can neither see nor click it.
    const box = await trap.boundingBox()
    expect(box!.x + box!.width).toBeLessThan(0)

    let payload: Record<string, unknown> | null = null
    await page.route('**/api/contact', async (route) => {
      payload = route.request().postDataJSON()
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    })

    await page.locator('#name').fill('E2E Tester')
    await page.locator('#email').fill('test@example.com')
    await page.locator('#subject').fill('Subject')
    await page.locator('#message').fill('Message body')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('[role="status"]')).toBeVisible()
    expect(payload).toMatchObject({ website: '', elapsedMs: expect.any(Number) })
  })

  test('limits the length of each field', async ({ page }) => {
    await expect(page.locator('#name')).toHaveAttribute('maxlength', '100')
    await expect(page.locator('#email')).toHaveAttribute('maxlength', '254')
    await expect(page.locator('#subject')).toHaveAttribute('maxlength', '150')
    await expect(page.locator('#message')).toHaveAttribute('maxlength', '5000')
  })

  test('shows error on API failure', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/contact', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    )

    await page.locator('#name').fill('E2E Tester')
    await page.locator('#email').fill('test@example.com')
    await page.locator('#subject').fill('Test')
    await page.locator('#message').fill('Test message')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText(TEXT.contact_error_title)).toBeVisible()
  })

  test('clears validation errors on input', async ({ page }) => {
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#name-error')).toBeVisible()

    await page.locator('#name').fill('Test')
    await expect(page.locator('#name-error')).not.toBeVisible()
  })
})
