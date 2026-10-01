import { test, expect } from '@playwright/test'
import { PAGES, TEXT, MEMBER_EMAIL, MEMBER_PASSWORD } from '../helpers/constants'

/** Reads the refresh token from the Supabase auth cookie(s) of the page's context. */
async function refreshTokenFromCookies(context: import('@playwright/test').BrowserContext) {
  const cookies = await context.cookies()
  const parts = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  const raw = decodeURIComponent(parts.map((c) => c.value).join(''))
  const json = raw.startsWith('base64-')
    ? Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8')
    : raw
  return (JSON.parse(json) as { refresh_token: string }).refresh_token
}

test.describe('Logout', () => {
  test('revokes the session server-side, clears the cookies and leaves the member signed out', async ({ page, context }) => {
    test.slow()

    // A dedicated login: signing out only kills this session, never the shared storage state.
    await page.goto(PAGES.login)
    await page.locator('#email').fill(MEMBER_EMAIL)
    await page.locator('#password').fill(MEMBER_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/profile', { timeout: 30_000 })

    const refreshToken = await refreshTokenFromCookies(context)

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /E2E/ }).click()
    await page.getByRole('button', { name: TEXT.nav_logout }).first().click()
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 })

    // The auth cookies are gone and a protected page sends the visitor to the login
    expect((await context.cookies()).filter((c) => c.name.includes('auth-token'))).toHaveLength(0)
    await page.goto(PAGES.profile)
    await expect(page).toHaveURL(/\/login/)

    // The old refresh token is dead on the server
    const res = await page.request.post(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY! },
        data: { refresh_token: refreshToken },
      }
    )
    expect(res.status()).toBe(400)
  })
})
