import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'

test.describe('Home page, signed-in member', () => {
  test('the hero button sends a member to the events', async ({ memberPage: page }) => {
    await page.goto(PAGES.home)
    const cta = page.locator('#hero').getByRole('link', { name: /Mira què juguem aquesta setmana/ })
    await expect(cta).toBeVisible({ timeout: 10_000 })
    await expect(cta).toHaveAttribute('href', '/events')
  })
})
