import { test, expect } from '../fixtures'
import { MEMBER_EMAIL } from '../helpers/constants'
import { exportMemberData, memberNumberOf } from '../helpers/admin-audit'

// V-4 through the real stack. The entry it reads is written by the A-11 export the test runs
// itself (one `export.member_data` row for the shared read-only member), so it does not depend on
// the order of the other specs.
test.describe('Admin activity log (V-4)', () => {
  test('a board member filters by an action group and follows the member file link', async ({ adminPage: page }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)

    // Produce one entry: the member data export (A-11) from the member file.
    await exportMemberData(page, number)

    // "Veure-ho al registre" lands on the log filtered to this member.
    await page.reload()
    await page.getByRole('link', { name: /Veure-ho al registre/ }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/activity\\?target=${number}$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Activitat' })).toBeVisible()
    await expect(page.getByLabel('Soci')).toHaveValue(number)
    const table = page.getByRole('table', { name: "Registre d'activitat" })
    await expect(table.getByText(`exportat les dades del soci ${number}`).first()).toBeVisible()
    await expect(table.getByText('E2E Admin').first()).toBeVisible()
    // Read-only: nothing to click inside the table.
    await expect(table.getByRole('link')).toHaveCount(0)
    await expect(table.getByRole('button')).toHaveCount(0)

    // Filter by an action group: the entry stays, the other groups are gone.
    await page.getByLabel('Acció').selectOption("export.member_data")
    await page.getByRole('button', { name: 'Aplica' }).click()
    await expect(page).toHaveURL(/action=export\.member_data/)
    await expect(table.getByText(`exportat les dades del soci ${number}`).first()).toBeVisible()
    await expect(table.getByText(/ha (donat de baixa|reincorporat)/i)).toHaveCount(0)

    // A group that has no entry for this member shows the empty state.
    await page.getByLabel('Acció').selectOption('role.*')
    await page.getByRole('button', { name: 'Aplica' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Cap entrada coincideix amb els filtres.' })).toBeVisible()

    await page.getByRole('link', { name: 'Neteja' }).click()
    await expect(page).toHaveURL(/\/admin\/activity$/)
  })

  test('shows the activity tab and ignores a malformed filter', async ({ adminPage: page }) => {
    const response = await page.goto("/admin/activity?action=nope&before=abc&from=2026-02-30&actor=zzz&target=a%2Fb")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('link', { name: 'Activitat' }).first()).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('Acció')).toHaveValue('')
    await expect(page.getByLabel('Soci')).toHaveValue('')
  })

  test('a plain member gets the 404 page', async ({ memberPage: page }) => {
    expect((await page.goto('/admin/activity'))?.status()).toBe(404)
  })
})
