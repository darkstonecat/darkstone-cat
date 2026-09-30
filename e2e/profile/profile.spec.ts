import { test, expect } from '../fixtures'
import { PAGES, TEXT, MEMBER_EMAIL, MEMBER_FIRST_NAME, MEMBER_LAST_NAME } from '../helpers/constants'

test.describe('Profile page', () => {
  test('loads profile for authenticated member', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await expect(page.getByText(TEXT.profile_section_personal)).toBeVisible()
  })

  test('displays member name', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    // Name appears in the personal data section
    const section = page.locator('section').filter({ hasText: TEXT.profile_section_personal })
    await expect(section.getByText(MEMBER_FIRST_NAME, { exact: true })).toBeVisible()
    await expect(section.getByText(MEMBER_LAST_NAME, { exact: true })).toBeVisible()
  })

  test('displays member email', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await expect(page.getByText(MEMBER_EMAIL)).toBeVisible()
  })

  test('has edit profile button', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const editLink = page.locator('a[href*="/profile/edit"]')
    await expect(editLink).toBeVisible()
  })

  test('has member card button', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const cardLink = page.locator('a[href*="/profile/card"]')
    await expect(cardLink).toBeVisible()
  })

  test('edit button navigates to edit page', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await page.locator('a[href*="/profile/edit"]').click()
    await expect(page).toHaveURL(/\/profile\/edit/)
  })

  test('shows all profile sections', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await expect(page.getByText(TEXT.profile_section_personal)).toBeVisible()
    await expect(page.getByText(TEXT.profile_section_gaming)).toBeVisible()
    await expect(page.getByText(TEXT.profile_section_membership)).toBeVisible()
  })

  test('has data download button', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const downloadBtn = page.getByText('Descarregar les meves dades')
    await expect(downloadBtn).toBeVisible()
  })

  test('links to the profile details page', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await page.locator('a[href="/profile/details"]').first().click()
    await expect(page).toHaveURL(/\/profile\/details$/)
  })
})
