import { createClient } from '@supabase/supabase-js'
import { test, expect } from '../fixtures'
import { MEMBER_EMAIL } from '../helpers/constants'
import { findUserByEmail } from '../helpers/supabase-admin'

// V-3 through the real stack. The member file is read-only here (T18), so the shared read-only
// e2e-member fixture is safe. A former-member file needs a mutation (leave) and is covered by the
// component and page tests; the leave action itself arrives in T20.
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

test.describe('Admin member file (V-3)', () => {
  test('a board member opens an active member from the list and goes back to the same search', async ({
    adminPage: page,
  }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)
    await page.goto(`/admin/members?q=${encodeURIComponent(MEMBER_EMAIL)}`)
    await page.getByRole('table').getByRole('link', { name: number }).click()

    await expect(page).toHaveURL(new RegExp(`/admin/members/${number}\\?list=`))
    await expect(page.getByText(`Núm. de soci ${number}`)).toBeVisible()
    await expect(page.getByText(MEMBER_EMAIL, { exact: true })).toBeVisible()
    await expect(page.getByText('Actiu', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Dades personals' })).toBeVisible()
    // DNI and phone are never values here, whatever the member stored.
    await expect(page.getByRole('heading', { level: 3, name: 'Pertinença' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Insígnies' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Carnet' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Activitat' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Veure-ho al registre/ })).toHaveAttribute(
      'href',
      `/admin/activity?target=${number}`
    )

    await page.getByRole('link', { name: 'Tots els socis' }).click()
    await expect(page).toHaveURL(/\/admin\/members\?q=/)
    await expect(page.getByRole('searchbox', { name: 'Cerca' })).toHaveValue(MEMBER_EMAIL)
  })

  test('an unknown or malformed member number is the 404 page', async ({ adminPage: page }) => {
    expect((await page.goto('/admin/members/999-999'))?.status()).toBe(404)
    expect((await page.goto('/admin/members/' + 'a'.repeat(40)))?.status()).toBe(404)
  })

  test('a plain member gets the 404 page', async ({ memberPage: page }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)
    expect((await page.goto(`/admin/members/${number}`))?.status()).toBe(404)
  })

  test('a board member downloads the data of an active member from the file (A-11)', async ({ adminPage: page }) => {
    const number = await memberNumberOf(MEMBER_EMAIL)
    await page.goto(`/admin/members/${number}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Exporta dades' }).click()

    const dialog = page.getByRole('dialog', { name: 'Exporta dades del soci' })
    await expect(dialog).toBeVisible()
    const [response, download] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/api/admin/members/${number}/data`) && r.request().method() === 'POST'),
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Descarrega JSON' }).click(),
    ])

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('application/json; charset=utf-8')
    expect(response.headers()['content-disposition']).toBe(`attachment; filename="darkstone-data-${number}.json"`)
    expect(response.request().postDataJSON()).toEqual({})
    expect(download.suggestedFilename()).toBe(`darkstone-data-${number}.json`)
    await expect(dialog.getByRole('status')).toHaveText('JSON descarregat.')
  })
})
