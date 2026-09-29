# Contact page content

## Objective

Give `/contact` (and `/es/contact`, `/en/contact`) enough useful, locale-specific
content that Google stops clustering `/en/contact` with `/contact`
("Duplicate without user-selected canonical"), while the form stays the
main element of the page.

## Problem / why

- The page is almost only the form (~1,500 chars incl. JSON-LD).
- Session hours and venue name disagree across the site:
  - Truth: **Casal Cívic Ca N'Aurell** (official name on the Ajuntament de Terrassa website and the building sign; Google Maps says "Centre", which caused the confusion; corrected by the user),
    Friday 16:00–20:30, Saturday 10:00–13:30.
  - Wrong: `faq.schedule_a` (17:00–21:00 / 10:00–14:00), Organization JSON-LD
    `openingHoursSpecification` in `src/app/[locale]/layout.tsx` (same wrong hours),
    "Centre Cívic" in several message strings.

## Scope

- Single source of truth for venue name, address and session hours, used by JSON-LD and UI.
- Fix wrong hours and use "Casal Cívic" everywhere in all 3 locales.
- `/contact`: short intro, form stays first; below it a "come and play" block
  (hours, address, how to get there, Maps link, no iframe) and a 3–4 item
  contact FAQ with internal links (`/register`, `/faq`, `/events`).
- `ContactPage` JSON-LD referencing the Organization `@id`.

## Constraints

- Branch `fix/contact-page-content` from `main`; delivery to `main` is the user's call.
- No invented facts (no response-time promise, no new prices). Only facts already on the site.
- Texts written naturally per locale (ca primary), not literal translations.
- No FAQPage schema on `/contact`. No Google Maps iframe on `/contact`.
- TDD: not configured (no project/session setting) → ordinary functional checks.
  `main` has no test suite (Vitest/Playwright live on `develop-users`).

## Tasks

- [x] T1 — Venue single source + fix hours/name inconsistencies (JSON-LD, FAQ, venue name; first unified to "Centre", then corrected to the official "Casal"). Route: delegated (writer trigger: 2+ non-trivial files).
- [-] T2 — Contact page content + ContactPage JSON-LD, 3 locales. **Dropped**: the user reviewed it and rejected it ("too much useless content"); the contact page stays as it was. Commits removed from the branch before push.

## Acceptance criteria

- One place defines the hours; layout JSON-LD, events JSON-LD and visible UI all show Fri 16:00–20:30, Sat 10:00–13:30.
- No "Centre Cívic" left in `src/` (the Ludoya mock fixtures keep Ludoya's own name).
- `/contact` in ca/es/en: form above the fold as today; new sections render server-side; internal links present.
- `lint` on changed files, `next build`, HTML check of the 3 contact URLs.

## Checks

- `npx eslint <changed files>`, `npm run build`, `curl` of `/contact`, `/es/contact`, `/en/contact` on `next start`.

## Progress

- Branch created from `main` @ 7f6e533.
- T1 route: delegated (writer). Checks: eslint on changed files, tsc --noEmit, `rm -rf .next && npm run build` OK. Commit: T1_HASH

## Next step

- Delegate T1 + T2 to one writer.
