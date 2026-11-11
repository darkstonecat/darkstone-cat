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
npm run analyze          # Production build with the bundle analyzer (ANALYZE=true)
npm run lighthouse       # Lighthouse audit — local (build + start + audit + cleanup)
npm run lighthouse:prod  # Lighthouse audit — production (darkstone.cat)
npm run ludoya:check     # Verify Ludoya API endpoints and response shapes (live)
```

### Testing

Requires **Supabase local** running for integration and E2E tests (`npm run db:start`).

```bash
npm test                 # All Vitest tests (unit + integration)
npm run test:unit        # Unit tests only (no Supabase needed)
npm run test:integration # Integration tests only (Supabase needed)
npm run test:watch       # Vitest in watch mode
npm run test:coverage    # Vitest with coverage report
npm run test:e2e         # Playwright E2E (starts dev server on port 3100)
npm run test:e2e:ui      # Playwright with interactive UI
npm run test:e2e:headed  # Playwright in headed browser mode
npm run db:start         # Start local Supabase (Docker required)
npm run db:stop          # Stop local Supabase
npm run db:reset         # Reset local DB (re-applies migrations + seed)
```

Test structure: `tests/` (Vitest — unit, hooks, components, server, integration) and `e2e/` (Playwright — 36 specs). Config: `vitest.config.mts` (two projects: `dom` runs under jsdom, `node` runs `tests/server`, `tests/lib` and `tests/integration` under Node), `playwright.config.ts`. CI: `.github/workflows/ci.yml` (5 parallel jobs; Node from `.nvmrc`, Supabase CLI via `npx` from the lockfile). The scheduled workflows `cache-refresh.yml` and `retention.yml` run with `permissions: {}` and a `concurrency` group.

**Test env (`.env.test.local`, gitignored)**: Vitest (`loadEnv('test')`) and Playwright read it with higher priority than `.env.local`. It must point at the local Supabase, with the same values as the `env:` block of `.github/workflows/ci.yml`: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, the Supabase CLI demo `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, and a dummy 64-hex `ENCRYPTION_KEY`. Without it, integration and E2E tests hit whatever `.env.local` points to and fail with `fetch failed`.

**E2E users**: `e2e/global-setup.ts` creates three users and saves their sessions under `.auth/`; `e2e/global-teardown.ts` deletes them. Use the matching fixture from `e2e/fixtures.ts`:
- `memberPage` (`e2e-member`) and `adminPage` (`e2e-admin`) — **read-only**. Many tests assert their data in parallel (`fullyParallel: true`).
- `editorPage` (`e2e-editor`) — for any test that **writes** profile data. Writing to the shared member caused a flaky race with tests that read it.

Scope text assertions to a region (e.g. the "Dades personals" `section`): the navbar user button also shows the member's first name, so an unscoped `getByText(name)` can match twice.

**After code changes**: run the relevant test suite (`npm test` for logic, `npm run test:e2e` for UI/flows). When adding new features, write corresponding tests before merging.

`engines` requires Node `^22.19.0 || ^24.0.0`, and `.nvmrc` pins 24 for local work and CI. The floor is 22.19 because `lighthouse` needs it; the range is capped at 24 because Vercel deploys the highest major that satisfies `engines`, so an open range would silently move production to the next major. Bumping Node means editing both `engines` and `.nvmrc`.

`lighthouse:local` is an alias of `lighthouse`; both run the same script.

### Lighthouse Audits

Automated Lighthouse audits for all 17 pages (Catalan locale) on mobile + desktop (34 audits total). Scripts in `scripts/lighthouse/`:

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
| `/about` | `about/page.tsx` | Origin story, mission, values. The member stat counts active members (`left_on IS NULL`) with the service role, cached one day by `unstable_cache` (tag `member-count`, `src/lib/supabase/member-count.ts`); on failure it shows `stat_members_value` ("150+") |
| `/ludoteca` | `ludoteca/page.tsx` | Game library with BGG integration (ISR, revalidate: 86400) |
| `/contact` | `contact/page.tsx` | Contact form (Workspace SMTP email) |
| `/events` | `events/page.tsx` | The public agenda (the only one: `/profile` has no sessions or calendar). Dark header (hours, venue, "Gratuït") with one compact banner per upcoming special (max 3, soonest first, "Falten N dies"); desktop: sticky sidebar with the month calendar and "Com funciona", timeline on the right; mobile: "Properes dates" day strip with a "Veure el mes" toggle, then the timeline. Timeline: this week plus the 3 following Madrid weeks, plus specials of the next 12 months; every event is a collapsible card (this week and specials open, later sessions closed, "Desplega-ho tot" per later week) with plays as covers carrying the seat pill. The usual venue is never repeated on a card; the countdown is on specials only. Any `#event-<id>` link (banners, calendar days, strip days, a shared URL) opens that card and scrolls to it. PUBLIC events only, no organizer names. Data from the 60 s Ludoya request (`revalidate = 60`); JSON-LD Event per event |
| `/faq` | `faq/page.tsx` | FAQ with accordion UI, FAQPage schema (`revalidate = false`) |
| `/legal` | `legal/page.tsx` | Terms & conditions (`revalidate = false`) |
| `/privacy` | `privacy/page.tsx` | Privacy policy (`revalidate = false`) |
| `/cookies` | `cookies/page.tsx` | Cookie policy (`revalidate = false`) |
| `/login` | `login/page.tsx` | Login form (`revalidate = false`, `noindex`). Not linked from the NavBar while `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` is unset; its sign-up card then links to the Google Form (`docs/member-area-launch.md`) |
| `/register` | `register/page.tsx` | Registration form (`revalidate = false`, `noindex`). Reachable only by direct URL while `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` is unset |
| `/forgot-password` | `forgot-password/page.tsx` | Password recovery (`revalidate = false`, `noindex`) |
| `/reset-password` | `reset-password/page.tsx` | Set new password — protected route (`revalidate = false`, `noindex`) |
| `/profile` | `profile/page.tsx` | "La meva zona", the member home: greeting hero with tabs and mini card, "Completa el perfil" checklist (hidden at 4/4), badges (grid / mobile carousel), "Beneficis per ser soci" (`BenefitsCard`: member benefits with logo, copyable discount code and shop link, read through RLS; hidden when there are none), as the last section (sessions and the calendar moved to `/events`) — protected route (`revalidate = false`, `noindex`) |
| `/profile/details` | `profile/details/page.tsx` | Profile and account: shared `MemberHeader` + tabs, cards "On jugues" (link Ludoya/BGG), "Dades de soci" (masked DNI/phone), "Comunicacions" (email switch), "Compte" (change password, download data, **"Dona't de baixa"**: M-1, `LeaveAssociationDialog`, server action `leaveAssociation`), "Documents de l'associació" (`DocumentList`: conduct and data protection open in `DocumentDialog`) — protected route (`revalidate = false`, `noindex`) |
| `/profile/edit` | `profile/edit/page.tsx` | Profile edit form — protected route (`revalidate = false`, `noindex`) |
| `/profile/card` | `profile/card/page.tsx` | Member card (tilted landscape card on desktop, portrait card + full-screen QR overlay on mobile, keeps the real NavBar), download — protected route (`revalidate = false`, `noindex`) |
| `/admin` | `admin/page.tsx` | V-1 summary: `admin_stats()` figures, last 10 audit entries, shortcuts — board route (`force-dynamic`, `noindex`). The layout `admin/layout.tsx` guards every admin page with `requireRole("board")` and renders NavBar, `AdminHeader`, `AdminTabs`, Footer |
| `/admin/members` | `admin/members/(list)/page.tsx` | V-2 member list: server search/filters/sort/pagination through `admin_list_members` (URL params `state`, `role`, `sort`, `q`, `page`, `pp`, sanitised by `parseMembersParams`), exports (A-10 CSV, A-16 e-mail lists, S-4 register for superadmins) — board route. The `(list)` route group keeps its `loading.tsx` from wrapping the member file, so an unknown number is a real 404 |
| `/admin/members/[number]` | `admin/members/[number]/page.tsx` | V-3 member file: number checked (`^[0-9A-Za-z-]{1,32}$`) before the guard; edit (A-4), reveal DNI/phone (A-5, audited), leave/rejoin (A-6/A-7), badges (A-8), card (A-9), access link (A-15), data export (A-11), role (S-1/S-2), anonymise (S-3), last 5 audit entries — board route (`force-dynamic`, `noindex`) |
| `/admin/activity` | `admin/activity/page.tsx` | V-4 audit log: filters (dates, who, action group, member number), keyset "Carrega'n més" (`?before=<id>`) — board route (`force-dynamic`) |
| `/admin/badges` | `admin/badges/page.tsx` | V-7 badge catalogue (`admin_list_badges`): "X anys amb Darkstone" first (automatic, no actions, no count), active badges in `sort_order` with active holders, "Visible bloquejada" / "Oculta fins que s'aconsegueix", languages; "Nova insígnia" (creates with icon `star`, opens the badge page), "Arxiva" (dialog with the active holders count); archived badges with "Restaura" and "Esborra" (superadmin, never awarded) — board route (`force-dynamic`, `noindex`) |
| `/admin/badges/[key]` | `admin/badges/[key]/page.tsx` | One badge: key checked with `isBadgeKey` before the guard (404 without a DB call), unknown → 404; texts per language (ca required), icon, `show_locked`, order (sends only changed fields), preview, holders (revoke, "Mostra'n N més" after 10, former members apart), bulk award "Atorga a socis" (≤ 100); archived → read-only except "Restaura" — board route (`force-dynamic`, `noindex`) |
| `/admin/benefits` | `admin/benefits/page.tsx` | V-9 member benefits (`admin_list_benefits`): active benefits with code, shop and languages, "Nou benefici" / "Edita" (one dialog: texts per language with ca required, shop link, discount code, collaborator logo, order when editing), "Arxiva" / "Restaura"; archived ones apart — board route (`force-dynamic`, `noindex`) |
| `/admin/procedures` | `admin/procedures/page.tsx` | V-8 written procedures P-1 … P-7 (`revalidate = false`) — board route |
| `/admin/tools` | `admin/tools/page.tsx` | V-6: cache refresh status per job (`admin_ops_status()`) and manual refresh (A-14), link to the event image tool — board route (`force-dynamic`) |
| `/admin/tools/event-images` | `admin/tools/event-images/page.tsx` | Internal tool: preview/download shareable event images — board route (`revalidate = false`). `/events/images`, `/ca/events/images`, `/es|en/events/images` redirect here with a 308 (`next.config.ts`) |
| `/admin/roles` | `admin/roles/page.tsx` | V-5: active superadmins and board with `role_since`, rules (two superadmins minimum) — superadmin route (`force-dynamic`; board and members get the 404) |
| `/verify/[token]` | `verify/[token]/page.tsx` | Public card check from the member card QR: "Carnet vàlid · Núm. de soci …" or "Carnet no vàlid", nothing else (`force-dynamic`, `noindex`, not in sitemap, `Referrer-Policy: no-referrer` + `X-Robots-Tag` via `next.config.ts`). Lookup only through the `verify_card_token(p_token)` SECURITY DEFINER function (`src/lib/supabase/verify-card.ts`, anonymous cookie-less client) |

