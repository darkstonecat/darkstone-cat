import { test, expect } from '../fixtures'
import { PAGES, MEMBER_FIRST_NAME, MEMBER_LAST_NAME } from '../helpers/constants'

const MEMBER_NAME = `${MEMBER_FIRST_NAME} ${MEMBER_LAST_NAME}`

test.describe('Member card page (desktop)', () => {
  test('shows the hero, the card with a real QR and the tabs', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileCard)

    await expect(page.getByRole('heading', { level: 1, name: 'El meu carnet' })).toBeVisible()
    const tabs = page.getByRole('navigation', { name: 'Zona de socis' })
    await expect(tabs.getByRole('link', { name: 'Carnet' })).toHaveAttribute('aria-current', 'page')

    await expect(page.getByText(MEMBER_NAME, { exact: true }).and(page.locator(':visible'))).toBeVisible()
    const qr = page.getByRole('img', { name: /^Codi QR del soci 000-\d+$/ }).and(page.locator(':visible'))
    await expect(qr).toBeVisible()
    // A real QR is hundreds of module rectangles, not a placeholder
    const pathData = await qr.locator('path').getAttribute('d')
    expect(pathData!.length).toBeGreaterThan(1000)
  })

  test('shows the three explanatory cards', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileCard)
    for (const title of ['A les activitats', 'El codi QR', 'Sempre a mà']) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
    }
  })

  test('downloads the card image', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileCard)
    const button = page.getByRole('button', { name: 'Descarrega la imatge' }).and(page.locator(':visible'))
    await expect(button).toBeVisible()
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
    expect(download.suggestedFilename()).toBe(`carnet_${MEMBER_FIRST_NAME}_${MEMBER_LAST_NAME}.png`)
  })

  test('the image endpoint serves a PNG preview for the signed-in member', async ({ memberPage: page }) => {
    const res = await page.request.get('/api/members/card?preview=1')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')
    expect(res.headers()['content-disposition']).toBeUndefined()
  })

  test('the image endpoint rejects anonymous requests', async ({ request }) => {
    const res = await request.get('/api/members/card')
    expect(res.status()).toBe(401)
  })
})

test.describe('Member card page (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the NavBar, shows the portrait card and pins the download button', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileCard)
    await expect(page.getByRole('heading', { level: 1, name: 'El meu carnet' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Torna a la meva zona' })).toHaveAttribute('href', '/profile')
    await expect(page.getByRole('button', { name: 'Descarrega la imatge' })).toBeVisible()
    await expect(page.getByText(/Ensenya'l a les activitats/).first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'A les activitats' })).toBeHidden()
  })

  test('QR overlay: opens, traps focus, closes with Escape and returns focus', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileCard)
    const trigger = page.getByRole('button', { name: 'Amplia el codi QR' })
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: 'Codi QR del carnet' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    const close = dialog.getByRole('button', { name: 'Tanca' })
    await expect(close).toBeFocused()
    const box = await close.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')

    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  })

  test('QR overlay closes with the close button', async ({ memberPage: page }) => {
    await page.goto(PAGES.profileCard)
    await page.getByRole('button', { name: 'Amplia el codi QR' }).click()
    const dialog = page.getByRole('dialog', { name: 'Codi QR del carnet' })
    await dialog.getByRole('button', { name: 'Tanca' }).click()
    await expect(dialog).toBeHidden()
  })
})
