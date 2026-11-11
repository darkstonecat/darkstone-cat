import { test, expect } from '../fixtures'
import { expectHydrated } from '../helpers/hydration'

// Member benefits (odd/tasks/member-benefits.md S7) through the real stack. The flow writes
// benefit data, so it uses a uniquely named benefit; the seeded Outlet Games row is only read.
// Benefits cannot be deleted, so the test benefit is left archived (members never see it).
test.describe('Admin member benefits (S7)', () => {
  test('the board sees the seeded benefit, creates, edits, archives and restores one', async ({ adminPage: page }) => {
    test.slow()
    const suffix = `${Date.now()}`
    const name = `Botiga e2e ${suffix}`

    await page.goto('/admin/benefits')
    await expect(page.getByRole('heading', { level: 1, name: 'Beneficis' })).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Administració' })
    await expect(tabs.getByRole('link', { name: 'Beneficis' })).toHaveAttribute('aria-current', 'page')

    const active = page.getByRole('region', { name: 'Beneficis actius' })
    await expect(active.getByText('Codi: DARKSTONE')).toBeVisible()

    // Create.
    const newButton = active.getByRole('button', { name: 'Nou benefici' })
    await expectHydrated(newButton)
    await newButton.click()
    const create = page.getByRole('dialog', { name: 'Nou benefici' })
    await create.getByLabel('Nom').fill(name)
    await create.getByLabel('Descripció').fill('Descompte de prova automàtica.')
    await create.getByLabel('Enllaç de la botiga').fill('https://example.com/e2e')
    await create.getByLabel('Codi de descompte').fill(`E2E${suffix}`)
    await create.getByLabel('Logotip').selectOption({ label: 'Nikochan' })
    await create.getByRole('button', { name: 'Crea', exact: true }).click()
    await expect(page.getByText('Benefici creat.')).toBeVisible()
    await expect(active.getByText(name)).toBeVisible()

    // Edit: a Spanish name and a new code.
    await active.getByRole('button', { name: `Edita ${name}` }).click()
    const edit = page.getByRole('dialog', { name: 'Edita el benefici' })
    await expect(edit.getByLabel('Codi de descompte')).toHaveValue(`E2E${suffix}`)
    await edit.getByRole('tab', { name: /Castellano/ }).click()
    await edit.getByLabel('Nom').fill(`Tienda e2e ${suffix}`)
    await edit.getByLabel('Codi de descompte').fill(`NOU${suffix}`)
    await edit.getByRole('button', { name: 'Desa' }).click()
    await expect(page.getByText('Benefici desat.')).toBeVisible()
    await expect(active.getByText(`Codi: NOU${suffix}`)).toBeVisible()

    // Archive, restore, archive again (left archived).
    for (const step of ['archive', 'restore', 'archive'] as const) {
      const label = step === 'archive' ? 'Arxiva' : 'Restaura'
      await page.getByRole('button', { name: `${label} ${name}` }).click()
      const dialog = page.getByRole('dialog', { name: step === 'archive' ? 'Arxiva el benefici' : 'Restaura el benefici' })
      await dialog.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByText(step === 'archive' ? 'Benefici arxivat.' : 'Benefici restaurat.')).toBeVisible()
      await expect(dialog).toBeHidden()
    }
    await expect(page.getByRole('region', { name: 'Arxivats' }).getByText(name)).toBeVisible()

    // The activity log names the benefit.
    await page.goto('/admin/activity?action=benefit.*')
    await expect(page.locator('tbody').getByText(`ha creat el benefici «${name}»`)).toBeVisible()
  })
})
