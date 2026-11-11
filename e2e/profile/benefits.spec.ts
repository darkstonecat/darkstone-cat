import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'
import { expectHydrated } from '../helpers/hydration'

// Member benefits card (odd/tasks/member-benefits.md S6): the seeded Outlet Games benefit with its
// code, only inside the member area. Other benefits may appear while the admin flow runs.
test.describe('Member benefits card (S6)', () => {
  test('an active member sees Outlet Games with the code and the shop link', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    const card = page.getByRole('region', { name: 'Beneficis per ser soci' })
    const outlet = card.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Outlet Games' }) })
    await expect(outlet.getByText('DARKSTONE', { exact: true })).toBeVisible()
    await expect(outlet.getByRole('img', { name: 'Outlet Games' })).toBeVisible()
    const link = outlet.getByRole('link', { name: /Ves a Outlet Games/ })
    await expect(link).toHaveAttribute('href', 'https://outletgames.es')
    await expect(link).toHaveAttribute('target', '_blank')

    const copy = outlet.getByRole('button', { name: 'Copia el codi de Outlet Games' })
    await expectHydrated(copy)
  })

  test('the code is not on public pages', async ({ page }) => {
    for (const path of ['/about', '/']) {
      await page.goto(path)
      await expect(page.locator('body')).not.toContainText('DARKSTONE')
    }
  })
})
