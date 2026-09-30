import { test, expect } from '../fixtures'
import { PAGES, MEMBER_FIRST_NAME } from '../helpers/constants'

// "La meva zona": the member home. Read-only, so it uses the shared member.
test.describe('Member home (/profile)', () => {
  test('greets the member and shows the member line', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await expect(page.getByRole('heading', { level: 1, name: `Hola, ${MEMBER_FIRST_NAME}` })).toBeVisible()
    await expect(page.getByText(/Núm\. de soci/).first()).toBeVisible()
    await expect(page.getByText(/Membre des del/).first()).toBeVisible()
  })

  test('shows the Inici tab as current and links the other tabs', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const tabs = page.getByRole('navigation', { name: 'Zona de socis' })
    await expect(tabs.getByRole('link', { name: 'Inici' })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/profile/details')
    await expect(tabs.getByRole('link', { name: 'Carnet' })).toHaveAttribute('href', '/profile/card')
  })

  test('the mini card opens the member card', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await page.getByRole('link', { name: /Obre el carnet/ }).click()
    await expect(page).toHaveURL(/\/profile\/card$/)
  })

  test('shows the profile checklist with links to where to fix each step', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Completa el perfil' }) })
    await expect(card).toBeVisible()
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4')
    // The test member has no Ludoya/BGG username, so those steps are links.
    await expect(card.getByRole('link', { name: 'Vincula Ludoya' })).toHaveAttribute('href', /\/profile\/details/)
    await expect(card.getByRole('link', { name: 'Vincula BoardGameGeek' })).toHaveAttribute('href', /\/profile\/details/)
  })

  test('shows the badges: the derived member badge is earned, the others are locked', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const badges = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Les teves insígnies' }) })
    await expect(badges).toBeVisible()
    const year = new Date().getFullYear()
    await expect(badges.getByText(`Membre ${year}`).first()).toBeAttached()
    await expect(badges.getByText('Voluntariat Egara Joga').first()).toBeAttached()
    await expect(badges.getByText('Donant de la ludoteca').first()).toBeAttached()
  })

  test('has no leftovers of the old data sheet', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await expect(page.getByText('Dades personals')).toHaveCount(0)
    await expect(page.getByText('Descarregar les meves dades')).toHaveCount(0)
  })

  test('tabs navigate to the profile details page', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    await page.getByRole('navigation', { name: 'Zona de socis' }).getByRole('link', { name: 'Perfil' }).click()
    await expect(page).toHaveURL(/\/profile\/details$/)
  })
})

// The E2E server runs with LUDOYA_MOCK=1 (public/mock/ludoya/v1 fixtures). Their
// dates are fixed, so the week window shows sessions only around the fixture
// dates and the empty state afterwards: the tests accept both and check the rest.
test.describe('Member home sessions', () => {
  test('renders the sessions card in the page shell', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Properes sessions' }) })
    await expect(card).toBeVisible()
    await expect(card.getByText('Aquesta setmana')).toBeVisible()
    await expect(card.getByRole('link', { name: /Tots els esdeveniments/ })).toHaveAttribute('href', '/events')
    // Once streamed in, the skeleton is gone.
    await expect(card.getByRole('status').filter({ hasText: 'Carregant' })).toHaveCount(0)
  })

  test('lists sessions with an accessible accordion, or the empty state', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Properes sessions' }) })
    const toggles = card.getByRole('button', { name: /Veure partides/ })
    await expect(toggles.first().or(card.getByText('Encara no hi ha partides programades'))).toBeVisible()
    if ((await toggles.count()) === 0) return

    const toggle = toggles.first()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(card.getByRole('button', { name: /Amaga/ }).first()).toHaveAttribute('aria-expanded', 'true')
    const panelId = await card.getByRole('button', { name: /Amaga/ }).first().getAttribute('aria-controls')
    const panel = page.locator(`[id="${panelId}"]`)
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Proposa una partida')).toBeVisible()
    for (const link of await panel.getByRole('link').all()) {
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      await expect(link).toHaveAttribute('target', '_blank')
    }
  })
})

