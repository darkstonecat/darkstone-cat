import { test, expect } from '../fixtures'
import { createTestUser, deleteTestUser, getMemberNumber } from '../helpers/supabase-admin'
import { expectHydrated } from '../helpers/hydration'

// Badge catalogue (odd/tasks/badge-catalogue.md S7) through the real stack. The flow writes
// catalogue data, so it uses a uniquely keyed badge and a throwaway member; the shared fixtures
// stay untouched. The audit log is append-only and an awarded badge cannot be deleted, so the
// badge is left archived at the end (members never see it).
const EMAIL = 'e2e-throwaway-badge-catalogue@test.local'

test.describe('Admin badge catalogue (S7)', () => {
  test.describe.configure({ mode: 'serial' })

  let number: string

  test.beforeAll(async () => {
    await deleteTestUser(EMAIL)
    await createTestUser({ email: EMAIL, password: 'Throwaway1234!', firstName: 'Ona', lastName: 'Cataleg' })
    number = await getMemberNumber(EMAIL)
  })

  test.afterAll(async () => {
    await deleteTestUser(EMAIL)
  })

  test('the board creates, edits, awards, archives and restores a badge', async ({ adminPage: page }) => {
    test.slow()
    const suffix = `${Date.now()}`
    const key = `e2e_cat_${suffix}`
    const name = `Prova e2e ${suffix}`
    const renamed = `Prova reanomenada ${suffix}`

    // Catalogue: tab and "Nova insígnia".
    await page.goto('/admin/badges')
    await expect(page.getByRole('heading', { level: 1, name: 'Insígnies' })).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Administració' })
    await expect(tabs.getByRole('link', { name: 'Insígnies' })).toHaveAttribute('aria-current', 'page')
    const active = page.getByRole('region', { name: 'Insígnies actives' })
    await expect(active.getByText('X anys amb Darkstone')).toBeVisible()

    const newButton = active.getByRole('button', { name: 'Nova insígnia' })
    await expectHydrated(newButton)
    await newButton.click()
    const create = page.getByRole('dialog', { name: 'Nova insígnia' })
    await create.getByLabel('Nom en català').fill(name)
    await expect(create.getByLabel('Clau')).toHaveValue(`prova_e2e_${suffix}`)
    await create.getByLabel('Clau').fill(key)
    await create.getByLabel('Text quan la té').fill('Ha superat la prova automàtica.')
    await create.getByLabel('Text quan encara no la té').fill('Supera la prova automàtica.')
    await create.getByRole('button', { name: 'Crea i obre' }).click()

    // Badge page: rename, change the icon and hide it from members who do not have it. Hiding it
    // in the first save keeps it out of the member home that profile tests read in parallel.
    await expect(page).toHaveURL(new RegExp(`/admin/badges/${key}$`))
    await expect(page.getByText(`Clau: ${key}`)).toBeVisible()
    const nameField = page.getByRole('textbox', { name: 'Nom', exact: true })
    await expectHydrated(nameField)
    await expect(nameField).toHaveValue(name)
    await nameField.fill(renamed)
    const dice = page.getByRole('button', { name: 'Dau' })
    await dice.click()
    await expect(dice).toHaveAttribute('aria-pressed', 'true')
    const toggle = page.getByRole('switch', { name: 'Mostra-la bloquejada a qui no la té' })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    const preview = page.getByRole('region', { name: 'Com la veu el soci' })
    await expect(preview.getByText(renamed).first()).toBeVisible()
    await page.getByRole('button', { name: 'Desa', exact: true }).click()
    await expect(page.getByText('Canvis desats.')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: renamed })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Mostra-la bloquejada a qui no la té' })).toHaveAttribute('aria-checked', 'false')

    // Bulk award to the throwaway member.
    const holders = page.getByRole('region', { name: 'Socis que la tenen' })
    await holders.getByRole('button', { name: 'Atorga a socis' }).click()
    const award = page.getByRole('dialog', { name: 'Atorga a socis' })
    await expect(award.getByRole('button', { name: 'Atorga', exact: true })).toBeDisabled()
    await award.getByLabel('Cerca per nom o número').fill(number)
    await award.getByRole('checkbox', { name: /Ona Cataleg/ }).check()
    await expect(award.getByText('1 seleccionat · màxim 100')).toBeVisible()
    await award.getByLabel('Nota (opcional)').fill('Prova automàtica')
    await award.getByRole('button', { name: 'Atorga a 1 soci' }).click()
    await expect(holders.getByText('Atorgada a 1 soci')).toBeVisible()
    await expect(holders.getByRole('link', { name: 'Ona Cataleg' })).toHaveAttribute('href', `/admin/members/${number}`)

    // Archive from the catalogue: the dialog counts the active holder.
    // The back button (the tab with the same href is the current one).
    await page.locator('a[href="/admin/badges"]:not([aria-current])').click()
    await expect(page).toHaveURL(/\/admin\/badges$/)
    await expect(page.getByRole('region', { name: 'Insígnies actives' }).getByText("Oculta fins que s'aconsegueix").first()).toBeVisible()
    const archiveButton = page.getByRole('button', { name: `Arxiva «${renamed}»` })
    await expectHydrated(archiveButton)
    await archiveButton.click()
    const archive = page.getByRole('dialog', { name: 'Arxiva la insígnia' })
    await expect(archive.getByText('1', { exact: true })).toBeVisible()
    await expect(archive.getByText('soci actiu la deixarà de veure al seu perfil.')).toBeVisible()
    await archive.getByRole('button', { name: 'Arxiva', exact: true }).click()
    await expect(page.getByText('Insígnia arxivada.')).toBeVisible()
    const archived = page.getByRole('region', { name: 'Arxivades' })
    await expect(archived.getByText(renamed)).toBeVisible()
    await expect(archived.getByText('1 soci la tenia')).toBeVisible()

    // Restore it, then leave it archived again.
    await archived.getByRole('button', { name: `Restaura «${renamed}»` }).click()
    await page.getByRole('dialog', { name: 'Restaura la insígnia' }).getByRole('button', { name: 'Restaura', exact: true }).click()
    await expect(page.getByText('Insígnia restaurada.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Insígnies actives' }).getByText(renamed)).toBeVisible()

    await page.getByRole('button', { name: `Arxiva «${renamed}»` }).click()
    await page.getByRole('dialog', { name: 'Arxiva la insígnia' }).getByRole('button', { name: 'Arxiva', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Arxivades' }).getByText(renamed)).toBeVisible()
  })

  test('an unknown or malformed badge key is a 404', async ({ adminPage: page }) => {
    const unknown = await page.goto('/admin/badges/no_such_badge_e2e')
    expect(unknown?.status()).toBe(404)
    const malformed = await page.goto('/admin/badges/Bad-Key')
    expect(malformed?.status()).toBe(404)
  })
})
