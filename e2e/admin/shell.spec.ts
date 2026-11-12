import { test, expect } from '../fixtures'
import { PAGES } from '../helpers/constants'
import { expectHydrated } from '../helpers/hydration'

test.describe('Admin shell', () => {
  test('shows the header, the signed-in line and the grouped sidebar', async ({ adminPage: page }) => {
    await page.goto(PAGES.admin)
    await expect(page.getByRole('heading', { level: 1, name: 'Resum' })).toBeVisible()
    await expect(page.getByText('Has entrat com a')).toBeVisible()

    const sidebar = page.getByRole('navigation', { name: 'Administració' })
    await expect(sidebar.getByRole('link')).toHaveText(['Resum', 'Socis', 'Activitat', 'Insígnies', 'Beneficis', 'Eines', 'Procediments'])
    await expect(sidebar.getByRole('link', { name: 'Resum' })).toHaveAttribute('aria-current', 'page')
    await expect(sidebar.getByRole('list', { name: 'Junta' })).toBeVisible()
    await expect(sidebar.getByRole('list', { name: 'Contingut del web' })).toBeVisible()
    await expect(sidebar.getByRole('list', { name: 'Manteniment' })).toBeVisible()
    // The phone switcher is not shown on desktop.
    await expect(page.getByRole('button', { name: /Canvia/ })).toBeHidden()
  })

  test('sidebar links point at the admin views and keep the section on a nested page', async ({ adminPage: page }) => {
    await page.goto(PAGES.adminMembers)
    const tabs = page.getByRole('navigation', { name: 'Administració' })
    await expect(tabs.getByRole('link', { name: 'Socis' })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Activitat' })).toHaveAttribute('href', '/admin/activity')
    await expect(page.getByRole('heading', { level: 1, name: 'Socis' })).toBeVisible()

    await page.goto('/admin/tools/event-images')
    await expect(tabs.getByRole('link', { name: 'Eines' })).toHaveAttribute('aria-current', 'page')
  })

  test('on a phone the section switcher opens a sheet and navigates', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(PAGES.admin)
    await expect(page.getByRole('navigation', { name: 'Administració' })).toHaveCount(0)

    const switcher = page.getByRole('button', { name: /Resum.*Canvia/ })
    await expectHydrated(switcher)
    await switcher.click()
    const sheet = page.getByRole('dialog', { name: 'Administració' })
    await expect(sheet.getByRole('link')).toHaveText(['Resum', 'Socis', 'Activitat', 'Insígnies', 'Beneficis', 'Eines', 'Procediments'])
    await expect(sheet.getByRole('link', { name: 'Resum' })).toHaveAttribute('aria-current', 'page')

    await sheet.getByRole('link', { name: 'Socis' }).click()
    await expect(page).toHaveURL(/\/admin\/members$/)
    await expect(sheet).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Socis.*Canvia/ })).toBeVisible()

    await page.getByRole('button', { name: /Socis.*Canvia/ }).click()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })

  test('no horizontal overflow at 1024 px (narrowest desktop with the sidebar) on any admin page', async ({ adminPage: page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    for (const path of ['/admin', '/admin/members', '/admin/activity', '/admin/badges', '/admin/benefits', '/admin/tools', '/admin/procedures']) {
      await page.goto(path)
      await expect(page.getByRole('navigation', { name: 'Administració' })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })

  for (const path of ['/admin', '/es/admin', '/admin/procedures', '/es/admin/tools']) {
    test(`no horizontal overflow at 360 px on ${path}, sheet open`, async ({ adminPage: page }) => {
      await page.setViewportSize({ width: 360, height: 740 })
      await page.goto(path)
      const switcher = page.getByRole('button', { name: /Canvia|Cambiar/ })
      await expectHydrated(switcher)
      const overflows = () =>
        page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(await overflows()).toBe(false)
      await switcher.click()
      const links = page.getByRole('dialog').getByRole('link')
      await expect(links).toHaveCount(7)
      const clipped = await links.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth).length)
      expect(clipped).toBe(0)
    })
  }

  test('a member gets the 404 page on an admin sub-route, a board member the page', async ({
    memberPage,
    adminPage,
  }) => {
    expect((await memberPage.goto('/admin/procedures'))?.status()).toBe(404)
    expect((await adminPage.goto('/admin/procedures'))?.status()).toBe(200)
  })
})
