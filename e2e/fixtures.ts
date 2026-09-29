import { test as base } from '@playwright/test'
import { MEMBER_STATE_PATH, ADMIN_STATE_PATH, EDITOR_STATE_PATH } from './helpers/constants'

/**
 * Custom fixtures with pre-authenticated browser contexts.
 */
export const test = base.extend<{
  memberPage: import('@playwright/test').Page
  adminPage: import('@playwright/test').Page
  /** Member reserved for tests that write profile data. */
  editorPage: import('@playwright/test').Page
}>({
  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: MEMBER_STATE_PATH })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE_PATH })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  editorPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: EDITOR_STATE_PATH })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
