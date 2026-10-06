import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'

// A-16 through the real UI: dialog -> POST /api/admin/members/emails -> download. The export only
// reads data (and writes an audit entry), so the shared read-only board fixture is safe.
// There is no superadmin fixture (e2e never creates one), so S-4 is only checked as absent.
test.describe('Admin export dialogs (V-2)', () => {
  test('a board member downloads the association e-mail CSV from the A-16 dialog', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Exporta correus' }).click()

    const dialog = page.getByRole('dialog', { name: 'Exporta correus' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Descarrega CSV' })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Copia les adreces' })).toBeDisabled()

    await dialog.getByRole('radio', { name: /Comunicacions de l'associació/ }).check({ force: true })
    const [response, download] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/admin/members/emails') && r.request().method() === 'POST'),
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Descarrega CSV' }).click(),
    ])

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/csv; charset=utf-8')
    expect(response.headers()['cache-control']).toContain('no-store')
    expect(response.headers()['content-disposition']).toMatch(
      /^attachment; filename="darkstone_emails_association_\d{4}-\d{2}-\d{2}\.csv"$/
    )
    expect(response.request().postDataJSON()).toEqual({ list: 'association', format: 'csv' })
    expect(download.suggestedFilename()).toMatch(/^darkstone_emails_association_/)
    await expect(dialog.getByRole('status')).toHaveText('CSV descarregat.')
  })

  test('the newsletter list posts its own list name', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Exporta correus' }).click()
    const dialog = page.getByRole('dialog', { name: 'Exporta correus' })
    await dialog.getByRole('radio', { name: /Butlletí/ }).check({ force: true })
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/admin/members/emails')),
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Descarrega CSV' }).click(),
    ])
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toEqual({ list: 'newsletter', format: 'csv' })
  })

  test('the llibre de socis button is absent for a board member', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    await expect(page.getByRole('button', { name: 'Exporta CSV' })).toBeVisible()
    await expect(page.getByRole('button', { name: /llibre de socis/ })).toHaveCount(0)
  })
})
