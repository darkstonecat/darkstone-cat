import { test, expect } from '../fixtures'
import { createTestUser, deleteTestUser, getMemberNumber } from '../helpers/supabase-admin'

// V-5 is superadmin only. There is no superadmin fixture: creating one needs two superadmins
// (BR-10) and a forced demotion on teardown, which the helpers cannot do safely. The page content
// is covered by component tests and the guard by the page test; here only the denial paths.
test.describe('Admin roles page (V-5)', () => {
  test('a board member gets the 404 page and no Rols tab', async ({ adminPage: page }) => {
    expect((await page.goto('/admin/roles'))?.status()).toBe(404)
    await page.goto('/admin/procedures')
    const tabs = page.getByRole('navigation', { name: 'Administració' })
    await expect(tabs.getByRole('link', { name: 'Rols' })).toHaveCount(0)
  })

  test('a plain member gets the 404 page', async ({ memberPage: page }) => {
    expect((await page.goto('/admin/roles'))?.status()).toBe(404)
  })
})

test.describe('Role card on the member file (V-3)', () => {
  const EMAIL = 'e2e-throwaway-rolecard@test.local'
  let number: string

  test.beforeAll(async () => {
    await deleteTestUser(EMAIL)
    await createTestUser({ email: EMAIL, password: 'Throwaway1234!', firstName: 'Rosa', lastName: 'Rol' })
    number = await getMemberNumber(EMAIL)
  })

  test.afterAll(async () => {
    await deleteTestUser(EMAIL)
  })

  test('is read-only for the board', async ({ adminPage: page }) => {
    await page.goto(`/admin/members/${number}`)
    const role = page.getByRole('region', { name: 'Rol' })
    await expect(role.getByText('Només els superadmins poden canviar rols.')).toBeVisible()
    await expect(role.getByRole('button')).toHaveCount(0)
  })
})
