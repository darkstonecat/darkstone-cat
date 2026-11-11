import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'
import { PAGES } from '../helpers/constants'
import { expectHydrated } from '../helpers/hydration'

// /events reads the Ludoya fixtures (LUDOYA_MOCK=1) with its "now" pinned to
// 2026-10-01 (LUDOYA_MOCK_NOW in playwright.config.ts): this week holds Friday 2
// and Saturday 3 October, the next week Friday 9 and the special "Juguem a El
// Cartón Peleón!" (Sunday 11, away from the usual venue), and "Egara Juga 2026"
// (28-29 November) is the special further ahead. Drafts (10 October, 8 November)
// are never shown. Read-only: no user needed.

const card = (page: Page, title: string, nth = 0) =>
  page.locator('article').filter({ has: page.getByRole('heading', { level: 3, name: title }) }).nth(nth)
// The card's own toggle controls its panel (`event-<id>-panel`); program sections have their own toggles.
const toggle = (page: Page, title: string, nth = 0) => card(page, title, nth).locator('button[aria-controls$="-panel"]')

/** scrollY once a smooth scroll has stopped moving. */
async function settledScrollY(page: Page) {
  let last = -1
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => Math.round(window.scrollY))
      const settled = now === last
      last = now
      return settled
    }, { intervals: [250] })
    .toBe(true)
  return last
}

async function openEvents(page: Page) {
  await page.goto(PAGES.events)
  await expectHydrated(toggle(page, 'Divendres de jocs!'))
}

/**
 * The timeline line: every rail segment touches the next one, and the line starts
 * behind the first date tile and ends behind the last one (a two-day tile is taller).
 */
async function expectContinuousRail(page: Page) {
  const { rails, tiles } = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect()
    const rails = [...document.querySelectorAll('[data-timeline-rail]')].map(box).sort((a, b) => a.top - b.top)
    const tiles = [...document.querySelectorAll('[data-timeline-tile]')].map(box).sort((a, b) => a.top - b.top)
    return {
      rails: rails.map((r) => ({ top: r.top, bottom: r.bottom, x: r.left + r.width / 2 })),
      tiles: tiles.map((t) => ({ top: t.top, bottom: t.bottom, centerX: t.left + t.width / 2 })),
    }
  })
  expect(tiles.length).toBeGreaterThan(1)
  expect(rails.length).toBeGreaterThan(1)
  const [first, last] = [tiles[0], tiles.at(-1)!]
  expect(rails[0].top).toBeGreaterThan(first.top)
  expect(rails[0].top).toBeLessThan(first.bottom)
  expect(rails.at(-1)!.bottom).toBeGreaterThan(last.top)
  expect(rails.at(-1)!.bottom).toBeLessThan(last.bottom)
  for (let i = 1; i < rails.length; i++) {
    expect(Math.abs(rails[i].top - rails[i - 1].bottom), `gap above rail segment ${i}`).toBeLessThanOrEqual(1)
  }
  for (const rail of rails) expect(Math.abs(rail.x - tiles[0].centerX)).toBeLessThanOrEqual(1)
}

