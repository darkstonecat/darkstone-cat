import { test, expect } from '../fixtures'
import { createTestUser, deleteTestUser, getMemberNumber } from '../helpers/supabase-admin'
import { expectHydrated } from '../helpers/hydration'

// A-6 and A-7 through the real stack: a board member gives a throwaway active member a baixa and
// then reinstates them. The member is created and deleted here; the shared fixtures stay untouched.
const EMAIL = 'e2e-throwaway-membership@test.local'

test.describe('Admin leave and rejoin (A-6, A-7)', () => {
  let number: string

  test.beforeAll(async () => {
    await deleteTestUser(EMAIL)
    await createTestUser({ email: EMAIL, password: 'Throwaway1234!', firstName: 'Mara', lastName: 'Baixa' })
    number = await getMemberNumber(EMAIL)
  })

  test.afterAll(async () => {
    await deleteTestUser(EMAIL)
  })

  test('the board gives a baixa and then reinstates the member; the file switches state', async ({
    adminPage: page,
  }) => {
    await page.goto(`/admin/members/${number}`)
    await expect(page.getByText('Actiu', { exact: true })).toBeVisible()
    await expectHydrated(page.getByRole('button', { name: 'Dona de baixa' }))

    // A-6
    await page.getByRole('button', { name: 'Dona de baixa' }).click()
    const leave = page.getByRole('dialog', { name: 'Dona de baixa' })
    const confirmLeave = leave.getByRole('button', { name: 'Dona de baixa' })
    await expect(confirmLeave).toBeDisabled()
    await leave.getByLabel(/^Motiu/).fill('Prova automàtica de baixa')
    await expect(confirmLeave).toBeEnabled()
    await confirmLeave.click()

    await expect(page.getByText(/^Baixa des de/)).toBeVisible()
    await expect(page.getByText('El soci ha quedat de baixa.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reincorpora' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dona de baixa' })).toHaveCount(0)
    await // The Activitat card repeats the reason in its detail line: match the Pertinença field only.
    await expect(page.getByText('Prova automàtica de baixa', { exact: true })).toBeVisible()

    // A-7
    await page.getByRole('button', { name: 'Reincorpora' }).click()
    const rejoin = page.getByRole('dialog', { name: 'Reincorpora' })
    const confirmRejoin = rejoin.getByRole('button', { name: 'Reincorpora' })
    await expect(confirmRejoin).toBeDisabled()
    await expect(rejoin.getByText(/La junta|la va donar la junta/)).toBeVisible()
    for (const box of await rejoin.getByRole('checkbox').all()) await box.check()
    await expect(confirmRejoin).toBeDisabled()
    await rejoin.getByRole('radio', { name: 'En persona' }).check()
    await expect(confirmRejoin).toBeEnabled()
    await confirmRejoin.click()

    await expect(page.getByText('El soci s\'ha reincorporat.')).toBeVisible()
    await expect(page.getByText('Actiu', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dona de baixa' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reincorpora' })).toHaveCount(0)
  })
})
