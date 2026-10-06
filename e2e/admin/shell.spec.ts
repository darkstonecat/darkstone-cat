import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'

test.describe('Admin shell', () => {
  test('shows the header, the signed-in line and the board tabs', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    await expect(page.getByRole('heading', { level: 1, name: 'Resum' })).toBeVisible()
    await expect(page.getByText('Has entrat com a')).toBeVisible()

    const tabs = page.getByRole('navigation', { name: 'Administració' })
    await expect(tabs.getByRole('link')).toHaveText(['Resum', 'Socis', 'Activitat', 'Procediments', 'Eines'])
    await expect(tabs.getByRole('link', { name: 'Resum' })).toHaveAttribute('aria-current', 'page')
  })

  test('tab links point at the admin views and mark the current one', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    const tabs = page.getByRole('navigation', { name: 'Administració' })
    await expect(tabs.getByRole('link', { name: 'Socis' })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Activitat' })).toHaveAttribute('href', '/admin/activity')
    await expect(page.getByRole('heading', { level: 1, name: 'Socis' })).toBeVisible()
  })

  test('a member gets the 404 page on an admin sub-route, a board member the page', async ({
    memberPage,
    adminPage,
  }) => {
    expect((await memberPage.goto('/admin/procedures'))?.status()).toBe(404)
    expect((await adminPage.goto('/admin/procedures'))?.status()).toBe(200)
  })
})
