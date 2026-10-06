import { test, expect } from '../fixtures'
import { createTestUser, deleteTestUser, getMemberNumber } from '../helpers/supabase-admin'

// A-4 / A-5 through the real stack, on a throwaway active member (the shared fixtures are
// read-only and must stay untouched by parallel tests).
const EMAIL = 'e2e-throwaway-edit@test.local'

test.describe('Admin member edit and reveal (A-4, A-5)', () => {
  let number: string

  test.beforeAll(async () => {
    await deleteTestUser(EMAIL)
    await createTestUser({ email: EMAIL, password: 'Throwaway1234!', firstName: 'Tina', lastName: 'Throwaway' })
    number = await getMemberNumber(EMAIL)
  })

  test.afterAll(async () => {
    await deleteTestUser(EMAIL)
  })

  test('the board edits the names, adds a DNI, and reveals it in a dialog only', async ({ adminPage: page }) => {
    await page.goto(`/admin/members/${number}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edita' }).first().click()
    const form = page.getByRole('form', { name: 'Edita les dades del soci' })
    await expect(form.getByLabel('Telèfon')).toHaveValue('')
    await expect(form.getByLabel('DNI/NIE')).toHaveValue('')

    // An invalid value shows its field message and does not save.
    await form.getByLabel('DNI/NIE').fill('123')
    await form.getByRole('button', { name: 'Desa els canvis' }).click()
    await expect(form.getByText('Format de DNI/NIE no vàlid.')).toBeVisible()

    await form.getByLabel(/^Nom/).fill('Tània')
    await form.getByLabel(/^Cognoms/).fill('Provisional')
    await form.getByLabel('DNI/NIE').fill('12345678Z')
    await form.getByRole('button', { name: 'Desa els canvis' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Dades desades.' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Tània Provisional' })).toBeVisible()
    // The DNI is only masked on the page.
    await expect(page.getByText('12345678Z')).toHaveCount(0)

    await page.getByRole('button', { name: 'Mostra el DNI' }).click()
    const dialog = page.getByRole('dialog', { name: 'Mostra el DNI' })
    await dialog.getByRole('button', { name: 'Mostra el DNI' }).click()
    await expect(dialog.getByTestId('revealed-value')).toHaveText('12345678Z')

    await dialog.getByRole('button', { name: 'Tanca', exact: true }).first().click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('12345678Z')).toHaveCount(0)
  })
})
