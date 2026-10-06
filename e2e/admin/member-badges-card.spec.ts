import { test, expect } from '../fixtures'
import { createTestUser, deleteTestUser, getMemberNumber } from '../helpers/supabase-admin'
import { expectHydrated } from '../helpers/hydration'

// A-8 and A-9 through the real stack on a throwaway active member; the shared fixtures stay
// untouched. The access link (A-15) is covered by component and integration tests: it sends a
// real e-mail and consumes a shared rate-limit bucket.
const EMAIL = 'e2e-throwaway-badges@test.local'

test.describe('Admin badges and card (A-8, A-9)', () => {
  // One throwaway member shared by the tests: run them in a single worker (fullyParallel would
  // run beforeAll, and its delete + create, once per worker at the same time).
  test.describe.configure({ mode: 'serial' })

  let number: string

  test.beforeAll(async () => {
    await deleteTestUser(EMAIL)
    await createTestUser({ email: EMAIL, password: 'Throwaway1234!', firstName: 'Bia', lastName: 'Insignia' })
    number = await getMemberNumber(EMAIL)
  })

  test.afterAll(async () => {
    await deleteTestUser(EMAIL)
  })

  test('the board awards and then revokes a badge', async ({ adminPage: page }) => {
    await page.goto(`/admin/members/${number}`)
    const badges = page.getByRole('region', { name: 'Insígnies' })
    await expectHydrated(badges.getByRole('button', { name: 'Atorga insígnia' }))

    await badges.getByRole('button', { name: 'Atorga insígnia' }).click()
    const award = page.getByRole('dialog', { name: 'Atorga una insígnia' })
    const confirm = award.getByRole('button', { name: 'Atorga', exact: true })
    await expect(confirm).toBeDisabled()
    await award.getByRole('radio', { name: /Donant de la ludoteca/ }).check()
    await award.getByLabel('Nota (opcional)').fill('Prova automàtica')
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(badges.getByText('Insígnia atorgada.')).toBeVisible()
    await expect(badges.getByText('Donant de la ludoteca')).toBeVisible()

    // It cannot be awarded twice: the option is disabled and says since when.
    await badges.getByRole('button', { name: 'Atorga insígnia' }).click()
    const again = page.getByRole('dialog', { name: 'Atorga una insígnia' })
    await expect(again.getByRole('radio', { name: /Donant de la ludoteca/ })).toBeDisabled()
    await again.getByRole('button', { name: 'Cancel·la' }).click()

    await badges.getByRole('button', { name: 'Retira «Donant de la ludoteca»' }).click()
    const revoke = page.getByRole('dialog', { name: 'Retira «Donant de la ludoteca»?' })
    await revoke.getByRole('button', { name: 'Retira', exact: true }).click()
    await expect(badges.getByText('Insígnia retirada.')).toBeVisible()
    await expect(badges.getByRole('button', { name: /^Retira «/ })).toHaveCount(0)
  })

  test('the board regenerates the card and sees the success notice', async ({ adminPage: page }) => {
    await page.goto(`/admin/members/${number}`)
    const card = page.getByRole('region', { name: 'Carnet' })
    await expectHydrated(card.getByRole('button', { name: 'Regenera el carnet' }))

    await card.getByRole('button', { name: 'Regenera el carnet' }).click()
    const dialog = page.getByRole('dialog', { name: 'Regenera el carnet' })
    await expect(dialog.getByText(/El QR actual deixa de funcionar/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Regenera carnet' }).click()

    await expect(card.getByText('Carnet regenerat. El QR anterior ja no funciona.')).toBeVisible()
  })
})
