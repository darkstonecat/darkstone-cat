import { test as setup, type Browser } from '@playwright/test'
import { createTestUser } from './helpers/supabase-admin'
import {
  MEMBER_EMAIL, MEMBER_PASSWORD, MEMBER_FIRST_NAME, MEMBER_LAST_NAME,
  ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME,
  EDITOR_EMAIL, EDITOR_PASSWORD, EDITOR_FIRST_NAME, EDITOR_LAST_NAME,
  MEMBER_STATE_PATH, ADMIN_STATE_PATH, EDITOR_STATE_PATH,
} from './helpers/constants'

async function loginAndSaveState(
  browser: Browser,
  email: string,
  password: string,
  statePath: string
) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/profile', { timeout: 30_000 })
  await ctx.storageState({ path: statePath })
  await ctx.close()
}

setup('create test users and save auth state', async ({ browser }) => {
  // Create test users in Supabase (admin API, no browser needed)
  await createTestUser({
    email: MEMBER_EMAIL,
    password: MEMBER_PASSWORD,
    firstName: MEMBER_FIRST_NAME,
    lastName: MEMBER_LAST_NAME,
    role: 'member',
  })

  await createTestUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
    role: 'admin',
  })

  await createTestUser({
    email: EDITOR_EMAIL,
    password: EDITOR_PASSWORD,
    firstName: EDITOR_FIRST_NAME,
    lastName: EDITOR_LAST_NAME,
    role: 'member',
  })

  await loginAndSaveState(browser, MEMBER_EMAIL, MEMBER_PASSWORD, MEMBER_STATE_PATH)
  await loginAndSaveState(browser, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE_PATH)
  await loginAndSaveState(browser, EDITOR_EMAIL, EDITOR_PASSWORD, EDITOR_STATE_PATH)
})
