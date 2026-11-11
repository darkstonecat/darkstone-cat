import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'
import { expectHydrated } from '../helpers/hydration'

// Member benefits card (odd/tasks/member-benefits.md S6): the seeded Outlet Games benefit with its
// code, in the member home (/profile) right above "Properes sessions", only inside the member area. Other benefits may appear while the admin flow runs.
test.describe('Member benefits card (S6)', () => {
  test('an active member sees Outlet Games with the code and the shop link', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const card = page.getByRole('region', { name: 'Beneficis per ser soci' })
    // Order of the home: badges, then this card, right above "Properes sessions".
    const badges = page.getByRole('region', { name: 'Les teves insígnies' })
    const sessions = page.getByRole('region', { name: 'Properes sessions' })
    await expect(badges).toBeVisible()
    await expect(sessions).toBeVisible()
    const follows = async (a: typeof card, b: typeof card) =>
      a.evaluate(
        (node, other) => Boolean(node.compareDocumentPosition(other as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
        await b.elementHandle()
      )
    expect(await follows(badges, card)).toBe(true)
    expect(await follows(card, sessions)).toBe(true)
    const nextSection = await card.evaluate((node) => node.nextElementSibling?.getAttribute('aria-labelledby'))
    expect(nextSection).toBe('sessions-title')
    const outlet = card.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Outlet Games' }) })
    await expect(outlet.getByText('DARKSTONE', { exact: true })).toBeVisible()
    await expect(outlet.getByRole('img', { name: 'Outlet Games' })).toBeVisible()
    const link = outlet.getByRole('link', { name: /Ves a Outlet Games/ })
    await expect(link).toHaveAttribute('href', 'https://outletgames.es')
    await expect(link).toHaveAttribute('target', '_blank')

    const copy = outlet.getByRole('button', { name: 'Copia el codi de Outlet Games' })
    await expectHydrated(copy)
  })

  test('the profile details page no longer shows the card', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    await expect(page.getByRole('heading', { name: 'On jugues' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Beneficis per ser soci' })).toHaveCount(0)
  })

  test('the code is not on public pages', async ({ page }) => {
    for (const path of ['/about', '/']) {
      await page.goto(path)
      await expect(page.locator('body')).not.toContainText('DARKSTONE')
    }
  })
})
