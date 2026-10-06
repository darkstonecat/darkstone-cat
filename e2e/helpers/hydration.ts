import { expect, type Locator } from '@playwright/test'

/**
 * Web-first replacement for `waitForLoadState('networkidle')` (flaky on a cold dev server, where
 * background requests keep the network busy). React attaches its props to a host element only when
 * it hydrates it, so an element carrying a `__reactProps$…` key has its handlers wired: wait for
 * that on the control the test is about to use.
 */
export async function expectHydrated(locator: Locator) {
  await expect(locator).toBeAttached()
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__reactProps'))))
    .toBe(true)
}