test.describe('Member home on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('shows the badges carousel with working controls and no horizontal scroll', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const region = page.getByRole('region', { name: 'Insígnies', exact: true })
    await expect(region).toBeVisible()
    await expect(region.getByRole('group')).toHaveCount(3)
    const prev = region.getByRole('button', { name: 'Insígnia anterior' })
    const next = region.getByRole('button', { name: 'Insígnia següent' })
    await expect(prev).toBeDisabled()
    await next.click()
    await expect(region.getByRole('button', { name: /Insígnia 2:/ })).toHaveAttribute('aria-current', 'true')
    await expect(prev).toBeEnabled()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

// Month calendar. Fixture events sit in October and November 2026, so the tests
// open `?month=2026-10` and accept a fallback to the current month once the
// browsable range (3 months back, 6 forward) no longer reaches it.
test.describe('Member home calendar', () => {

  test('shows the current month with accessible navigation', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const nav = page.getByRole('navigation', { name: 'Navegació del calendari' })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('button', { name: /^Mes anterior: / })).toBeVisible()
    await expect(nav.getByRole('button', { name: /^Mes següent: / })).toBeVisible()
    await expect(page.getByRole('table', { name: /^Calendari de / })).toHaveCount(1)
  })

  test('navigates to another month through the URL and back', async ({ memberPage: page }) => {
    await page.goto(`${PAGES.profile}?month=2026-10`)
    const heading = page.getByRole('heading', { name: /Calendari/ })
    if (!(await heading.textContent())?.includes('Octubre 2026')) return // out of range: fell back to today's month
    const table = page.getByRole('table', { name: 'Calendari de Octubre 2026' })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader')).toHaveText(['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'])
    const pills = table.getByRole('link', { name: /Obre a Ludoya/ })
    expect(await pills.count()).toBeGreaterThan(0)
    await expect(pills.first()).toHaveAttribute('target', '_blank')
    await expect(pills.first()).toHaveAttribute('rel', 'noopener noreferrer')

    // Months load from the calendar route, not through a page navigation.
    const monthResponse = page.waitForResponse((r) => r.url().includes('/api/profile/calendar?month=2026-11'))
    await page.getByRole('button', { name: /^Mes següent: Novembre 2026/ }).click()
    expect((await monthResponse).status()).toBe(200)
    await expect(page).toHaveURL(/month=2026-11/)
    await expect(page.getByRole('table', { name: 'Calendari de Novembre 2026' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Calendari/ })).toContainText('Novembre 2026')
  })

  test('keeps the arrows focusable at the end of the range', async ({ memberPage: page }) => {
    await page.goto(PAGES.profile)
    const prev = page.getByRole('navigation', { name: 'Navegació del calendari' }).getByRole('button').first()
    // 3 months back at most: go there, then the arrow becomes aria-disabled but keeps focus.
    for (let i = 0; i < 3; i++) {
      const loaded = page.waitForResponse((r) => r.url().includes('/api/profile/calendar'))
      await prev.click()
      await loaded
      await expect(prev).toHaveAttribute('aria-label', i < 2 ? /^Mes anterior: / : /^Mes anterior no disponible$/)
    }
    await expect(prev).toHaveAttribute('aria-disabled', 'true')
    await expect(prev).toBeFocused()
  })

  test('an invalid month falls back to the current one', async ({ memberPage: page }) => {
    await page.goto(`${PAGES.profile}?month=abc`)
    await expect(page.getByRole('table', { name: /^Calendari de / })).toBeVisible()
    await page.goto(`${PAGES.profile}?month=1999-01`)
    await expect(page.getByRole('table', { name: /^Calendari de / })).toBeVisible()
  })
})

test.describe('Member home calendar on mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('day buttons are 44 px and select a day into the detail panel', async ({ memberPage: page }) => {
    await page.goto(`${PAGES.profile}?month=2026-10`)
    const heading = page.getByRole('heading', { name: /Calendari/ })
    if (!(await heading.textContent())?.includes('Octubre 2026')) return
    const days = page.getByRole('button', { name: /esdeveniment/ })
    await expect(days.first()).toBeVisible()
    const box = await days.first().boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    await days.first().click()
    await expect(days.first()).toHaveAttribute('aria-pressed', 'true')
    const panel = page.getByRole('status', { name: 'Esdeveniments del dia seleccionat' })
    await expect(panel.getByRole('link', { name: /Obre a Ludoya/ })).toHaveAttribute('target', '_blank')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
