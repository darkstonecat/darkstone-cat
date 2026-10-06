import { createClient } from '@supabase/supabase-js'
import { test, expect } from '../fixtures'
import { MEMBER_EMAIL } from '../helpers/constants'
import { findUserByEmail } from '../helpers/supabase-admin'

// V-4 through the real stack. The entry it reads is written by the A-11 export the test runs
// itself (one `export.member_data` row for the shared read-only member), so it does not depend on
// the order of the other specs.
async function memberNumberOf(email: string): Promise<string> {
  const id = await findUserByEmail(email)
  expect(id).not.toBeNull()
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.from('members').select('member_number').eq('id', id!).single()
  expect(error).toBeNull()
  return data!.member_number as string
}

test.describe('Admin activity log (V-4)', () => {
  test('a board member filters by an action group and follows the member file link', async ({ adminPage: page }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)

    // Produce one entry: the member data export (A-11) from the member file.
    await page.goto(`/admin/members/${number}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Exporta dades' }).click()
    const dialog = page.getByRole('dialog', { name: 'Exporta dades del soci' })
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/admin/members/${number}/data`) && r.request().method() === 'POST'),
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Descarrega JSON' }).click(),
    ])
    await expect(dialog.getByRole('status')).toHaveText('JSON descarregat.')

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
