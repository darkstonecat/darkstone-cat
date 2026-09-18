# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Darkstone Catalunya** — Website for a board gaming & RPG non-profit association in Terrassa (Barcelona). Multi-page site with an animated landing page and a game library (ludoteca). Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4. Deployed on Vercel at **darkstone.cat**.

### Language Convention

The primary language of the association is **Catalan**. All user-facing text must be translated to 3 locales (`ca`, `es`, `en`). Code comments and commit messages can be in any language.

## Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run lighthouse       # Lighthouse audit — local (build + start + audit + cleanup)
npm run lighthouse:prod  # Lighthouse audit — production (darkstone.cat)
npm run ludoya:check     # Verify Ludoya API endpoints and response shapes (live)
```

No test runner is configured.

### Lighthouse Audits

Automated Lighthouse audits for all 11 pages (Catalan locale) on mobile + desktop (22 audits total). Scripts in `scripts/lighthouse/`:

| File | Purpose |
|---|---|
| `run-audit.mjs` | Entry point / orchestrator (`--prod` flag for production) |
| `config.mjs` | Pages, thresholds, categories, Lighthouse flags |
| `auditor.mjs` | Chrome launcher + Lighthouse runner (shares a single Chrome instance) |
| `server.mjs` | Builds project and starts local Next.js server with cleanup |
| `report.mjs` | Generates classified Markdown report (scores, CWV, issues, opportunities) |
| `utils.mjs` | Helpers (emoji scoring, port finding, timestamps, logging) |

Output goes to `audits/lighthouse/<timestamp>/` (gitignored) with `REPORT.md` and `raw/` containing JSON + HTML reports per page/device.

**Known limitations**: `AUDIT.md` documents Lighthouse issues caused by Next.js framework constraints (legacy JS polyfills, bfcache, render-blocking CSS, network chains, unused shared chunks) and expected behavior from page complexity (ludoteca LCP, heavy animation pages). These should be ignored in future audits.

## Architecture

### Routing & i18n

Next.js App Router with `next-intl` v4 for internationalization:
- Routes under `src/app/[locale]/`
- Three locales: `ca` (Catalan, default), `es`, `en`
- Default locale (`ca`) omits prefix in URL: `/about` = Catalan, `/es/about` = Spanish
- Translation files: `src/messages/{ca,es,en}.json`
- i18n routing config: `src/i18n/routing.ts`, request config: `src/i18n/request.ts`
- Middleware: `src/proxy.ts` (next-intl middleware export)
- **Always use** `Link`, `usePathname`, `useRouter` from `@/i18n/routing` — not from `next/link` or `next/navigation` directly

### Pages

| Route | Page file | Description |
|---|---|---|
| `/` | `page.tsx` | Landing: Hero → About → Activities → Schedule → JoinUs → Location → Footer |
| `/about` | `about/page.tsx` | Origin story, mission, values |
| `/ludoteca` | `ludoteca/page.tsx` | Game library with BGG integration (ISR, revalidate: 86400) |
| `/contact` | `contact/page.tsx` | Contact form (Resend email) |
| `/events` | `events/page.tsx` | Upcoming events from Ludoya API (`revalidate: 86400`) |
| `/events/images` | `events/images/page.tsx` | Internal tool: preview/download shareable event images (`noindex`, not in sitemap) |
| `/faq` | `faq/page.tsx` | FAQ with accordion UI, FAQPage schema (`revalidate = false`) |
| `/conduct` | `conduct/page.tsx` | Code of conduct (`revalidate = false`) |
| `/legal` | `legal/page.tsx` | Terms & conditions (`revalidate = false`) |
| `/privacy` | `privacy/page.tsx` | Privacy policy (`revalidate = false`) |
| `/cookies` | `cookies/page.tsx` | Cookie policy (`revalidate = false`) |

API routes:
- `src/app/api/contact/route.ts` — POST endpoint using Resend to send emails
- `src/app/api/events/[eventId]/image/route.ts` — GET 1080×1080 PNG for an event (Satori via `next/og`, `src/lib/event-image/`)
- `src/app/api/test-image/[count]/route.ts` — GET test image with 1–8 hardcoded games, for layout checks

### Provider Stack (layout.tsx)

```
html[lang] → body → JSON-LD script → NextIntlClientProvider → SmoothScroll → CookieConsentProvider → {children} + CookieBanner + GoogleAnalytics + Vercel Analytics + SpeedInsights
```

### Theme System

There is **no Zustand store or useThemeSection hook** — themes are handled directly in the NavBar:

- **Home page**: NavBar detects the active section via scroll position (`getBoundingClientRect` against viewport center) and applies theme colors from `SECTION_THEMES` map. Section IDs must match keys exactly: `""` (hero), `"about"`, `"activities"`, `"schedule"`, `"join-us"`, `"location"`.
- **Subpages**: NavBar reads `usePathname()` and applies fixed themes from `SUBPAGE_THEMES` map.
- **Pattern**: Alternating light (`#EEE8DC` bg / `#1c1917` text) and dark (`#1C1917` bg / `#FAFAF9` text) sections.
- Each section component handles its own background color independently via Tailwind classes.