**Association documents** (code of conduct, data protection policy) have no page: they open in `DocumentDialog` over the current page (large dialog on desktop, bottom sheet on mobile, text scrolling inside), from `DocumentLink` (a real `<a href="?doc=conduct">`). Entry points: the Footer legal row, the end of `/about`, the sign-up consent boxes, and the "Documents de l'associació" card of `/profile/details`. The open document lives in the URL: a click pushes `?doc=<key>` as a history entry on the same page (other params and the hash are kept), so the browser Back button or the mobile back gesture closes the dialog instead of leaving the page (no lost sign-up form); closing goes back when the page pushed it, otherwise it drops the param with `replaceState`. `?doc=conduct` or `?doc=data-protection` on any URL opens one after hydration (the link to give to outside forms or e-mails, e.g. `https://www.darkstone.cat/?doc=conduct`). **Code that rewrites the whole query string must keep `DOCUMENT_PARAM`** (like `LudotecaClient`'s `serializeStateToUrl`), or it closes an open document. The old `/conduct`, `/data-protection` and `/pautes-de-conducta` URLs answer 404 on purpose (no redirect). Code: `src/lib/documents.ts` (keys, `?doc=` helpers), `src/components/documents/` (`DocumentProvider` mounted in the locale layout, `DocumentDialog`, `DocumentBody`, `DocumentLink`, `DocumentList`). Rich-text tags `<conductLink>` / `<dataProtectionLink>` open them from translated text (`LegalPageContent`, `RegisterForm`).

Every admin page is `noindex` and not in the sitemap. A signed-in member without a board role gets the 404 page (not a "restricted" card); without a session the guard redirects to `/login?redirect=<path>`.

API routes:
- `src/app/api/contact/route.ts` — POST endpoint that sends email through Google Workspace SMTP (nodemailer, `smtp.gmail.com:465`, connection/greeting/socket timeouts set on the transport) from `no-reply@darkstone.cat` to `hola@darkstone.cat`, with `replyTo` set to the sender. **CSRF guard: the `Origin` header must be in `ALLOWED_ORIGINS`** (`darkstone.cat`, `www.darkstone.cat`), otherwise it returns `403 {"error":"forbidden"}` before doing anything. `http://localhost:3000` is accepted only when `NODE_ENV !== "production"` or `CONTACT_ALLOW_LOCALHOST=1` (for testing a local production build; never set it in Vercel). So the form **never works on `*.vercel.app` previews**; test it against a local build on port 3000 with that flag. **Update that list if the production domain changes**, or the form starts failing silently. Order of checks: origin, body size (`Content-Length` or text over 32 KB → 413), JSON object (otherwise 400 `invalid_request`), bot traps, field validation (name 100 / email 254 / subject 150 / message 5000 chars after trim; limits are mirrored as `maxLength` in `ContactForm.tsx`; errors `<field>_required`, `<field>_too_long`, `email_invalid`), then the shared rate limits (per IP 5/hour, only consumed by valid requests, plus the whole-site bucket `contact:global` at 50/day; both → 429 `rate_limited`; IP from `src/lib/client-ip.ts`: `x-real-ip`, then first `x-forwarded-for` hop). Bot traps: the form has a hidden honeypot field `website` and sends `elapsedMs` since it was shown; a filled honeypot or an `elapsedMs` under 3000 or not a number (a missing one is let through, so a tab opened before a deploy still works) answers the normal `200 {"success":true}` WITHOUT sending mail and logs `[contact] dropped: honeypot|too_fast`. SMTP failures log only `{ code, responseCode, command }`.
- `src/app/api/events/[eventId]/image/route.ts` — GET 1080×1080 PNG for an event (Satori via `next/og`, `src/lib/event-image/`). **Admin only** (401 without a session, 403 for a non-board member, `no-store`): its only caller is the admin tool `/admin/tools/event-images`
- `src/app/api/test-image/[count]/route.ts` — GET test image with 1–8 hardcoded games, for layout checks (development only: 404 when `NODE_ENV === "production"`)
- `src/app/api/members/card/route.ts` — GET endpoint for the member card PNG (auth required; 1011x639 landscape face with a real QR of `https://www.darkstone.cat/verify/<card_token>`, rendered by `src/lib/member-card/composer.tsx`). `?preview=1` for inline display, without for download; `?locale=ca|es|en` localizes the PNG labels (unknown values fall back to Catalan). Answers 404 to a former member (`left_on` set), even with a still-valid access token.
- `src/app/api/events/calendar/route.ts` — GET `?month=YYYY-MM&locale=` returns one pre-formatted month of the `/events` calendar (`EventsCalendarMonth`). Public, no session; PUBLIC events only. Months from the current one to 6 ahead, otherwise 400 `invalid_month` (`no-store`). `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300`, or `no-store` when Ludoya failed (the grid then comes without events and with `error`). `EventsCalendar` calls it to switch months without moving the timeline; the Ludoya request behind it is the shared 60 s fetch.
- `src/app/api/cron/refresh/route.ts` — GET scheduled cache refresh (`Authorization: Bearer $CRON_SECRET`, constant-time compare; 500 `not_configured` without the secret, 401 otherwise, 502 if a job failed, `no-store`). Runs the jobs in `src/lib/cache-refresh.ts` (Ludoya and the BGG club collection; per job: `revalidateTag(tag, "max")`, then the warm-up). Called by `.github/workflows/cache-refresh.yml`. Records one `ops_job_runs` row per job (automatic, actor NULL; `src/lib/ops/job-runs.ts`) after the jobs; a recording failure never changes the answer
- `src/app/api/admin/members/export/route.ts` — **POST** CSV export of active members (A-10). Body `{ role?: "all"|"member"|"board"|"superadmin", state?: "active" }`; any other key, value or a query string → 400 `invalid_filter`. Reads through `admin_export_members()` with the SESSION client (the function writes the `export.members_csv` audit entry before returning rows). Columns `Número, Nom, Cognoms, Email, Telèfon, DNI/NIE, CP, Ludoya, BGG, Rol, Newsletter, Primera alta, Alta actual, Creat`; DNI/phone decrypted with the row id; UTF-8 BOM; `escapeCsv` (`src/lib/csv.ts`: values starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'`, unless a plain phone `^\+?[0-9 ]+$`) on every cell; a response capped by PostgREST `max_rows` (1000) → 500 instead of a partial file. Logs `[admin-export] user=<uuid> rows=<n>` (no personal data).
- `src/app/api/admin/members/[number]/data/route.ts` — **POST** member data JSON (A-11). Body `{ reason?: string|null }`; a former member needs a superadmin and a reason of 10+ characters (`admin:reason_required`). The reason is never logged.
- `src/app/api/admin/members/emails/route.ts` — **POST** e-mail list (A-16). Body `{ list: "association"|"newsletter", format?: "csv"|"json" }`; `json` returns `{ list, count, addresses }` for "Copia les adreces". Every call is audited (`export.emails`).
- `src/app/api/admin/members/register/route.ts` — **POST** llibre de socis (S-4), superadmin only, body `{ reason }` (10+). Includes former members' decrypted DNI: the most sensitive file of the panel.
- Shared rules of the four exports: `Origin` must be same-origin (`src/lib/http/origin.ts`, `SITE_ORIGINS` = `darkstone.cat`, `www.darkstone.cat`; any `http://localhost:<port>` outside production) → 403 `forbidden_origin`; then `getAdminAccess("board"|"superadmin")` → 401/403; then the body (JSON object, > 4096 bytes → 413); then the database. GET answers 405. Every answer is `no-store`; database errors log the Postgres code only. **Exports never work on `*.vercel.app` previews**, and `SITE_ORIGINS` must change with the production domain (like the contact form).
- `src/app/api/cron/retention/route.ts` — GET daily retention job (same Bearer `CRON_SECRET` auth and errors as `/api/cron/refresh`, `no-store`, `force-dynamic`). **Dry run unless the query string is exactly `apply=1`.** Calls `run_retention(p_dry_run)` (service role) through `src/lib/retention.ts`: purges former members 3 years after `left_on` (D-H provisional), deletes sign-ups unconfirmed for 30 days, deletes audit entries older than 3 years. 200 `{ ok, dryRun, membersPurged, unconfirmedDeleted, auditEntriesDeleted }`, 502 `retention_failed`. Called by `.github/workflows/retention.yml` (daily; applies only on a manual run with `apply` ticked or when the repository variable `RETENTION_APPLY` is `true`).

The QR of the member card encodes `https://www.darkstone.cat/verify/<members.card_token>` (`buildCardVerifyUrl`); the token is 32 hex chars, revocable with `regenerate_card_token`, and never the member number. `robots.ts` deliberately does not `Disallow` `/verify/`: crawlers must be able to fetch the page to read its `noindex`.

Auth callback routes: `src/app/auth/confirm/route.ts` (email confirmation), `src/app/auth/callback/route.ts` (password recovery), `src/app/auth/magic-link/route.ts` (passwordless login: `verifyOtp({ token_hash, type: 'email' })`, keeps the session, redirects to a same-origin relative `redirect` param or `/profile`, errors go to `/login?magic=error`; the Supabase "Magic link" template must point to `{{ .SiteURL }}/auth/magic-link?token_hash={{ .TokenHash }}&type=email`, locally in `supabase/templates/magic_link.html` via `supabase/config.toml`). These live outside `[locale]` because Supabase sends fixed URLs.

### Provider Stack (layout.tsx)

```
html[lang] → body → JSON-LD script → NextIntlClientProvider → SmoothScroll → CookieConsentProvider → DocumentProvider({children}) + CookieBanner + GoogleAnalytics + Vercel Analytics + SpeedInsights
```

### Theme System

There is **no Zustand store or useThemeSection hook** — themes are handled directly in the NavBar:

- **Home page**: NavBar detects the active section via scroll position (`getBoundingClientRect` against viewport center) and applies theme colors from `SECTION_THEMES` map. Section IDs must match keys exactly: `""` (hero), `"about"`, `"activities"`, `"schedule"`, `"join-us"`, `"location"`.
- **Subpages**: NavBar reads `usePathname()` and applies fixed themes from `SUBPAGE_THEMES` map.
- **Pattern**: Alternating light (`#EEE8DC` bg / `#1c1917` text) and dark (`#1C1917` bg / `#FAFAF9` text) sections.
- Each section component handles its own background color independently via Tailwind classes.

### Smooth Scrolling

Lenis library provides smooth scrolling via `src/components/SmoothScroll.tsx` (React Context). Access with `useLenis()`. Respects `prefers-reduced-motion`. Duration: 1.0s with exponential easing. Touch multiplier: 2x. The rAF loop runs only while there is scroll activity; `SmoothScroll` wraps `lenis.scrollTo` so a programmatic scroll starts it (before that fix a `lenis.scrollTo()` from code never moved the page).

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
--color-brand-orange-light: #E07A2E  (orange on dark bg only)
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
- `src/components/events/` — Events page: `EventsHeader` (header chips + special banners), `EventsTimeline` (client: week groups, open state, toggle all, the document-wide `#event-` link handler that opens and scrolls), `EventCard` (session / special card), `PlayCard` + `SeatPill` (cover with the seat counter), `EventsCalendar` (client month grid: `sidebar` variant on desktop, `inline` under the mobile strip; month navigation through `/api/events/calendar`), `EventsDayStrip` (client, mobile: swipeable days, edge fade, dots, "Veure el mes"), `HowItWorks`, `EventsStatus` (error / empty). Pure helpers in `src/lib/events/`: `agenda-view.ts` (selection, weeks, countdown, view model without organizer or visibility), `agenda-format.ts` (every date text, formatted on the server, plus the strip days), `seat-counter.ts`, `calendar-view.ts` + `month-grid.ts` (month grid, range current..+6), `links.ts` (anchors, Ludoya and maps links), `clock.ts` (`agendaNow()`); server modules `agenda.ts` (`fetchEventsAgenda`) and `calendar.ts` (`fetchEventsCalendar`). Also the event images tool content (`EventImagesContent`, rendered by `/admin/tools/event-images`)
- `src/components/faq/` — FAQ page (FaqContent)
- `src/components/documents/` — Association document dialog (DocumentProvider, DocumentDialog, DocumentBody with the conduct and data protection sections, DocumentLink, DocumentList)
- `src/components/auth/` — Auth pages (AuthHero, LoginForm + LoginSignupCard with magic link, RegisterFlow / RegisterForm / RegisterDone for the multi-step sign-up and "Revisa el teu correu", ForgotPasswordForm, ResetPasswordForm)
- `src/components/profile/` — Profile pages (MemberHeader, MemberTabs shared by the member area: MemberHeader is the one dark header of Inici / Perfil / Carnet, with eyebrow, title, member line, equal-width tabs, optional children below the tabs and an optional top-aligned aside; GamingAccounts, MemberDataCard, NewsletterSwitch, AccountActions for `/profile/details`; CardFace, QrCodeSvg, CardQrOverlay, CardDownloadButton for `/profile/card`; HomeHero, ProfileChecklist, BadgesSection, BenefitsCard (server: full-width benefit rows, the last section) + CopyCodeButton (client: copies the discount code, announces it) for the home `/profile`, with the pure helper `src/lib/member-home/badge-items.ts` (tenure badge first, then the catalogue from `getBadgeCatalogue()` with names and texts resolved on the server in the page locale (Catalan fallback), `show_locked` off hides an unearned badge, stored badges missing from the catalogue are not shown); ProfileEditForm, LeaveAssociationDialog (M-1; `AccountActions` disables "Dona't de baixa" for role holders, BR-12))
- `src/app/[locale]/verify/[token]/` — Public card verification page (no components of its own)
- `src/components/admin/` — Admin panel. Shell: `AdminHeader`, `AdminTabs` (Resum, Socis, Activitat, Insígnies, Beneficis, Procediments, Eines, plus Rols for superadmins; `activeAdminTab(pathname)`), `AdminDialog` (shared dialog: portal to body, focus trap, inert page, Lenis stopped, optional reason slot with the "no DNI or phone" hint, `superadminOnly` chip, procedure link, bottom sheet on mobile), `StatusChip`, `Notice`, `ReasonButton` (disabled button with a visible reason), `adminButtons.ts`, `ExportConfirmDialog` (A-10).
  - `overview/AdminOverview` (V-1); `members/` (V-2: `MembersFilters`, `MembersList`, `MembersExports`, `EmailsExportDialog`, `RegisterExportDialog`);
  - `member-file/` (V-3: `MemberFile`, `PersonalDataCard` + `MemberEditForm` + `RevealButton`, `MembershipActions` (leave/rejoin), `BadgesCard`, `CardSection` (card + access link), `MemberDataExport`, `RoleCard` (roles + anonymise), `Field`, `errors.ts` (action code → text));
  - `benefits/` (V-9: `BenefitList`, `BenefitFormDialog` (create/edit, language tabs, logo select), `BenefitStateDialog` (archive/restore), `shared.ts`);
  - `badges/` (V-7: `BadgeCatalogue`, `CreateBadgeDialog`, `BadgeStateDialog` (archive/restore/delete), `BadgeDetail`, `BadgeEditForm` (language tabs, icon picker, switch, preview), `BadgeHolders`, `BulkAwardDialog`, `BadgeCircle`, `shared.ts` (error keys, languages));
  - `activity/` (V-4: `ActivityFilters`, `ActivityList`, `AuditParts`); `procedures/` (`ProceduresContent` + `procedures.ts`); `tools/ToolsContent` (V-6); `roles/RolesContent` (V-5).
  - Server-side helpers in `src/lib/admin/`: `guard.ts` (`requireRole`, `getAdminAccess`), server actions `member-actions.ts` (A-4/A-5/A-8/A-9), `membership-actions.ts` (A-6/A-7), `access-actions.ts` (A-15), `superadmin-actions.ts` (S-1/S-2/S-3), `ops-actions.ts` (A-14), `action-context.ts` + `action-errors.ts` (shared guard, DB prefix → code), pure modules `members-list.ts`, `member-file.ts`, `activity.ts`, `audit-format.ts` (the one audit renderer), `stats.ts`, `ops-status.ts`, `leave-dates.ts`, `exports.ts`, `export-client.ts`. Job-run recording in `src/lib/ops/job-runs.ts`. Mail in `src/lib/mail/` (Workspace SMTP transport shared with the contact form, `templates/membership.ts`, Catalan only, D-C).
- `src/components/legal/` — Legal pages (LegalPageContent, LegalContent, PrivacyContent, CookiesContent)
- Root-level: NavBar, Footer, SmoothScroll, CookieBanner, CookieConsentProvider, GoogleAnalytics, ScrollProgress, ScrollToTop, TextReveal, LanguageSwitcher, ThemeLink, ErrorContent, SkipLink, CollaboratorModal

### Ludoteca (Game Library)

Server-side BGG integration in `src/lib/bgg.ts`:
- Fetches from BoardGameGeek XML API v2, parses with `fast-xml-parser`
- Mock mode (local XML files in `/public/mock/`) when no API key
- Separate fetches for boardgames vs expansions, then enriches with thing endpoint (weight, categories, mechanics)
- Expansion linking: thing-based inbound links (`linkExpansionsByThing`), used by both the live and the mock path
- Batch fetching: 20 items/request, retry: 5 attempts with exponential backoff (2s base)
- ISR: `revalidate: 86400` (1 day)
- Cache tag: the club collection requests (base + expansion collection URLs, used by `fetchBggCollection` and `fetchBggCollectionCount`, plus the thing enrichment in `fetchThingData`) carry `BGG_CACHE_TAG` (`"bgg"`) via `fetchBggXml(url, { tags })`. **Every call site of a tagged URL must pass the tag** (the cache key ignores tags and an entry keeps the tags of the request that wrote it). Per-game lookups (`searchBggGames`, `fetchBggThings`, `game-matching`) stay untagged. `/api/cron/refresh` marks the tag stale and re-reads the collection through `fetchBggCollectionOrThrow()` (the page-facing `fetchBggCollection()` wraps it and never throws), so the data is at most about a day old without traffic. In mock mode the job just re-reads the local fixtures

Client state in `LudotecaClient.tsx`:
- Filters: search, gameType, rankTypes, players, duration, weight, age, categories, mechanics
- Sort: name/rating/weight × asc/desc
- View: grid/list, pagination (24/48/96/192 per page)
- URL serialization: query params (`q`, `type`, `rank`, `players`, `duration`, `weight`, `age`, `cat`, `mech`, `sort`, `view`, `pp`, `page`)

### Authentication

- **Supabase Auth** with PKCE flow via `@supabase/ssr`
- Client-side auth calls (`signUp`, `signInWithPassword`, `updateUser`) from `@/lib/supabase/client`
- Server-side helpers in `src/lib/supabase/auth.ts`: `getCurrentUser()`, `getCurrentMember()` (null for a former member)
- Server Action `src/lib/supabase/actions.ts`: `updateMemberAfterSignup()` — encrypts DNI/phone via `@/lib/encryption`
- Server Action `src/lib/profile/actions.ts`: `updateMemberProfile()` enforces the same rules as sign-up (`src/lib/validation/member-fields.ts`, `normalizeUsername`; names max 100), rejects non-string input and returns stable error codes (`invalid_name`, `invalid_phone`, `invalid_dni`, `invalid_postal_code`, `invalid_username`, `failed`, `unauthenticated`) that `ProfileEditForm` maps to translated messages. It never returns a database message (it logs only the Postgres error code)
- Hook `src/hooks/useAuthUser.ts`: reactive `{ user, role, loading }` via `onAuthStateChange`
- Auth callback routes at `src/app/auth/` (outside `[locale]`): `/auth/confirm` (email — discards session cookies), `/auth/callback` (recovery — keeps session for password reset), `/auth/magic-link` (passwordless login — keeps session; open-redirect-safe `redirect` param)
- **Known limitation**: email scanners that prefetch GET links can consume the one-time token of `/auth/confirm`, `/auth/callback` and `/auth/magic-link`; the member must then request a new link.
- **Roles** (`members.role`): `member`, `board` ("Junta"), `superadmin`. Hierarchical (`role_rank()`: 0/1/2; `has_role(min)` true only for an ACTIVE member). Pure TS mirror in `src/lib/auth/roles.ts` (`toRole`, `roleRank`, `hasRoleAtLeast`, `isBoardRole`, `isSuperadmin`, `roleLabelKey`). The retired `admin` role (removed by M7, `20261007100000_roles_contract.sql`) is an unknown role there: no rank, no access.
- **Guards**: pages call `requireRole("board"|"superadmin", returnTo)` (React-cached; no session → `/login?redirect=…`, anyone else → `notFound()`); API routes and server actions call `getAdminAccess(min)` (401/403). The proxy only checks for a session on `/admin` (prefix match, `ADMIN_ROUTES`).
- **Rules in the database** (never only in the UI): BR-10 at least two superadmins (a demotion is refused while fewer than two OTHER active superadmins remain; promote first), BR-11 nobody changes their own role, BR-12 a former member holds no role and a role holder can neither leave nor delete their account. Enforced by `members_role_guard` / `members_role_delete_guard` (`role_guard:*` errors). Roles change only through `admin_set_role` (superadmin).
- **Membership state**: `left_on`, `left_by` (`self`|`board`), `leave_reason`, `current_joined_on`, `anonymised_at`, `purged_at`. A leave (`member_leave_self` M-1, `admin_member_leave` A-6) bans the auth user (`banned_until`), deletes its sessions and refresh tokens and rotates the card token in the same transaction; rejoin (`admin_member_rejoin`) lifts the ban. Former members cannot sign in (GoTrue `user_banned` is shown as the wrong-password text plus a "contacta amb la junta" help line), get no magic link (`is_email_confirmed` false) and no reset mail.
- **Password reset** goes through the server action `requestPasswordReset` (`src/lib/supabase/password-reset-actions.ts`), never `resetPasswordForEmail` from the browser: throttled per IP (10) and per address (3) per 10 min, sends only to confirmed active members, always answers `{ error: null }` (no enumeration). Its `redirectTo` is `<request origin>/auth/callback`: Supabase's redirect allow-list must contain it.
- **Audit log** (`public.audit_log`): append-only (trigger refuses UPDATE/TRUNCATE and DELETE of entries younger than 3 years), readable by board+, written only by SECURITY DEFINER functions through `audit_write()` (one entry per admin mutation, same transaction) and by `log_admin_event()` for the app-side events (`member.send_access_link`, `ops.cache_refresh`). Details never hold DNI/phone values (BR-15 detector `audit_details_leak()`, also a CHECK); the free-text reason is not scanned, so dialogs tell people not to type them.
- **Sign-out** revokes the session server-side: the NavBar awaits the `signOutCurrentSession` server action (`src/lib/supabase/session-actions.ts`: SSR client, `signOut({ scope: "local" })`, so only this session's refresh token dies and other devices stay signed in) for up to 3 s, then still wipes the `sb-…-auth-token` cookies and hard-redirects. The browser `signOut()` is avoided because it hangs on a Navigator Lock.
- **OTP types are whitelisted**: `/auth/callback` only accepts `type=recovery`; `/auth/confirm` only `signup`, `email` or `email_change` (anything else goes to the route's error redirect); `/auth/magic-link` only `email`. The Supabase "Confirm signup", "Change email" and "Reset password" templates must send those types.
- **Magic link requests go through a server action** (`requestMagicLink` in `src/lib/supabase/magic-link-actions.ts`), never `signInWithOtp` from the browser: GoTrue mails an UNCONFIRMED account a sign-up confirmation link that confirms and signs in, so someone who pre-registered a victim's email with their own password would get a confirmed account. The action asks `public.is_email_confirmed(p_email)` (SECURITY DEFINER, service_role only) and only then sends the OTP; unknown, unconfirmed, throttled (`allowRequestShared`: 10 per IP and 3 per address per 10 min) and sent all answer `{ error: null }`, so the form reveals nothing.
- **Last sign-up wins for unconfirmed accounts**: GoTrue keeps an existing UNCONFIRMED user, and its password, when the same email signs up again, so a stranger who pre-registered a victim's email would own the account once the victim confirms it. `RegisterForm` therefore calls the server action `prepareSignup(email)` (`src/lib/supabase/actions.ts`) right before `signUp`: it asks `public.unconfirmed_user_id(p_email)` (SECURITY DEFINER, `search_path=''`, service_role only, returns an id only for an unconfirmed user) and deletes that user with `auth.admin.deleteUser` (the `members` row cascades). A confirmed account is never deleted. It always answers `{ ok: true }` (no enumeration), is throttled per IP only (`allowRequestShared`, 10 per 10 min; a per-address limit would let an attacker burn the victim's bucket first) and never blocks the sign-up (a failure logs one line without the address). Accepted residual: someone can cancel another person's pending, unconfirmed sign-up (they register again and get a fresh link), and an attacker who signs up AFTER the victim and BEFORE the victim confirms still yields a confirmation mail with the attacker's password (a window of minutes). **The migration `20261001130000_unconfirmed_user_id.sql` must be applied to production** before the new code is deployed (until then `prepareSignup` logs the lookup failure and sign-up proceeds as before).
- **Sign-up never reveals an existing email**: the "already registered" error and a successful sign-up both end on the same "Revisa el teu correu" screen, and a failed optional-data save (`updateMemberAfterSignup`) shows no notice (it logs `[signup] member details not saved reason=…` server-side; the member completes it from the `/profile` checklist). Known gap: pre-registration of someone else's email with an attacker password is still possible through the normal sign-up (GoTrue keeps the first password and confirms that account when the victim follows the link); the victim finds out when their own password fails and resets it.
- Local `supabase/config.toml` mirrors the hardened password policy: `minimum_password_length = 8` (what the client enforces) and `secure_password_change = true` (recovery and fresh sessions can still change the password). Production is set in the dashboard.
- **Member area launch flag**: `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` (`src/lib/member-area.ts`) decides whether the NavBar offers "Inicia sessió" and whether `/login` links to `/register`. Production runs without it until the board has verified the area; the checklist, publishing and rollback steps are in `docs/member-area-launch.md`. The "Fes-te soci" buttons always use `MEMBERSHIP_FORM_URL` (Google Form)
- Middleware: explicit early return for `/auth/*` paths (prevents `next-intl` interference), PROTECTED_ROUTES require auth, AUTH_ROUTES redirect to `/profile` when logged in, `/reset-password` is in PROTECTED_ROUTES (not AUTH_ROUTES)
- Session check time limit: `updateSession` (`src/lib/supabase/middleware.ts`) races `getUser()` against `SESSION_CHECK_TIMEOUT_MS` (3 s). When Supabase is unreachable (a paused free-tier project, an outage) auth-js retries a token refresh for about 25 s on EVERY page, so on timeout or error the request is treated as anonymous: public pages render for a visitor and protected routes redirect to `/login` (never fail open). Logs `[auth] session check timed out after 3000 ms` / `[auth] session check failed` without details. The free-tier project pauses after about a week without activity: restore it from the Supabase dashboard

### Events (Ludoya)

Ludoya **public v1 API** (`https://api.ludoya.com/public/v1`, header `X-Api-Key`, Business plan, 100 req/min), adapter in `src/lib/ludoya/`. The organisation is implied by the key, so there is no group id. The key is **server-only** (modules import `server-only`; never send it from the browser, never log it). Reference and troubleshooting in `docs/ludoya-api-reference.md`; the vendor's own docs are `docs/ludoya-api-reference-official.md`.
- `config.ts` — hosts, endpoint paths, cache lifetimes (env-overridable host). `client.ts` — `ludoyaGet()`: `X-Api-Key`, timeout, retry, `Retry-After` handling, typed `LudoyaApiError` codes (`rate_limited`, `unauthorized`, `missing_api_key`, `timeout`, …), mock mode. `shape.ts` — guards that throw `LudoyaShapeError` with the exact field path. `normalize.ts` — the **only** file that knows raw shapes. `sessions.ts` — `fetchSessions()` (events + locations → usual venue) and Madrid-day windows. `username.ts` — Ludoya username lookup. `index.ts` — `fetchUpcomingEvents()`.
- Components only use view models: `LudoyaEvent` (`types.ts`) for the admin event images, the agenda view model of `src/lib/events/` (built from `LudoyaSession`) for `/events`. When Ludoya changes, touch `config.ts`/`normalize.ts`, not components.
- Flow: one `GET /events?includeSubEvents=true` returns sessions and their planned plays (`parentId`); `GET /locations` marks the usual venue (`isDefault`, shown as received). Drafts, cancelled, friends-only and private events are skipped; the public site lists `PUBLIC` only.
- Cache: `/events` and its calendar read `fetchMemberAreaSessions()` (`src/lib/member-sessions.ts`, 60 s, because seat counts change; `withCovers()` adds the BGG covers within `COVER_BUDGET_MS`); the event images keep `fetchUpcomingEvents` and 86400 s. ONLY_GROUP sessions and plays stay hidden (web sign-up is open and every account is a `member`) until a board-approved member state exists. `.github/workflows/cache-refresh.yml` calls `/api/cron/refresh` twice a day (production only; runs from `main`), which marks the `ludoya` tag stale (and `bgg`, see Ludoteca) and re-reads both requests, so the data is at most about a day old without traffic
- Not in the public API: BGG id, game type (RPG flag), waiting-list count. `queuedParticipantCount` stays null.
- Event images (`/admin/tools/event-images`, `src/lib/game-matching.ts`): BGG is the source of truth for cover/weight/type, matched by **name + year**: club collection, then BGG search + thing, then Ludoya cover with the default frame (`GAME_NAME_OVERRIDES` can force a BGG id). The BGG cover is used only when the year also matches. Logs `[EventImage] Resolved N/M games: …` with the path each game took
- Username checks (sign-up and profile, `src/lib/profile/username-checks.ts`): server actions returning found / not_found / failed, never blocking; throttled per IP with the shared limiter (`src/lib/rate-limit.ts`)
- Mock mode: `LUDOYA_MOCK=1` reads sanitized fixtures from `/public/mock/ludoya/v1/` (no key needed; the E2E server sets it). Their dates are fixed (October-December 2026), so the E2E server also sets `LUDOYA_MOCK_NOW=2026-10-01T10:00:00Z`, which `agendaNow()` uses as the `/events` "now" (only with `LUDOYA_MOCK=1`)
- Monitoring: `.github/workflows/ludoya-check.yml` runs `scripts/ludoya/check.mjs` weekly and needs the `LUDOYA_API_KEY` repository secret
- Ludoya images are served as `application/octet-stream` from `images.ludoya.com` (since November 2026; the old `ludoya-images.s3.eu-west-par.io.cloud.ovh.net` stays allowed). Every image host must be in `next.config.ts` `remotePatterns` **and** CSP `img-src` (pinned by `tests/lib/next-config-images.test.ts`) and in `IMAGE_HOSTS` of `scripts/ludoya/check.mjs`: a missing host makes `next/image` throw in dev (the page shows the 500 error screen) and the production optimizer answer 400 (broken images)

### Cookie Consent

`CookieBanner` handles keys (Escape rejects, Tab trap) only while focus is inside it, and its delayed autofocus skips when focus is in another `aria-modal` dialog, so Escape in a document or admin dialog closes that dialog instead of rejecting cookies.

`src/hooks/useCookieConsent.ts` — Uses `useSyncExternalStore` for localStorage subscription (prevents hydration mismatch). Key: `darkstone_cookie_consent`. Status: `'accepted' | 'rejected' | null`. Google Analytics only loads when accepted.

### SEO

- `src/app/sitemap.ts` — Dynamic sitemap: one entry per page **and locale** with hreflang alternates. **Only indexable pages** — never list a page that sets `robots: noindex` (Search Console flags it as a contradiction)
- `src/app/robots.ts` — robots.txt
- `src/lib/seo.ts` — `getLocalizedUrl()` / `getAlternates()` build canonical + hreflang URLs. The root is always `https://www.darkstone.cat/` (with trailing slash)
- `src/app/[locale]/[...rest]/page.tsx` — Catch-all that calls `notFound()` so unknown paths render the custom `not-found.tsx` instead of the Next.js default 404
- `next.config.ts` `redirects()` — Permanent (308) redirects: `/events/images` → `/admin/tools/event-images`, and `/ca/*` → `/*` (next-intl's middleware only does a temporary 307). **When renaming a route, add a permanent redirect from the old path here.**
- `src/app/[locale]/opengraph-image.tsx` — Dynamic OG image (1200×630)
- Layout: JSON-LD Organization schema, OpenGraph + Twitter metadata
- Metadata base: `https://www.darkstone.cat`
#### Checklist: Adding a new page

When adding a new page, update **all** of the following:

1. `src/app/[locale]/<page>/page.tsx` — Page with `generateMetadata()`, JSON-LD (BreadcrumbList + WebPage + any page-specific schema), revalidate
2. `src/components/<page>/` — Page component(s)
3. `src/messages/{ca,es,en}.json` — Add keys in `metadata` namespace (`<page>_title`, `<page>_description`), `nav` namespace (breadcrumb name), `footer` namespace (if linked from footer), and page-specific namespace
4. `src/app/sitemap.ts` — Add entry to `pages` array with path, changeFrequency, priority — no `lastModified` (**skip if the page is `noindex`**)
5. `src/components/NavBar.tsx` — Add `"/<page>"` to `SUBPAGE_THEMES` map (required for theme detection)
6. `src/components/Footer.tsx` — Optionally add link to `NAV_LINKS` (main pages) or `LEGAL_LINKS` (support/legal pages)
7. `scripts/lighthouse/config.mjs` — Add entry to `PAGES` array
8. `CLAUDE.md` — Update Pages table, Component Structure list, and Translation Key Namespaces
9. `README.md` — Update Pages table

### Security Headers & Build Config (next.config.ts)

HSTS, CSP (`'unsafe-eval'` in `script-src` only outside production, verified on a production build; `'unsafe-inline'` stays until a nonce CSP exists), X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy (camera/microphone/geolocation disabled). Remote image pattern: `cf.geekdo-images.com` (BGG images).

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

### Rate limiting

`src/lib/rate-limit.ts` has two limiters. `allowRequestShared(scope, ip|null, limit, windowMs)` is the one public endpoints use (contact form, username checks): it calls the `public.rate_limit_hit(p_bucket, p_max, p_window_seconds)` SECURITY DEFINER function through the service-role client, so the quota is shared by every serverless instance. Buckets are `<scope>:<HMAC-SHA256(ip)>` keyed from `ENCRYPTION_KEY` (never a raw IP; GDPR) or just `<scope>` for global ones; rows live in `public.rate_limit_hits` (RLS on, no policies, service role only) and expired rows are deleted on use, plus an occasional sweep of rows older than 2 days (windows are capped at 2 days). If Supabase errors, times out (3 s) or the env is missing, it **fails open** to the in-memory `allowRequest` of that instance and logs one warning without the IP. Unit tests that import it must mock `@/lib/supabase/admin`, or they hit whatever Supabase `.env.test.local` points to. **New migrations are not applied to production automatically**: apply `supabase/migrations/20261001100000_shared_rate_limiter.sql` (and every later one) to the production Supabase project before deploying code that depends on it; until then the limiter just falls back to in-memory.

Migrations: new `CHECK` constraints are added `NOT VALID` (length-only) so legacy rows never block a migration. `members` has length checks matching the app limits (names 100, usernames 64, postal code 10, ciphertext columns 512; `20261001110000_member_data_hardening.sql`). `generate_member_number()` is a column default only: it has a pinned `search_path` and is executable by `service_role` and `postgres` only (not `anon`/`authenticated`, so it is not callable through `/rest/v1/rpc`).

**Admin panel migrations and production.** Migrations in order: `20261005100000_membership_state` (M1), `20261005100100_roles_expand` (M2), `20261005100200_audit_log` (M3), `20261005100300_admin_read_rpcs` (M4), `20261005100400_membership_lifecycle`, `20261005100500_member_admin_mutations`, `20261005100600_roles_and_anonymise`, `20261005100700_lock_down_member_secrets` (apply + deploy together), `20261005100800_admin_exports`, `20261005100900_admin_exports_more`, `20261006100000_member_number_width`, `20261006100100_retention`, `20261006100200_ops_job_runs`, `20261006100300_ops_record_actor`, `20261006100400_activity_hide_names`, `20261007100000_roles_contract` (M7: only after the deploy and the superadmin bootstrap; it refuses to run without two active superadmins), `20261103100000_badge_catalogue` and `20261103110000_badge_holders` (badge catalogue; applied to production on 2026-11-03 with `supabase db push --linked`, dry run first), `20261111100000_member_benefits` (member benefits; applied to production on 2026-11-11 with `supabase db push --linked`, dry run first; seeds only Outlet Games).
- There is **one** Supabase project (`httvpxakxaycqbagybym`), used by production. It is fully migrated, M7 included (two superadmins bootstrapped, DNI/phone re-encrypted to v2). The ordered runbook in `odd/tasks/admin-panel.md` ("Prod runbook") records how it was done.
- Admin reads and writes go through SECURITY DEFINER `admin_*` functions (`search_path ''`, EXECUTE for `authenticated` only, role checked inside, actor = `auth.uid()`), called with the user's SESSION client — never the service role, or the audit actor and BR-11 are lost. Errors carry stable prefixes (`admin:*`, `membership:*`, `role_guard:*`, `audit:*`, `ops:*`) that `src/lib/admin/action-errors.ts` maps to codes.
- Board sessions cannot read other members' rows or badges directly (no `admins_select_all`); `get_all_members_for_admin()` no longer exists (M7).
- `ops_job_runs`: cache refresh runs (automatic via `ops_record_job_run`, manual via `ops_record_manual_job_run`, both service role); `admin_ops_status()` feeds V-6.
- `member_number_format(n)`: numbers keep 3 digits up to 999 and grow past it (`000-1000`).
- Production member numbers are 000-001 … 000-202 in the order of the original Google Forms sheet, with no gaps (renumbered on 2026-11-03; repeated sign-ups merged into the first one). They are sheet positions, not the sheet's number column: match sheet rows by email. Details in `odd/tasks/admin-panel.md`, "Member list import and renumbering".
- **Member benefits** (`public.member_benefits`, `odd/tasks/member-benefits.md`). Perks for members (first: Outlet Games, code `DARKSTONE`): `name` / `description` `{ca, es?, en?}` (ca required, 60 / 200 chars; same helpers as badges), optional `discount_code` (1-40 chars, no spaces), `url` (https, 300), `collaborator_id` (logo: an id of `src/data/collaborators.ts`; the database only checks the slug shape, the app refuses unknown ids and shows no image for them), `sort_order`, `archived_at`. RLS: only ACTIVE members (`has_role('member')`) read non-archived rows, so the code never reaches visitors or former members; nobody writes the table through the API (not even the service role). Board functions `admin_list_benefits`, `admin_create_benefit`, `admin_update_benefit` (returns changed fields; `discount_code` / `collaborator_id` clear with null or ""), `admin_archive_benefit`, `admin_restore_benefit`; audit actions `benefit.create|update|archive|restore` with `details.name` (never the code), activity filter `benefit.*`. App side: `src/lib/benefits/view.ts` (pure: `toBenefitViews`, `collaboratorLogo`), `src/lib/supabase/benefits.ts` (`getMemberBenefits`, server-only), `src/lib/admin/benefits.ts` (form parser, `BENEFIT_LOGOS`), `src/lib/admin/benefit-actions.ts`. The code must never go in `src/messages` or a public page.
- **Badge catalogue** (`public.badges`, `odd/tasks/badge-catalogue.md`). App side: `src/lib/badges/catalogue.ts` (pure: `BADGE_ICON_KEYS` mirror of `badge_icon_keys()`, pinned by an integration test; `localize()`; `toCatalogue()`), `src/components/badges/badgeIcons.ts` (icon key → `react-icons/md`). Badge names and texts live only in the database, never in `src/messages`; the admin member file names held badges from `admin_get_member` and greys archived ones; the activity log prints `details.name`, and pre-catalogue entries fall back to `admin.activity.badge.*`. Database side: `key` is an immutable slug (`badges:key_immutable`; `member_tenure` and `member_year` are reserved), `name` / `earned_text` / `locked_text` are `{ca, es?, en?}` (ca required, 60 / 200 chars), `icon` is one of `badge_icon_keys()`. `member_badges.badge_key` is a foreign key to it. Members read only non-archived badges; nobody writes the table through the API. Board functions: `admin_list_badges`, `admin_create_badge`, `admin_update_badge`, `admin_archive_badge`, `admin_restore_badge`, `admin_award_badge_bulk` (1..100 members, all or nothing, skips holders); `admin_delete_badge` is superadmin only and refuses a badge ever awarded (`admin:badge_in_use`). Archiving hides a badge from every member but keeps `member_badges` (restore is lossless; the member's own data export still lists it); award and revoke of an archived badge answer `admin:badge_archived`. Every `badge.*` audit entry stores the Catalan name in `details.name`. The tenure badge "X anys amb Darkstone" is derived in code (`src/lib/member-tenure.ts`, BR-6) and never in the catalogue.
- Test helpers: `createTestAdmin` creates a `board` member; superadmins are created only in `tests/integration/roles.test.ts` (it asserts the global count); `deleteTestUser` demotes first and `forceDemoteForTests` handles the last two superadmins. The audit log is append-only, so tests cannot delete their entries (filter by their own ids; `db:reset` clears them).
- `supabase/snippets/` is owned by root (Studio), so the superadmin bootstrap SQL lives in the runbook text, not in that folder.

## Environment Variables

| Variable | Description |
|---|---|
| `SMTP_USER` | Google Workspace account that sends contact form email (`no-reply@darkstone.cat`) and the leave/rejoin e-mails (`src/lib/mail/`) |
| `SMTP_PASSWORD` | App password of `SMTP_USER` (requires 2-Step Verification on that account) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `BGG_USERNAME` | BoardGameGeek username for ludoteca collection |
| `BGG_API_KEY` | BoardGameGeek XML API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only; cron jobs, `auth.admin.deleteUser`, retention). Admin panel data goes through the session client, not this key |
| `ENCRYPTION_KEY` | 64-character hex string (`/^[0-9a-f]{64}$/i`, 32 bytes) for AES-256-GCM encryption of member DNI and phone. `src/lib/encryption.ts` and `src/lib/supabase/admin.ts` import `server-only`; `encrypt(plain, memberId)` writes `v2:<member uuid>:<iv>:<tag>:<data>` (AES-256-GCM, AAD `member:<uuid>`); `decrypt(value, memberId)` needs the owner to match and rejects malformed input (12-byte IV, 16-byte tag). A stored value must name its own row (`members_ciphertext_guard` trigger, `members:ciphertext_unbound`). Legacy `iv:tag:data` values are refused (the fallback was removed after the database was re-encrypted with `node scripts/reencrypt-member-secrets.mjs --dry-run` / `--apply`, exit codes 0 clean, 1 errors, 2 usage/environment, 3 duplicates, and a dry run showed `legacy=0`). Keep the script to re-encrypt a legacy value restored from an old backup |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase publishable key for client-side auth |
| `LUDOYA_API_KEY` | Ludoya public API key (Business plan, 100 req/min). Server-side only; never expose to the browser. Used by `src/lib/ludoya/client.ts` |
| `CRON_SECRET` | Bearer secret of `GET /api/cron/refresh` and `GET /api/cron/retention`. Set it in Vercel (Production) and as the `CRON_SECRET` GitHub repository secret, with the same value. Unset means the route answers 500 |
| `LUDOYA_API_URL` / `LUDOYA_APP_URL` | Optional. Ludoya API host (e.g. the sandbox `https://api.dev.ludoya.com`, which needs a sandbox key) and web app host used for event links |
| `CONTACT_ALLOW_LOCALHOST` | Optional. `1` makes `/api/contact` accept the `http://localhost:3000` origin even when `NODE_ENV=production` (local production build only; never set it in Vercel) |
| `RETENTION_APPLY` | Optional GitHub repository **variable** (not a secret, not a Vercel env). `true` makes the scheduled `retention.yml` runs apply (`?apply=1`); anything else or unset keeps them dry runs |
| `LUDOYA_MOCK` | Optional. `1` serves Ludoya fixtures from `/public/mock/ludoya/v1/` |
| `LUDOYA_MOCK_NOW` | Optional, tests only. An ISO instant used as the `/events` "now" when `LUDOYA_MOCK=1` (ignored otherwise); the Playwright server sets it |
| `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` | Optional. `1` advertises the member area: the NavBar login button (and its loading placeholder) and the `/login` sign-up card linking to `/register`. Unset or anything else hides them: visitors see no login button, the card links to the Google Form (`MEMBERSHIP_FORM_URL` in `src/lib/member-area.ts`), and `/login`, `/register` stay reachable by direct URL; a signed-in member still gets the user pill. Inlined at build time: set it in Vercel and redeploy. The Playwright server sets it to `1` |

## Translation Key Namespaces

`nav`, `hero`, `about`, `about_page`, `activities`, `schedule`, `join_us`, `location`, `footer`, `ludoteca`, `contact_page`, `events`, `event_images`, `faq`, `cookies`, `cookie_policy`, `conduct`, `legal`, `legal_notice`, `privacy`, `privacy_policy`, `data_protection`, `documents`, `error_page`, `not_found`, `metadata`, `auth`, `verify`, `profile`, `admin`, `collaborators`

`admin` has sub-namespaces `members`, `member_file`, `activity`, `badges`, `benefits`, `overview`, `procedures`, `roles`, `tools`; `metadata` has `admin_{,members_,procedures_,roles_,activity_,tools_,badges_,badge_,benefits_}{title,description}`; `nav` has `admin`, `admin_members`, `admin_procedures`, `admin_roles`, `admin_activity`, `admin_tools`, `admin_badges`, `admin_benefits`.

## Path Alias

`@/*` → `./src/*`

## Key Dependencies

- **@supabase/supabase-js** + **@supabase/ssr** — Supabase client and SSR auth (PKCE flow)
- **motion** v13 (`motion/react`) — animations. Never import from `framer-motion`.
- **lenis** — smooth scrolling
- **next-intl** v4 — i18n routing and translations
- **fast-xml-parser** — BGG XML response parsing
- **nodemailer** — contact form email via Google Workspace SMTP
- **react-icons** — icon library (Material Design `react-icons/md` + brand icons `react-icons/fa`)
- **clsx** + **tailwind-merge** — class utilities (via `cn()`)
- **@vercel/analytics** + **@vercel/speed-insights** — Vercel monitoring. Web Analytics reports normally; **Speed Insights needs a paid Vercel plan, which the project does not have**, so its `POST /<hash>/vitals` answers `503` and no metric is ever stored. The component stays mounted so it starts working if the plan changes — the 503s are expected, not a bug. Both scripts load from obfuscated paths (`/<16-hex>/script.js`), not `/_vercel/insights/…`, and both ignore automated browsers, so they can only be verified in a real one
- **uqr** — QR code matrix generator (pure JS, zero deps, `src/lib/member-card/qr.ts`); **jsqr** (dev) decodes a rasterised QR in unit tests
- **csv-parse** (dev) — CSV parsing for member migration script

## Gotchas

1. **Motion v13 ≠ framer-motion** — Always `import { motion } from "motion/react"`, never from `framer-motion`.
2. **i18n routing** — Always use `Link`/`usePathname`/`useRouter` from `@/i18n/routing`, not Next.js primitives. Exception: `LanguageSwitcher` uses `next/link` with `getPathname()`, because next-intl's `<Link locale="ca">` forces a `/ca` prefix that 308-redirects. Its links must stay real `<a href>` (not buttons) so crawlers find the `/es` and `/en` pages.
3. **Default locale** — Catalan (`ca`) has no URL prefix. `/about` = Catalan, `/es/about` = Spanish.
4. **Section IDs** — Home page sections must have `id` attributes matching `SECTION_THEMES` keys in NavBar for theme detection to work.
5. **No Zustand** — Theme state lives entirely in NavBar scroll detection logic. Zustand is not installed as a dependency.
6. **Cookie consent hydration** — Uses `useSyncExternalStore` (not `useEffect`) to avoid hydration mismatch.
7. **Image quality** — All `<Image>` components must have `quality={60}`. SVGs are excluded (not optimized by Next.js).
8. **BGG mock mode** — Without `BGG_API_KEY`, ludoteca falls back to local XML files in `/public/mock/`. Event images degrade without it: planned plays not in the mock collection get Ludoya's cover and the default orange frame.
9. **Metadata async** — `generateMetadata()` must `await params` to get locale, uses `getTranslations()` from `next-intl/server`.
10. **Activities dual mode** — Desktop uses scroll-pinned horizontal parallax; mobile uses stacked cards that fade and slide up with `whileInView`. Completely separate implementations.
11. **Ludoya public API** — Versioned and documented, but Ludoya can still add or rename fields. Run `npm run ludoya:check` first (needs `LUDOYA_API_KEY`) and follow `docs/ludoya-api-reference.md`. The key is a server-side credential: never expose it to the client.
12. **Routes render dynamically** — `next build` marks every `[locale]` route as dynamic (ƒ), so page-level `revalidate` does not produce ISR. Caching comes from the `fetch` data cache: only 200 responses are stored, and a stale entry keeps being served while it refetches in the background, so an upstream outage shows the last good data.
13. **`/reset-password` in PROTECTED_ROUTES** — Not in AUTH_ROUTES. User arrives with a session established by `/auth/callback`, so the middleware must allow access (PROTECTED_ROUTES), not redirect to profile (AUTH_ROUTES).
14. **Auth callback routes outside `[locale]`** — `/auth/confirm`, `/auth/callback` and `/auth/magic-link` live at `src/app/auth/` because Supabase sends fixed redirect URLs with token params. The middleware has an explicit early return for `/auth/*` paths to prevent `next-intl` from intercepting them.
15. **Email confirm discards session** — `/auth/confirm` uses a temporary response for `verifyOtp` and returns a clean redirect without session cookies. This prevents the middleware from redirecting `/login` → home (because user would appear authenticated).
16. **Profile redirect** — Login and AUTH_ROUTES redirect to `/profile`. Login form uses `redirect` query param when available, otherwise defaults to `/profile`.

17. **Admin data never through the service role** — admin pages, routes and actions call the `admin_*` functions with the SESSION client after `requireRole` / `getAdminAccess`. The service role is used only for what has no user (cron, `auth.admin.deleteUser`, recording a manual refresh with a verified actor).
18. **Admin exports are POST + same-origin** — they fail on Vercel previews and on any origin missing from `src/lib/http/origin.ts`.
19. **Role holders cannot leave or delete their account** (BR-12): remove the role first, and with two superadmins promote the replacement before demoting anyone (BR-10).
20. **Retired `admin` role** — gone since M7: `src/lib/auth/roles.ts` treats it as unknown (no access). Old audit entries keep `actor_role = 'admin'` and still render as "Junta".
21. **The audit log is append-only** — tests cannot delete their entries (filter by their own ids; `db:reset` clears them).
22. **Dialogs lock the page through a shared counter** — `useModalDialog` (`src/hooks/useModalDialog.ts`), used by `AdminDialog`, `DocumentDialog` and `CardQrOverlay`: it sets `#main-content` inert, stops Lenis and hides body overflow while open, moves focus to `[data-autofocus]`, traps Tab, handles Escape and returns focus on close; the lock is released only when the last open dialog closes (a dialog opening while another closes keeps the page locked), restoring the original overflow / inert / Lenis state. The dialogs render in a portal to `body`. Build new dialogs on this hook (admin ones on `AdminDialog`), not on ad-hoc modals.
23. **E2E: use `expectHydrated`, not `networkidle`** — `e2e/helpers/hydration.ts` `expectHydrated(locator)` waits until React has attached its props to the control the test is about to use (`networkidle` is flaky on a cold dev server).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
