import { test, expect } from '../fixtures'
import { PAGES, MEMBER_FIRST_NAME, MEMBER_LAST_NAME } from '../helpers/constants'

test.describe('Profile details shell', () => {
  test('redirects anonymous visitors to login', async ({ page }) => {
    await page.goto(PAGES.profileDetails)
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile%2Fdetails/)
  })

  test('shows the member hero with initials, name and number', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${MEMBER_FIRST_NAME} ${MEMBER_LAST_NAME}`)
    await expect(page.getByTestId('member-avatar')).toHaveText('EM')
    await expect(page.getByText('Núm. de soci')).toBeVisible()
    await expect(page.getByText('Membre des del')).toBeVisible()
  })

  test('sub-nav tabs link the member area and mark the current page', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    const tabs = page.getByRole('navigation', { name: 'Zona de socis' })
    await expect(tabs.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Inici' })).toHaveAttribute('href', '/profile')
    await expect(tabs.getByRole('link', { name: 'Carnet' })).toHaveAttribute('href', '/profile/card')
    await tabs.getByRole('link', { name: 'Carnet' }).click()
    await expect(page).toHaveURL(/\/profile\/card$/)
  })

  test('is not indexable', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})
