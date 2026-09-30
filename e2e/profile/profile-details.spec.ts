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

// These tests write profile data, so they use the dedicated editor user (the shared
// member is read by other specs in parallel) and run one after another.
test.describe('Profile details cards', () => {
  test.describe.configure({ mode: 'serial' })

  test('shows the four cards for a member', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    for (const name of ['On jugues', 'Dades de soci', 'Comunicacions', 'Compte']) {
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: 'Edita' })).toHaveAttribute('href', '/profile/edit')
    await expect(page.getByRole('button', { name: 'Canvia la contrasenya' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Descarrega les meves dades' })).toBeVisible()
    await expect(page.getByRole('button', { name: "Dona't de baixa" })).toBeVisible()
  })

  test('links and unlinks a BGG username', async ({ editorPage: page }) => {
    test.slow()
    await page.goto(PAGES.profileDetails)
    const tile = page.getByTestId('gaming-tile-bgg')
    if (await tile.getByRole('button', { name: 'Desvincula' }).isVisible()) {
      await tile.getByRole('button', { name: 'Desvincula' }).click()
    }
    await tile.getByPlaceholder('Usuari de BGG').fill('@e2e-editor')
    await tile.getByRole('button', { name: 'Vincula' }).click()
    await expect(tile.getByText('@e2e-editor')).toBeVisible()
    await expect(tile.getByRole('link', { name: /Veure a BGG/ })).toHaveAttribute(
      'href',
      'https://boardgamegeek.com/user/e2e-editor'
    )

    await page.reload()
    await expect(page.getByTestId('gaming-tile-bgg').getByText('@e2e-editor')).toBeVisible()

    await page.getByTestId('gaming-tile-bgg').getByRole('button', { name: 'Desvincula' }).click()
    await expect(page.getByTestId('gaming-tile-bgg').getByText('Sense vincular')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('gaming-tile-bgg').getByText('Sense vincular')).toBeVisible()
  })

  test('the communications switch persists', async ({ editorPage: page }) => {
    test.slow()
    await page.goto(PAGES.profileDetails)
    const sw = page.getByRole('switch', { name: 'Comunicacions per correu' })
    const before = await sw.getAttribute('aria-checked')
    const after = before === 'true' ? 'false' : 'true'

    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', after)
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: /comunicacions per correu/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('switch', { name: 'Comunicacions per correu' })).toHaveAttribute('aria-checked', after)

    // Restore the original value.
    await page.getByRole('switch', { name: 'Comunicacions per correu' }).click()
    await expect(page.getByRole('switch', { name: 'Comunicacions per correu' })).toHaveAttribute('aria-checked', before!)
  })

  test('DNI and phone are masked and the raw values are not in the page', async ({ editorPage: page }) => {
    test.slow()
    await page.goto(PAGES.profileEdit)
    await page.locator('#dni').fill('12345678Z')
    await page.locator('#phone').fill('612345412')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/profile', { timeout: 10_000 })

    const response = await page.goto(PAGES.profileDetails)
    const html = await response!.text()
    expect(html).not.toContain('12345678Z')
    expect(html).not.toContain('612345412')

    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Dades de soci' }) })
    await expect(card.getByText('•••••678Z')).toBeVisible()
    await expect(card.getByText('••• ••• 412')).toBeVisible()
    await expect(card.getByText('DNI acabat en 678Z')).toBeAttached()
  })

  test('change password sends the recovery email', async ({ editorPage: page }) => {
    await page.route('**/auth/v1/recover*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await page.goto(PAGES.profileDetails)
    await page.getByRole('button', { name: 'Canvia la contrasenya' }).click()
    await expect(page.getByText(/T'hem enviat un correu/)).toBeVisible()
  })

  test('download my data produces a JSON file', async ({ editorPage: page }) => {
    await page.goto(PAGES.profileDetails)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descarrega les meves dades' }).click()
    expect((await download).suggestedFilename()).toMatch(/^darkstone-data-.*\.json$/)
  })
})
