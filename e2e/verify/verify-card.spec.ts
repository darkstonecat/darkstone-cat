import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { MEMBER_EMAIL, MEMBER_LAST_NAME } from '../helpers/constants'

/** Token and number of the E2E member, read with the service role (the page itself never exposes more). */
async function getMemberCard() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  const user = list.users.find((u) => u.email === MEMBER_EMAIL)!
  const { data } = await admin.from('members').select('card_token, member_number').eq('id', user.id).single()
  return { token: data!.card_token as string, memberNumber: data!.member_number as string }
}

test.describe('Public card verification', () => {
  test('a valid token shows "Carnet vàlid" and the member number only, without signing in', async ({ page }) => {
    const { token, memberNumber } = await getMemberCard()
    const response = await page.goto(`/verify/${token}`)

    await expect(page.getByRole('heading', { level: 1, name: 'Carnet vàlid' })).toBeVisible()
    await expect(page.getByText(/Núm\. de soci/)).toContainText(memberNumber)
    // Nothing else about the member is exposed
    await expect(page.locator('main')).not.toContainText(MEMBER_LAST_NAME)
    await expect(page.locator('main')).not.toContainText(MEMBER_EMAIL)

    expect(response!.headers()['referrer-policy']).toBe('no-referrer')
    expect(response!.headers()['x-robots-tag']).toContain('noindex')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test('an unknown token shows "Carnet no vàlid"', async ({ page }) => {
    await page.goto(`/verify/${'0'.repeat(32)}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Carnet no vàlid' })).toBeVisible()
    await expect(page.getByText(/Núm\. de soci/)).toHaveCount(0)
  })

  test('a malformed token or a member number shows "Carnet no vàlid"', async ({ page }) => {
    for (const bad of ['abc', '000-001', 'X'.repeat(32)]) {
      await page.goto(`/verify/${bad}`)
      await expect(page.getByRole('heading', { level: 1, name: 'Carnet no vàlid' })).toBeVisible()
    }
  })

  test('is translated (es, en)', async ({ page }) => {
    const { token } = await getMemberCard()
    await page.goto(`/es/verify/${token}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Carnet válido' })).toBeVisible()
    await page.goto(`/en/verify/${'0'.repeat(32)}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Invalid card' })).toBeVisible()
  })

  test('is not listed in the sitemap', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(await res.text()).not.toContain('/verify')
  })
})
