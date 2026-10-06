import { test, expect } from '../fixtures'
import { PAGES, MEMBER_EMAIL } from '../helpers/constants'
import { exportMemberData, memberNumberOf } from '../helpers/admin-audit'

test.describe('Admin dashboard (V-1)', () => {
  test('a board member sees the six figures with numbers', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { level: 2, name: 'Xifres' })).toBeVisible()
    for (const label of [
      'Socis actius',
      'Altes aquest mes',
      'Baixes aquest mes',
      'Reincorporacions aquest any',
      'Butlletí',
      'Membres de la junta',
    ]) {
      const card = page.locator('p', { hasText: new RegExp(`^${label}$`) }).locator('..')
      await expect(card).toBeVisible()
      // The big number is the second paragraph of the card.
      await expect(card.locator('p').nth(1)).toHaveText(/^\d+$/)
    }
    // The e2e users are active members and at least one of them holds a board role.
    const active = page.locator('p', { hasText: /^Socis actius$/ }).locator('..').locator('p').nth(1)
    expect(Number(await active.textContent())).toBeGreaterThanOrEqual(2)
    const board = page.locator('p', { hasText: /^Membres de la junta$/ }).locator('..').locator('p').nth(1)
    expect(Number(await board.textContent())).toBeGreaterThanOrEqual(1)
  })

  test('shows the latest activity and the shortcuts', async ({ adminPage: page }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)
    await exportMemberData(page, number)

    await page.goto(PAGES.admin)
    const activity = page.getByRole('region', { name: 'Activitat recent' })
    await expect(activity.getByText(`exportat les dades del soci ${number}`).first()).toBeVisible()
    await expect(activity.getByText('E2E Admin').first()).toBeVisible()
    await expect(activity.getByRole('link', { name: /Veure tot el registre/ })).toHaveAttribute('href', '/admin/activity')

    const shortcuts = page.getByRole('complementary', { name: 'Dreceres' })
    await expect(shortcuts.getByRole('link', { name: /Cerca un soci/ })).toHaveAttribute('href', '/admin/members')
    await expect(shortcuts.getByRole('link', { name: /Eines/ })).toHaveAttribute('href', '/admin/tools')
    await expect(shortcuts.getByRole('link', { name: /Procediments/ })).toHaveAttribute('href', '/admin/procedures')
  })

  test('has a link to members management', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    // The tab and the shortcuts both link to the list.
    await expect(page.locator('a[href*="/admin/members"]').first()).toBeVisible()
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
