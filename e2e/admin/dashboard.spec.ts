import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'

test.describe('Admin dashboard', () => {
  test('admin can access dashboard', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    await expect(page).toHaveURL(/\/admin/)
  })

  test('shows stat cards', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    // Dashboard has stat cards with numbers
    const statCards = page.locator('[class*="grid"] > div').first()
    await expect(statCards).toBeVisible()
  })

  test('has link to members management', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    // The tab and the dashboard card both link to the list.
    const membersLink = page.locator('a[href*="/admin/members"]').first()
    await expect(membersLink).toBeVisible()
  })

  test('member (no board role) gets the 404 page', async ({ memberPage: page }) => {
    // The proxy only requires a session; the page guard (requireRole) hides the
    // panel from anyone without a board role.
    const response = await page.goto(PAGES.admin)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Pàgina no trobada' })).toBeVisible()
  })

  test('member gets the 404 page on the members list too', async ({ memberPage: page }) => {
    const response = await page.goto(PAGES.adminMembers)
    expect(response?.status()).toBe(404)
  })
})