### Smooth Scrolling

Lenis library provides smooth scrolling via `src/components/SmoothScroll.tsx` (React Context). Access with `useLenis()`. Respects `prefers-reduced-motion`. Duration: 1.0s with exponential easing. Touch multiplier: 2x.

### Animation Patterns

Uses `motion/react` (Motion v13). **Never import from `framer-motion`**. Some components use `* as m from "motion/react-client"`.

Common patterns:
- **Spring physics (CSS)**: The hero entrance is **not** Motion. It is a CSS `@keyframes` (`hero-logo-spring`, `hero-text-spring` in `globals.css`) with a precomputed spring curve (`stiffness 200, damping 10, mass 1.6`)
- **Spring physics (Motion)**: `type: "spring", stiffness: 300, damping: 20` for the Activities desktop cards (`whileInView` scale) and the social icons' hover (`useAnimate` in `SocialLinks`)
- **Scroll transforms**: `useScroll` + `useTransform` for parallax (Activities, About)
- **Viewport triggers**: `whileInView` with `viewport={{ once: true }}` for fade/slide
- **Sticky scroll-pin**: Tall container with `sticky` positioning and scroll-driven transforms: About cards (`370vh`, scale) and Activities desktop (`400vh`, horizontal track)
- **Reduced motion in scroll effects**: Use `usePrefersReducedMotion()` from `@/hooks/usePrefersReducedMotion`, never Motion's `useReducedMotion`, to change anything that affects the first render. It is `false` during hydration (`useSyncExternalStore` server snapshot), so the markup matches the server HTML. Motion's hook returns the real value on the first client render, which caused hydration error #418 in `TextReveal`
- **AnimatePresence**: FAQ accordion (`height: auto`), collaborator modal (`/about`), ludoteca game modal and mobile filter drawer, contact form success swap (`mode="wait"`). The cookie banner does not use Motion


### Styling

Tailwind CSS v4 with CSS-based config (no `tailwind.config.ts`). Tokens in `src/styles/globals.css`:

```
--color-brand-red: #A61A1A      --color-brand-orange: #B54F00
--color-brand-orange-text: #A04500  (WCAG-safe on light bg)
--color-brand-beige: #EEE8DC    --color-brand-blue: #05064D
--color-stone-custom: #1C1917   --color-brand-white: #FFFFFF
--color-stone-white-base: #D6D3D1   --color-stone-white-hover: #FAFAF9
```

Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional class merging. `prefers-reduced-motion: reduce` disables CSS animations/transitions (`globals.css`), Lenis smoothing, Motion animations (`MotionConfig reducedMotion="user"`), and the decorative scroll-linked transforms: hero zoom and shift, About card and title scale, the Activities meeple, and the section-divider wave. Those collapse their `useTransform` output range to the start value via `usePrefersReducedMotion()` (`src/hooks/`). Scroll-linked fades stay, and so do the Activities desktop track and the scroll progress bar, because they are functional. Focus-visible: 2px solid orange outline.

