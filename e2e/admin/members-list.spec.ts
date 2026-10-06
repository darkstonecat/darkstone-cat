import { test, expect } from '../fixtures'
import { PAGES, ADMIN_EMAIL, EDITOR_EMAIL } from '../helpers/constants'

// The fixtures create three confirmed members (e2e-member, e2e-admin, e2e-editor). Other specs
// may add data, so assertions look for these rows by e-mail instead of counting everything.
test.describe('Admin members list', () => {
  test('a board member sees the list with search, filters, export and the state chips', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await expect(page).toHaveURL(/\/admin\/members$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Socis' })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Cerca' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Actius' })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Exporta CSV' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exporta correus' })).toBeEnabled()

    const table = page.getByRole('table')
    await expect(table.getByRole('columnheader')).toHaveText(['Núm.', 'Nom i cognoms', 'Email', 'Estat', 'Rol', 'Alta actual'])
    await expect(page.getByText(/Mostrant \d+–\d+ de \d+/)).toBeVisible()
  })

  test('the search round-trips through the URL and finds a member by e-mail', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await page.getByRole('searchbox', { name: 'Cerca' }).fill(EDITOR_EMAIL)
    await page.getByRole('searchbox', { name: 'Cerca' }).press('Enter')
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EDITOR_EMAIL).replace(/\./g, '\\.')}`))
    const table = page.getByRole('table')
    await expect(table.getByText(EDITOR_EMAIL)).toBeVisible()
    await expect(table.getByText(ADMIN_EMAIL)).toHaveCount(0)

    // Reloading keeps the search box and the result.
    await page.reload()
    await expect(page.getByRole('searchbox', { name: 'Cerca' })).toHaveValue(EDITOR_EMAIL)
    await expect(table.getByText(EDITOR_EMAIL)).toBeVisible()
  })

  test('a search without matches shows the empty state', async ({ adminPage: page }) => {
    await page.goto(`${PAGES.adminMembers}?q=zzz-no-such-member-zzz`)
    await expect(page.getByRole('status').filter({ hasText: 'Cap soci coincideix amb la cerca.' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
  })

  test('the filters round-trip through the URL', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    // The filters submit from React onChange handlers: wait until the page is hydrated.
    await page.waitForLoadState('networkidle')
    await page.getByRole('radio', { name: 'Exsocis', exact: true }).check({ force: true })
    await expect(page).toHaveURL(/state=former/)
    await expect(page.getByRole('radio', { name: 'Exsocis' })).toBeChecked()
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Rol', { exact: true }).selectOption('superadmin')
    await expect(page).toHaveURL(/state=former/)
    await expect(page).toHaveURL(/role=superadmin/)
    await expect(page.getByLabel('Rol', { exact: true })).toHaveValue('superadmin')
  })

  test('sorting by a header toggles the direction in the URL', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await page.getByRole('columnheader', { name: /Nom i cognoms/ }).getByRole('link').click()
    await expect(page).toHaveURL(/sort=name_asc/)
    await expect(page.getByRole('columnheader', { name: /Nom i cognoms/ })).toHaveAttribute('aria-sort', 'ascending')
    await page.getByRole('columnheader', { name: /Nom i cognoms/ }).getByRole('link').click()
    await expect(page).toHaveURL(/sort=name_desc/)
  })

  test('invalid URL parameters fall back to the defaults instead of failing', async ({ adminPage: page }) => {
    const response = await page.goto(`${PAGES.adminMembers}?state=purged&role=owner&sort=email_asc&page=-3&pp=9999&q=%00x`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('radio', { name: 'Actius' })).toBeChecked()
    await expect(page.getByLabel('Rol', { exact: true })).toHaveValue('all')
    await expect(page.getByText('No s\'ha pogut carregar')).toHaveCount(0)
  })

  test('a page past the end goes back to the first page', async ({ adminPage: page }) => {
    await page.goto(`${PAGES.adminMembers}?page=500`)
    await expect(page).toHaveURL(/\/admin\/members$/)
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('the CSV dialog opens from the list', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await page.getByRole('button', { name: 'Exporta CSV' }).click()
    await expect(page.getByRole('dialog', { name: 'Exportar dades de socis' })).toBeVisible()
  })

  test('a member gets the 404 page', async ({ memberPage: page }) => {
    const response = await page.goto(PAGES.adminMembers)
    expect(response?.status()).toBe(404)
  })
})
