import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'
import { PAGES, TEXT } from '../helpers/constants'
import { expectHydrated } from '../helpers/hydration'

/** The association documents (conduct, data protection) open in a dialog over the current page. */

function documentDialog(page: Page, name: string) {
  return page.getByRole('dialog', { name })
}

test.describe('Association documents', () => {
  for (const path of ['/conduct', '/data-protection', '/pautes-de-conducta', '/es/conduct', '/en/data-protection']) {
    test(`the old page ${path} answers 404`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
    })
  }

  test('the footer opens the code of conduct over the current page and Escape closes it', async ({ page }) => {
    await page.goto(PAGES.about)
    const link = page.locator('footer').getByRole('link', { name: TEXT.doc_conduct })
    await expectHydrated(link)
    await link.click()

    const dialog = documentDialog(page, TEXT.doc_conduct)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Espai Segur' })).toBeVisible()
    await expect(page).toHaveURL(/\/about\?doc=conduct$/)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(link).toBeFocused()
  })

  test('the footer opens the data protection policy', async ({ page }) => {
    await page.goto(PAGES.faq)
    const link = page.locator('footer').getByRole('link', { name: TEXT.footer_data_protection })
    await expectHydrated(link)
    await link.click()
    await expect(documentDialog(page, TEXT.doc_data_protection)).toBeVisible()
  })

  test('?doc= opens the document on that page and closing it drops the param', async ({ page }) => {
    await page.goto(`${PAGES.ludoteca}?doc=data-protection`)
    const dialog = documentDialog(page, TEXT.doc_data_protection)
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: TEXT.doc_close }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/ludoteca$/)
  })

  test('the document text scrolls inside the dialog', async ({ page }) => {
    await page.goto(`${PAGES.home}?doc=data-protection`)
    const region = documentDialog(page, TEXT.doc_data_protection).getByRole('region')
    await expect(region).toBeVisible()
    const { scrollHeight, clientHeight } = await region.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    expect(scrollHeight).toBeGreaterThan(clientHeight)
    await region.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    expect(await region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  })

  test('the About page lists both documents at the end', async ({ page }) => {
    await page.goto(PAGES.about)
    const docs = page.getByRole('region', { name: /En fer-te soci acceptes/ })
    const link = docs.getByRole('link', { name: TEXT.doc_data_protection })
    await expectHydrated(link)
    await expect(docs.getByRole('link', { name: TEXT.doc_conduct })).toBeVisible()
    await link.click()
    await expect(documentDialog(page, TEXT.doc_data_protection)).toBeVisible()
  })

  test('sign-up opens the code of conduct without losing what was typed', async ({ page }) => {
    await page.goto(PAGES.register)
    const email = page.locator('#email')
    await expectHydrated(email)
    await email.fill('reader@example.com')

    const link = page.locator('form a[href="?doc=conduct"]')
    await expectHydrated(link)
    await link.click()
    const dialog = documentDialog(page, TEXT.doc_conduct)
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: TEXT.doc_close }).click()

    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/register$/)
    await expect(email).toHaveValue('reader@example.com')
    // Opening the document does not tick the consent box it sits in.
    await expect(page.locator('input[name="conduct"]')).not.toBeChecked()
  })

  test('Back closes the document on sign-up instead of leaving the form', async ({ page }) => {
    await page.goto(PAGES.register)
    const email = page.locator('#email')
    await expectHydrated(email)
    await email.fill('reader@example.com')
    const link = page.locator('form a[href="?doc=data-protection"]')
    await expectHydrated(link)
    await link.click()
    const dialog = documentDialog(page, TEXT.doc_data_protection)
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(/\/register\?doc=data-protection$/)

    await page.goBack()

    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/register$/)
    await expect(email).toHaveValue('reader@example.com')
  })

  test('the profile has a card with both documents', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileDetails)
    const card = page.getByRole('region', { name: "Documents de l'associació" })
    const link = card.getByRole('link', { name: new RegExp(TEXT.doc_conduct) })
    await expectHydrated(link)
    await expect(card.getByRole('link', { name: new RegExp(TEXT.doc_data_protection) })).toBeVisible()
    await link.click()
    await expect(documentDialog(page, TEXT.doc_conduct)).toBeVisible()
  })
})