### Component Structure

All interactive components use `"use client"`. Components are organized by page:
- `src/components/home/` — Landing sections (Hero, About, Activities, Schedule, JoinUs, Location, SectionDivider)
- `src/components/about/` — About page (AboutHero, AboutOrigin, AboutMissionValues, AboutValues)
- `src/components/ludoteca/` — Game library (LudotecaClient, GameGrid, GameCard, GameListRow, GameDetailModal, FilterSidebar, SearchableMultiSelect, Dropdown, SortDropdown, Pagination)
- `src/components/contact/` — Contact form (ContactHero, ContactForm, ContactInfo)
- `src/components/events/` — Events page (EventsHero, EventsContent) and event images tool (EventImagesHero, EventImagesContent)
- `src/components/faq/` — FAQ page (FaqContent)
- `src/components/conduct/` — Code of conduct (ConductContent)
- `src/components/legal/` — Legal pages (LegalPageContent, LegalContent, PrivacyContent, CookiesContent)
- Root-level: NavBar, Footer, SmoothScroll, CookieBanner, CookieConsentProvider, GoogleAnalytics, ScrollProgress, ScrollToTop, TextReveal, LanguageSwitcher, ThemeLink, ErrorContent

### Ludoteca (Game Library)

Server-side BGG integration in `src/lib/bgg.ts`:
- Fetches from BoardGameGeek XML API v2, parses with `fast-xml-parser`
- Mock mode (local XML files in `/public/mock/`) when no API key
- Separate fetches for boardgames vs expansions, then enriches with thing endpoint (weight, categories, mechanics)
- Expansion linking: thing-based inbound links (`linkExpansionsByThing`), used by both the live and the mock path
- Batch fetching: 20 items/request, retry: 5 attempts with exponential backoff (2s base)
- ISR: `revalidate: 86400` (1 day)

Client state in `LudotecaClient.tsx`:
- Filters: search, gameType, rankTypes, players, duration, weight, age, categories, mechanics
- Sort: name/rating/weight × asc/desc
- View: grid/list, pagination (24/48/96/192 per page)
- URL serialization: query params (`q`, `type`, `rank`, `players`, `duration`, `weight`, `age`, `cat`, `mech`, `sort`, `view`, `pp`, `page`)

### Events (Ludoya)

Undocumented Ludoya API, adapter in `src/lib/ludoya/`. Full reference and recovery steps in `docs/ludoya-api-reference.md`.
- `config.ts` — hosts, group id/username, endpoint paths (env-overridable). `client.ts` — fetch with retry, typed errors, mock mode, group-id rediscovery on 404. `normalize.ts` — the **only** file that knows raw shapes; guards throw `LudoyaShapeError` with the exact field path. `index.ts` — `fetchUpcomingEvents()`.
- Components only use `LudoyaEvent` from `types.ts`. When Ludoya changes, touch `config.ts`/`normalize.ts`, not components.
- Flow: `GET /users/{groupId}/events?displayAllRecurring=true` → for events with `childEventCounts.games > 0`, `GET /events/{id}/children` (children with a `game` are planned plays)
- Event images (`/events/images`, `src/lib/game-matching.ts`): BGG is the source of truth for cover/weight/type. Ludoya only bridges to the BGG id via `GET /boardgames/{slug}` (`resolveBggIds`, cached 30 days). Order: BGG id → club collection by id → BGG thing by id → name match (collection, then BGG search) → Ludoya cover with default frame. Logs `[EventImage] Resolved N/M games: …` with the path each game took
- Mock mode: `LUDOYA_MOCK=1` reads fixtures from `/public/mock/ludoya/`
- Monitoring: `.github/workflows/ludoya-check.yml` runs `scripts/ludoya/check.mjs` weekly
- Ludoya images are served as `application/octet-stream`; image host must be in `next.config.ts` `remotePatterns` and CSP `img-src`