test.describe('Events page (/events)', () => {
  test('shows the header, the hours and venue, and one banner per special with its countdown', async ({ page }) => {
    await openEvents(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Esdeveniments' })).toBeVisible()
    await expect(page.getByText('Gratuït · no cal ser soci')).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: /Ca N.Aurell/ }).first()).toHaveAttribute('target', '_blank')

    const banners = page.getByRole('list', { name: 'Esdeveniments especials' }).getByRole('link')
    await expect(banners).toHaveCount(2)
    await expect(banners.nth(0)).toContainText('Juguem a El Cartón Peleón!')
    await expect(banners.nth(0).getByLabel('Falten 10 dies')).toBeVisible()
    await expect(banners.nth(1)).toContainText('Egara Juga 2026')
    // No section link bar.
    await expect(page.getByRole('link', { name: 'Properes setmanes' })).toHaveCount(0)
  })

  test('opens this week and the specials, and closes later sessions', async ({ page }) => {
    await openEvents(page)
    await expect(page.getByRole('heading', { level: 2, name: 'Aquesta setmana' })).toBeVisible()
    await expect(toggle(page, 'Divendres de jocs!', 0)).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle(page, 'Dissabtes de jocs!')).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle(page, 'Divendres de jocs!', 1)).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle(page, 'Juguem a El Cartón Peleón!')).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle(page, 'Egara Juga 2026')).toHaveAttribute('aria-expanded', 'true')

    // Plays with the seat pill on the cover.
    const friday = card(page, 'Divendres de jocs!', 0)
    await expect(friday.getByRole('img', { name: '3 de 4 places ocupades' })).toBeVisible()
    await expect(friday.getByRole('link', { name: /Proposa una partida/ })).toBeVisible()
  })

  test('hides the usual venue and shows the countdown on specials only', async ({ page }) => {
    await openEvents(page)
    const friday = card(page, 'Divendres de jocs!', 0)
    await expect(friday).not.toContainText('fora del local habitual')
    await expect(friday).not.toContainText(/Falten|Demà/)

    const carton = card(page, 'Juguem a El Cartón Peleón!')
    await expect(carton).toContainText('fora del local habitual')
    await expect(carton.getByRole('link', { name: /Com arribar-hi/ })).toHaveAttribute('href', /google\.com\/maps/)
    await expect(carton).toContainText('Falten 10 dies')
  })

  test('a card toggles, and "Desplega-ho tot" opens a whole later week', async ({ page }) => {
    await openEvents(page)
    const later = toggle(page, 'Divendres de jocs!', 1)
    await later.click()
    await expect(later).toHaveAttribute('aria-expanded', 'true')
    await later.click()
    await expect(later).toHaveAttribute('aria-expanded', 'false')

    await page.getByRole('button', { name: 'Desplega-ho tot' }).first().click()
    await expect(later).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'Plega-ho tot' }).first()).toBeVisible()
  })

  test('a banner opens and scrolls to its special', async ({ page }) => {
    await openEvents(page)
    await page.getByRole('list', { name: 'Esdeveniments especials' }).getByRole('link').nth(1).click()
    await expect(page).toHaveURL(/#event-/)
    await expect(card(page, 'Egara Juga 2026')).toBeInViewport()
  })

  test('the calendar opens a later card, browses months and sends other days to Ludoya', async ({ page }) => {
    await openEvents(page)
    const calendar = page.getByRole('region', { name: /Calendari: / }).first()
    await expect(calendar.getByRole('heading', { name: /Octubre 2026/ })).toBeVisible()
    await expect(calendar.getByRole('button', { name: 'No hi ha mesos anteriors' })).toHaveAttribute('aria-disabled', 'true')

    await calendar.getByRole('link', { name: /^Divendres 9 d.octubre/ }).click()
    await expect(page).toHaveURL(/#event-/)
    await expect(toggle(page, 'Divendres de jocs!', 1)).toHaveAttribute('aria-expanded', 'true')
    await expect(card(page, 'Divendres de jocs!', 1)).toBeInViewport()

    const scrollY = await settledScrollY(page)
    await calendar.getByRole('button', { name: 'Mes següent: Novembre 2026' }).click()
    await expect(calendar.getByRole('heading', { name: /Novembre 2026/ })).toBeVisible()
    expect(await settledScrollY(page)).toBe(scrollY)
    // Egara is in the timeline; the draft on Sunday 8 November is never shown.
    await expect(calendar.getByRole('link', { name: /^Dissabte 28 de novembre/ })).toHaveAttribute('href', /^#event-/)
    await expect(calendar.getByRole('link', { name: /^Diumenge 8 de novembre/ })).toHaveCount(0)
    // Friday 25 December is beyond the four weeks: it opens Ludoya.
    await calendar.getByRole('button', { name: 'Mes següent: Desembre 2026' }).click()
    await expect(calendar.getByRole('link', { name: /^Divendres 25 de desembre/ })).toHaveAttribute('target', '_blank')
  })

  test('sends no organizer name and no group-only event to the browser', async ({ page }) => {
    const response = await page.goto(PAGES.events)
    const html = (await response!.text()) ?? ''
    expect(html).not.toContain('ONLY_GROUP')
    expect(html).not.toContain('"visibility"')
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    const events = scripts
      .flatMap((text) => [JSON.parse(text)].flat() as { '@type': string; name: string }[])
      .filter((item) => item['@type'] === 'Event')
    expect(events.map((e) => e.name)).toContain('Egara Juga 2026')
  })

  test('draws one continuous timeline line from the first day to the last, open or closed', async ({ page }) => {
    await openEvents(page)
    await expectContinuousRail(page)
    await toggle(page, 'Divendres de jocs!', 0).click()
    await expect(toggle(page, 'Divendres de jocs!', 0)).toHaveAttribute('aria-expanded', 'false')
    await expectContinuousRail(page)
  })

  test('a two-day special shows both days on its date tile', async ({ page }) => {
    await openEvents(page)
    const tile = page.locator('[id^="event-"]').filter({ has: card(page, 'Egara Juga 2026') }).locator('[data-timeline-tile]')
    await expect(tile).toHaveText(/DS\s*28\s*DG\s*29/)
  })

  test('a special shows its whole program: one section per day, tournaments, the always-open block', async ({ page }) => {
    await openEvents(page)
    const egara = card(page, 'Egara Juga 2026')
    const section = (name: RegExp) => egara.getByRole('button', { name })

    // Count chips of the whole tree (drafts left out).
    await expect(egara.locator('[data-program-counts] li')).toHaveText(['8 partides', '3 tornejos', '3 activitats', '13 demos'])

    // Every day is visible and open; Saturday (9 items) puts the whole event,
    // Sunday included, in start-time rows.
    const saturday = section(/Dissabte 28 de novembre/)
    await expect(saturday).toHaveAttribute('aria-expanded', 'true')
    await expect(section(/Diumenge 29 de novembre/)).toHaveAttribute('aria-expanded', 'true')
    await expect(egara.locator('[data-program-slot] time')).toHaveText(['10:00', '16:00', '18:00', '10:00'])

    // A play inside a meetup zone, and a tournament with its format.
    await expect(egara.getByText('Aquí nunca hubo campanas · Partides de ROL')).toBeVisible()
    await expect(egara.locator('[data-item-badge="tournament"]').first()).toHaveText(/Torneig · Eliminatòria per taules/)
    await expect(egara.getByRole('link', { name: /^Entrada/ }).first()).toBeVisible()

    // Always-open demos grouped by zone, A Risk Cat under "Altres activitats".
    const open = section(/Tot l’esdeveniment/)
    await expect(open).toHaveAttribute('aria-expanded', 'true')
    await expect(egara.getByText('Sempre obert · sense hora')).toBeVisible()
    const others = egara.locator('[data-always-open-group]').last()
    await expect(others).toContainText('Altres activitats')
    // Always-open items use the same full card as the timed ones: cover plus "Més info" button.
    await expect(others.getByRole('link', { name: /^Més info.*A Risk Cat/ })).toBeVisible()
    await expect(others.locator('[data-item-cover]')).toHaveCount(1)

    // Drafts never reach the page.
    await expect(egara).not.toContainText(/Clocktower|BOTC|Brass|Plakks|Paraulògic/)

    // A day and the always-open block fold.
    await saturday.click()
    await expect(saturday).toHaveAttribute('aria-expanded', 'false')
    await expect(egara.getByText('Aquí nunca hubo campanas · Partides de ROL')).toBeHidden()
    await open.click()
    await expect(egara.getByText('Sempre obert · sense hora')).toBeHidden()
  })

  test('the calendar route answers public months only', async ({ request }) => {
    const ok = await request.get('/api/events/calendar?month=2026-11&locale=es')
    expect(ok.status()).toBe(200)
    expect(ok.headers()['cache-control']).toContain('public')
    expect((await ok.json()).title).toBe('Noviembre 2026')
    expect((await request.get('/api/events/calendar?month=2026-09')).status()).toBe(400)
  })
})

test.describe('Events page on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('shows the day strip instead of the sidebar calendar, and the month on demand', async ({ page }) => {
    await openEvents(page)
    const strip = page.getByRole('region', { name: 'Properes dates' })
    await expect(strip).toBeVisible()
    await expect(strip.getByText('Aquesta setmana')).toBeVisible()
    // The sidebar calendar is hidden; the strip's month grid starts closed.
    await expect(page.getByRole('heading', { name: /Calendari: Octubre 2026/ })).toBeHidden()

    const month = strip.locator('button[aria-controls]')
    await expect(month).toHaveText(/Veure el mes/)
    await expectHydrated(month)
    await month.click()
    await expect(month).toHaveAttribute('aria-expanded', 'true')
    await expect(month).toHaveText(/Amaga el mes/)
    await expect(strip.getByRole('heading', { name: /Octubre 2026/ })).toBeVisible()
    await month.click()
    await expect(month).toHaveAttribute('aria-expanded', 'false')

    // The strip link name starts with its visible text (label in name), then the full date.
    await strip.getByRole('list', { name: 'Properes dates' }).getByRole('link', { name: /^DV 9 Divendres 9 d.octubre/ }).click()
    await expect(toggle(page, 'Divendres de jocs!', 1)).toHaveAttribute('aria-expanded', 'true')
    await expect(card(page, 'Divendres de jocs!', 1)).toBeInViewport()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
  test('draws one continuous timeline line', async ({ page }) => {
    await openEvents(page)
    await expectContinuousRail(page)
  })
})
