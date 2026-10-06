import { test, expect } from '../fixtures'
import { PAGES, TEXT } from '../helpers/constants'
import { createTestUser, deleteTestUser } from '../helpers/supabase-admin'

// M-1 self leave and the former-member sign-in (spec §4.4, §7.1, T26). Uses its own throwaway
// member: the shared e2e users stay active.

const LEAVER_EMAIL = `e2e-leaver-${Date.now()}@test.local`
const LEAVER_PASSWORD = 'Leaver1234!'

test.describe('Leaving the association (M-1)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await createTestUser({ email: LEAVER_EMAIL, password: LEAVER_PASSWORD, firstName: 'E2E', lastName: 'Leaver' })
  })

  test.afterAll(async () => {
    await deleteTestUser(LEAVER_EMAIL)
  })

  test('a member leaves from Compte, is signed out and can no longer sign in', async ({ page }) => {
    await page.goto(PAGES.login)
    await page.locator('#email').fill(LEAVER_EMAIL)
    await page.locator('#password').fill(LEAVER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/profile', { timeout: 15_000 })

    await page.goto(PAGES.profileDetails)
    await page.getByRole('button', { name: "Dona't de baixa" }).click()
    const dialog = page.getByRole('dialog', { name: "Dona't de baixa" })
    await expect(dialog.getByText('No podràs entrar.')).toBeVisible()
    const confirm = dialog.getByRole('button', { name: "Dona'm de baixa" })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('Motiu (opcional)').fill('Em trasllado')
    await dialog.getByRole('checkbox', { name: /Entenc el que passarà/ }).check()
    await confirm.click()

    await page.waitForURL('**/login?left=1', { timeout: 15_000 })
    await expect(page.locator('form').getByRole('status')).toContainText("T'has donat de baixa")

    // Signed out: the member area sends the browser to /login.
    await page.goto(PAGES.profile)
    await page.waitForURL(/\/login/)

    // The ban gives exactly the wrong-password error, with the help line.
    await page.locator('#email').fill(LEAVER_EMAIL)
    await page.locator('#password').fill(LEAVER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(TEXT.login_error_invalid)
    await expect(page.getByText("Si no pots entrar o t'has donat de baixa, contacta amb la junta.")).toBeVisible()

    await page.getByRole('link', { name: 'Contacta amb la junta' }).click()
    await page.waitForURL(/\/contact\?subject=/)
    await expect(page.locator('#subject')).toHaveValue('Vull tornar a ser soci')
  })

  test('a wrong password shows the same error and help line', async ({ page }) => {
    await page.goto(PAGES.login)
    await page.locator('#email').fill('nobody-e2e@test.local')
    await page.locator('#password').fill('WrongPassword1!')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('form').getByRole('alert')).toHaveText(TEXT.login_error_invalid)
    await expect(page.getByRole('link', { name: 'Contacta amb la junta' })).toBeVisible()
  })

  test('a board member cannot open the leave dialog (BR-12)', async ({ adminPage }) => {
    await adminPage.goto(PAGES.profileDetails)
    const button = adminPage.getByRole('button', { name: "Dona't de baixa" })
    await expect(button).toBeDisabled()
    await expect(
      adminPage.getByText('Abans de donar-te de baixa, un superadmin t\'ha de treure el rol de la junta.')
    ).toBeVisible()
  })
})