### Cookie Consent

`src/hooks/useCookieConsent.ts` — Uses `useSyncExternalStore` for localStorage subscription (prevents hydration mismatch). Key: `darkstone_cookie_consent`. Status: `'accepted' | 'rejected' | null`. Google Analytics only loads when accepted.

### SEO

- `src/app/sitemap.ts` — Dynamic sitemap: one entry per page **and locale** with hreflang alternates. **Only indexable pages** — never list a page that sets `robots: noindex` (Search Console flags it as a contradiction)
- `src/app/robots.ts` — robots.txt
- `src/lib/seo.ts` — `getLocalizedUrl()` / `getAlternates()` build canonical + hreflang URLs. The root is always `https://www.darkstone.cat/` (with trailing slash)
- `src/app/[locale]/[...rest]/page.tsx` — Catch-all that calls `notFound()` so unknown paths render the custom `not-found.tsx` instead of the Next.js default 404
- `next.config.ts` `redirects()` — Permanent (308) redirects: legacy `/pautes-de-conducta` → `/conduct`, and `/ca/*` → `/*` (next-intl's middleware only does a temporary 307). **When renaming a route, add a permanent redirect from the old path here.**
- `src/app/[locale]/opengraph-image.tsx` — Dynamic OG image (1200×630)
- Layout: JSON-LD Organization schema, OpenGraph + Twitter metadata
- Metadata base: `https://www.darkstone.cat`
#### Checklist: Adding a new page

When adding a new page, update **all** of the following:

1. `src/app/[locale]/<page>/page.tsx` — Page with `generateMetadata()`, JSON-LD (BreadcrumbList + WebPage + any page-specific schema), revalidate
2. `src/components/<page>/` — Page component(s)
3. `src/messages/{ca,es,en}.json` — Add keys in `metadata` namespace (`<page>_title`, `<page>_description`), `nav` namespace (breadcrumb name), `footer` namespace (if linked from footer), and page-specific namespace
4. `src/app/sitemap.ts` — Add entry to `pages` array with path, changeFrequency, priority, lastModified (**skip if the page is `noindex`**)
5. `src/components/NavBar.tsx` — Add `"/<page>"` to `SUBPAGE_THEMES` map (required for theme detection)
6. `src/components/Footer.tsx` — Optionally add link to `NAV_LINKS` (main pages) or `LEGAL_LINKS` (support/legal pages)
7. `scripts/lighthouse/config.mjs` — Add entry to `PAGES` array
8. `CLAUDE.md` — Update Pages table, Component Structure list, and Translation Key Namespaces
9. `README.md` — Update Pages table

### Security Headers & Build Config (next.config.ts)

HSTS, CSP, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy (camera/microphone/geolocation disabled). Remote image pattern: `cf.geekdo-images.com` (BGG images).

- `experimental.optimizePackageImports`: `react-icons` — when adding new icon libraries, add them here for proper tree-shaking.

### Image Optimization

- **All `<Image>` components must include `quality={60}`** — intentional for LCP performance. SVGs are excluded (Next.js doesn't optimize them).
- WebP format in `/public/images/photos/`
- Progressive loading in GameCard: low-res thumbnail → high-res fade-in
- `sizes` prop on all `<Image>` for responsive breakpoints

### Error Handling

- `src/app/[locale]/error.tsx` — Page-level error boundary
- `src/app/[locale]/not-found.tsx` — 404 page
- `src/app/global-error.tsx` — Global fallback
- Shared `ErrorContent` component with translation keys: `error_page.*`, `not_found.*`

## Supabase

The project uses [Supabase](https://supabase.com) as its backend database. Access is available via the **Supabase MCP server**, which allows:

- Listing tables and schemas
- Executing SQL queries
- Applying migrations
- Managing edge functions
- Viewing logs
- Managing branches (preview environments)

The `public` schema is the primary working schema.

## Environment Variables

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend API key for contact form email delivery |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `BGG_USERNAME` | BoardGameGeek username for ludoteca collection |
| `BGG_API_KEY` | BoardGameGeek XML API key |
| `LUDOYA_GROUP_ID` | Optional. Ludoya group id override (default in `src/lib/ludoya/config.ts`) |
| `LUDOYA_GROUP_USERNAME` / `LUDOYA_GROUP_SEARCH_QUERY` | Optional. Used to rediscover the group id |
| `LUDOYA_API_URL` / `LUDOYA_APP_URL` / `LUDOYA_IMAGE_BASE_URL` | Optional. Ludoya host overrides |
| `LUDOYA_MOCK` | Optional. `1` serves Ludoya fixtures from `/public/mock/ludoya/` |

## Translation Key Namespaces

`nav`, `hero`, `about`, `activities`, `schedule`, `join_us`, `location`, `footer`, `about_page`, `ludoteca`, `contact_page`, `events`, `faq`, `cookies`, `conduct`, `legal`, `privacy`, `error_page`, `not_found`, `metadata`

## Path Alias

`@/*` → `./src/*`

## Key Dependencies

- **motion** v13 (`motion/react`) — animations. Never import from `framer-motion`.
- **lenis** — smooth scrolling
- **next-intl** v4 — i18n routing and translations
- **fast-xml-parser** — BGG XML response parsing
- **resend** — email delivery for contact form
- **react-icons** — icon library (Material Design `react-icons/md` + brand icons `react-icons/fa`)
- **clsx** + **tailwind-merge** — class utilities (via `cn()`)
- **@vercel/analytics** + **@vercel/speed-insights** — Vercel monitoring

## Gotchas

1. **Motion v13 ≠ framer-motion** — Always `import { motion } from "motion/react"`, never from `framer-motion`.
2. **i18n routing** — Always use `Link`/`usePathname`/`useRouter` from `@/i18n/routing`, not Next.js primitives.
3. **Default locale** — Catalan (`ca`) has no URL prefix. `/about` = Catalan, `/es/about` = Spanish.
4. **Section IDs** — Home page sections must have `id` attributes matching `SECTION_THEMES` keys in NavBar for theme detection to work.
5. **No Zustand** — Theme state lives entirely in NavBar scroll detection logic. Zustand is not installed as a dependency.
6. **Cookie consent hydration** — Uses `useSyncExternalStore` (not `useEffect`) to avoid hydration mismatch.
7. **Image quality** — All `<Image>` components must have `quality={60}`. SVGs are excluded (not optimized by Next.js).
8. **BGG mock mode** — Without `BGG_API_KEY`, ludoteca falls back to local XML files in `/public/mock/`. Event images degrade without it: planned plays not in the mock collection get Ludoya's cover and the default orange frame.
9. **Metadata async** — `generateMetadata()` must `await params` to get locale, uses `getTranslations()` from `next-intl/server`.
10. **Activities dual mode** — Desktop uses scroll-pinned horizontal parallax; mobile uses stacked cards that fade and slide up with `whileInView`. Completely separate implementations.
11. **Ludoya API is undocumented** — It changed in Sep 2026 (meetups → events, new group id). Run `npm run ludoya:check` first and follow `docs/ludoya-api-reference.md`.
12. **Routes render dynamically** — `next build` marks every `[locale]` route as dynamic (ƒ), so page-level `revalidate` does not produce ISR. Caching comes from the `fetch` data cache: only 200 responses are stored, and a stale entry keeps being served while it refetches in the background, so an upstream outage shows the last good data.
