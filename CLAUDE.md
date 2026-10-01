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

Test structure: `tests/` (Vitest — unit, hooks, components, server, integration) and `e2e/` (Playwright — 15 specs). Config: `vitest.config.mts` (two projects: `dom` runs under jsdom, `node` runs `tests/server`, `tests/lib` and `tests/integration` under Node), `playwright.config.ts`. CI: `.github/workflows/ci.yml` (5 parallel jobs; Node from `.nvmrc`, Supabase CLI via `npx` from the lockfile).

**Test env (`.env.test.local`, gitignored)**: Vitest (`loadEnv('test')`) and Playwright read it with higher priority than `.env.local`. It must point at the local Supabase, with the same values as the `env:` block of `.github/workflows/ci.yml`: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, the Supabase CLI demo `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, and a dummy 64-hex `ENCRYPTION_KEY`. Without it, integration and E2E tests hit whatever `.env.local` points to and fail with `fetch failed`.

**E2E users**: `e2e/global-setup.ts` creates three users and saves their sessions under `.auth/`; `e2e/global-teardown.ts` deletes them. Use the matching fixture from `e2e/fixtures.ts`:
- `memberPage` (`e2e-member`) and `adminPage` (`e2e-admin`) — **read-only**. Many tests assert their data in parallel (`fullyParallel: true`).
- `editorPage` (`e2e-editor`) — for any test that **writes** profile data. Writing to the shared member caused a flaky race with tests that read it.

Scope text assertions to a region (e.g. the "Dades personals" `section`): the navbar user button also shows the member's first name, so an unscoped `getByText(name)` can match twice.

**After code changes**: run the relevant test suite (`npm test` for logic, `npm run test:e2e` for UI/flows). When adding new features, write corresponding tests before merging.

`engines` requires Node `^22.19.0 || ^24.0.0`, and `.nvmrc` pins 24 for local work and CI. The floor is 22.19 because `lighthouse` needs it; the range is capped at 24 because Vercel deploys the highest major that satisfies `engines`, so an open range would silently move production to the next major. Bumping Node means editing both `engines` and `.nvmrc`.

`lighthouse:local` is an alias of `lighthouse`; both run the same script.

### Lighthouse Audits

Automated Lighthouse audits for all 20 pages (Catalan locale) on mobile + desktop (40 audits total). Scripts in `scripts/lighthouse/`:

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
| `/contact` | `contact/page.tsx` | Contact form (Workspace SMTP email) |
| `/events` | `events/page.tsx` | Upcoming events from the Ludoya public API (`revalidate: 86400`) |
| `/events/images` | `events/images/page.tsx` | Internal tool: preview/download shareable event images — admin route (`noindex`, not in sitemap) |
| `/faq` | `faq/page.tsx` | FAQ with accordion UI, FAQPage schema (`revalidate = false`) |
| `/conduct` | `conduct/page.tsx` | Code of conduct (`revalidate = false`) |
| `/legal` | `legal/page.tsx` | Terms & conditions (`revalidate = false`) |
| `/privacy` | `privacy/page.tsx` | Privacy policy (`revalidate = false`) |
| `/cookies` | `cookies/page.tsx` | Cookie policy (`revalidate = false`) |
| `/login` | `login/page.tsx` | Login form (`revalidate = false`, `noindex`) |
| `/register` | `register/page.tsx` | Registration form (`revalidate = false`, `noindex`) |
| `/forgot-password` | `forgot-password/page.tsx` | Password recovery (`revalidate = false`, `noindex`) |
| `/reset-password` | `reset-password/page.tsx` | Set new password — protected route (`revalidate = false`, `noindex`) |
| `/profile` | `profile/page.tsx` | "La meva zona", the member home: greeting hero with tabs and mini card, "Completa el perfil" checklist (hidden at 4/4), badges (grid / mobile carousel), "Properes sessions" (this week's Ludoya sessions and plays streamed in a Suspense boundary with skeleton / empty / error states, expandable rows), month calendar (`?month=YYYY-MM`, invalid or out-of-range falls back to the current month) — protected route (`revalidate = false`, `noindex`) |
| `/profile/details` | `profile/details/page.tsx` | Profile and account: shared member hero + tabs, cards "On jugues" (link Ludoya/BGG), "Dades de soci" (masked DNI/phone), "Comunicacions" (email switch), "Compte" — protected route (`revalidate = false`, `noindex`) |
| `/profile/edit` | `profile/edit/page.tsx` | Profile edit form — protected route (`revalidate = false`, `noindex`) |
| `/profile/card` | `profile/card/page.tsx` | Member card (tilted landscape card on desktop, portrait card + full-screen QR overlay on mobile, keeps the real NavBar), download — protected route (`revalidate = false`, `noindex`) |
| `/admin` | `admin/page.tsx` | Admin dashboard with stats and navigation — admin route (`revalidate = false`, `noindex`) |
| `/admin/members` | `admin/members/page.tsx` | Member list with search, sort and CSV export — admin route (`revalidate = false`, `noindex`) |
| `/data-protection` | `data-protection/page.tsx` | Data protection policy, RGPD compliance (`revalidate = false`) |
| `/verify/[token]` | `verify/[token]/page.tsx` | Public card check from the member card QR: "Carnet vàlid · Núm. de soci …" or "Carnet no vàlid", nothing else (`force-dynamic`, `noindex`, not in sitemap, `Referrer-Policy: no-referrer` + `X-Robots-Tag` via `next.config.ts`). Lookup only through the `verify_card_token(p_token)` SECURITY DEFINER function (`src/lib/supabase/verify-card.ts`, anonymous cookie-less client) |

API routes:
- `src/app/api/contact/route.ts` — POST endpoint that sends email through Google Workspace SMTP (nodemailer, `smtp.gmail.com:465`, connection/greeting/socket timeouts set on the transport) from `no-reply@darkstone.cat` to `hola@darkstone.cat`, with `replyTo` set to the sender. **CSRF guard: the `Origin` header must be in `ALLOWED_ORIGINS`** (`darkstone.cat`, `www.darkstone.cat`), otherwise it returns `403 {"error":"forbidden"}` before doing anything. `http://localhost:3000` is accepted only when `NODE_ENV !== "production"` or `CONTACT_ALLOW_LOCALHOST=1` (for testing a local production build; never set it in Vercel). So the form **never works on `*.vercel.app` previews**; test it against a local build on port 3000 with that flag. **Update that list if the production domain changes**, or the form starts failing silently. Order of checks: origin, body size (`Content-Length` or text over 32 KB → 413), JSON object (otherwise 400 `invalid_request`), bot traps, field validation (name 100 / email 254 / subject 150 / message 5000 chars after trim; limits are mirrored as `maxLength` in `ContactForm.tsx`; errors `<field>_required`, `<field>_too_long`, `email_invalid`), then the shared rate limits (per IP 5/hour, only consumed by valid requests, plus the whole-site bucket `contact:global` at 50/day; both → 429 `rate_limited`; IP from `src/lib/client-ip.ts`: `x-real-ip`, then first `x-forwarded-for` hop). Bot traps: the form has a hidden honeypot field `website` and sends `elapsedMs` since it was shown; a filled honeypot or an `elapsedMs` under 3000 or not a number (a missing one is let through, so a tab opened before a deploy still works) answers the normal `200 {"success":true}` WITHOUT sending mail and logs `[contact] dropped: honeypot|too_fast`. SMTP failures log only `{ code, responseCode, command }`.
- `src/app/api/events/[eventId]/image/route.ts` — GET 1080×1080 PNG for an event (Satori via `next/og`, `src/lib/event-image/`). **Admin only** (401 without a session, 403 for a non-admin, `no-store`): its only caller is the admin tool `/events/images`
- `src/app/api/test-image/[count]/route.ts` — GET test image with 1–8 hardcoded games, for layout checks (development only: 404 when `NODE_ENV === "production"`)
- `src/app/api/members/card/route.ts` — GET endpoint for the member card PNG (auth required; 1011x639 landscape face with a real QR of `https://www.darkstone.cat/verify/<card_token>`, rendered by `src/lib/member-card/composer.tsx`). `?preview=1` for inline display, without for download; `?locale=ca|es|en` localizes the PNG labels (unknown values fall back to Catalan).
- `src/app/api/profile/calendar/route.ts` — GET `?month=YYYY-MM&locale=` returns one pre-formatted calendar month for La meva zona (members only, `no-store`; month range 3 back / 6 forward, otherwise 400). The client `MemberCalendar` calls it to switch months without re-rendering the page; the Ludoya request behind it is the shared 60 s fetch.
- `src/app/api/cron/refresh/route.ts` — GET scheduled cache refresh (`Authorization: Bearer $CRON_SECRET`, constant-time compare; 500 `not_configured` without the secret, 401 otherwise, 502 if a job failed, `no-store`). Runs the jobs in `src/lib/cache-refresh.ts` (per job: `revalidateTag(tag, "max")`, then the warm-up). Called by `.github/workflows/cache-refresh.yml`
- `src/app/api/admin/members/export/route.ts` — GET endpoint for CSV export of all members (admin required). Full decrypted data with UTF-8 BOM. Cells go through `escapeCsv` (`src/lib/csv.ts`): values starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'` (formula injection) unless they are a plain phone (`^\+?[0-9 ]+$`). Logs one `[admin-export] user=<uuid> rows=<n>` line per export (no personal data).

The QR of the member card encodes `https://www.darkstone.cat/verify/<members.card_token>` (`buildCardVerifyUrl`); the token is 32 hex chars, revocable with `regenerate_card_token`, and never the member number. `robots.ts` deliberately does not `Disallow` `/verify/`: crawlers must be able to fetch the page to read its `noindex`.

Auth callback routes: `src/app/auth/confirm/route.ts` (email confirmation), `src/app/auth/callback/route.ts` (password recovery), `src/app/auth/magic-link/route.ts` (passwordless login: `verifyOtp({ token_hash, type: 'email' })`, keeps the session, redirects to a same-origin relative `redirect` param or `/profile`, errors go to `/login?magic=error`; the Supabase "Magic link" template must point to `{{ .SiteURL }}/auth/magic-link?token_hash={{ .TokenHash }}&type=email`, locally in `supabase/templates/magic_link.html` via `supabase/config.toml`). These live outside `[locale]` because Supabase sends fixed URLs.

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
- `src/components/events/` — Events page (EventsHero, EventsContent) and event images tool (EventImagesHero, EventImagesContent)
- `src/components/faq/` — FAQ page (FaqContent)
- `src/components/conduct/` — Code of conduct (ConductContent)
- `src/components/auth/` — Auth pages (AuthHero, LoginForm + LoginSignupCard with magic link, RegisterFlow / RegisterForm / RegisterDone for the multi-step sign-up and "Revisa el teu correu", ForgotPasswordForm, ResetPasswordForm)
- `src/components/profile/` — Profile pages (MemberHero, MemberTabs, MemberAvatar shared by the member area; GamingAccounts, MemberDataCard, NewsletterSwitch, AccountActions for `/profile/details`; CardFace, QrCodeSvg, CardQrOverlay, CardDownloadButton for `/profile/card`; HomeHero, ProfileChecklist, BadgesSection, SessionsSection (server, Suspense + fetch), SessionsList (client accordion), CalendarSection (server: streams the first month behind a Suspense skeleton, `?month=YYYY-MM` sets it), MemberCalendar (client: month navigation through `/api/profile/calendar`, skeleton, error card) and MonthCalendar (client: desktop sheet / mobile grid + day panel, receives a `CalendarView` with every date already formatted on the server) for the home `/profile`, with pure helpers in `src/lib/member-home/` (`badge-items.ts`, `sessions-view.ts`: `toPublicSessions` keeps PUBLIC sessions and plays only (web sign-up is open and every account is a `member`; ONLY_GROUP stays hidden until a board-approved member state exists), seat status, counts, Madrid dates; `month-grid.ts`: Monday-first grid, month range 3 back / 6 forward, `?month` parsing); ProfileEditForm, DeleteAccountDialog)
- `src/app/[locale]/verify/[token]/` — Public card verification page (no components of its own)
- `src/components/admin/` — Admin pages (AdminDashboard, MembersTable, ExportConfirmDialog)
- `src/components/legal/` — Legal pages (LegalPageContent, LegalContent, PrivacyContent, CookiesContent, DataProtectionContent)
- Root-level: NavBar, Footer, SmoothScroll, CookieBanner, CookieConsentProvider, GoogleAnalytics, ScrollProgress, ScrollToTop, TextReveal, LanguageSwitcher, ThemeLink, ErrorContent, SkipLink, CollaboratorModal

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

### Authentication

- **Supabase Auth** with PKCE flow via `@supabase/ssr`
- Client-side auth calls (`signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`) from `@/lib/supabase/client`
- Server-side helpers in `src/lib/supabase/auth.ts`: `getCurrentUser()`, `getCurrentMember()`, `isAdmin()`
- Server Action `src/lib/supabase/actions.ts`: `updateMemberAfterSignup()` — encrypts DNI/phone via `@/lib/encryption`
- Server Action `src/lib/profile/actions.ts`: `updateMemberProfile()` enforces the same rules as sign-up (`src/lib/validation/member-fields.ts`, `normalizeUsername`; names max 100), rejects non-string input and returns stable error codes (`invalid_name`, `invalid_phone`, `invalid_dni`, `invalid_postal_code`, `invalid_username`, `failed`, `unauthenticated`) that `ProfileEditForm` maps to translated messages. It never returns a database message (it logs only the Postgres error code)
- Hook `src/hooks/useAuthUser.ts`: reactive `{ user, role, loading }` via `onAuthStateChange`
- Auth callback routes at `src/app/auth/` (outside `[locale]`): `/auth/confirm` (email — discards session cookies), `/auth/callback` (recovery — keeps session for password reset), `/auth/magic-link` (passwordless login — keeps session; open-redirect-safe `redirect` param)
- **Known limitation**: email scanners that prefetch GET links can consume the one-time token of `/auth/confirm`, `/auth/callback` and `/auth/magic-link`; the member must then request a new link.
- **Sign-out** revokes the session server-side: the NavBar awaits the `signOutCurrentSession` server action (`src/lib/supabase/session-actions.ts`: SSR client, `signOut({ scope: "local" })`, so only this session's refresh token dies and other devices stay signed in) for up to 3 s, then still wipes the `sb-…-auth-token` cookies and hard-redirects. The browser `signOut()` is avoided because it hangs on a Navigator Lock.
- **OTP types are whitelisted**: `/auth/callback` only accepts `type=recovery`; `/auth/confirm` only `signup`, `email` or `email_change` (anything else goes to the route's error redirect); `/auth/magic-link` only `email`. The Supabase "Confirm signup", "Change email" and "Reset password" templates must send those types.
- **Magic link requests go through a server action** (`requestMagicLink` in `src/lib/supabase/magic-link-actions.ts`), never `signInWithOtp` from the browser: GoTrue mails an UNCONFIRMED account a sign-up confirmation link that confirms and signs in, so someone who pre-registered a victim's email with their own password would get a confirmed account. The action asks `public.is_email_confirmed(p_email)` (SECURITY DEFINER, service_role only) and only then sends the OTP; unknown, unconfirmed, throttled (`allowRequestShared`: 10 per IP and 3 per address per 10 min) and sent all answer `{ error: null }`, so the form reveals nothing.
- **Sign-up never reveals an existing email**: the "already registered" error and a successful sign-up both end on the same "Revisa el teu correu" screen, and a failed optional-data save (`updateMemberAfterSignup`) shows no notice (it logs `[signup] member details not saved reason=…` server-side; the member completes it from the `/profile` checklist). Known gap: pre-registration of someone else's email with an attacker password is still possible through the normal sign-up (GoTrue keeps the first password and confirms that account when the victim follows the link); the victim finds out when their own password fails and resets it.
- Local `supabase/config.toml` mirrors the hardened password policy: `minimum_password_length = 8` (what the client enforces) and `secure_password_change = true` (recovery and fresh sessions can still change the password). Production is set in the dashboard.
- Middleware: explicit early return for `/auth/*` paths (prevents `next-intl` interference), PROTECTED_ROUTES require auth, AUTH_ROUTES redirect to `/profile` when logged in, `/reset-password` is in PROTECTED_ROUTES (not AUTH_ROUTES)

### Events (Ludoya)

Ludoya **public v1 API** (`https://api.ludoya.com/public/v1`, header `X-Api-Key`, Business plan, 100 req/min), adapter in `src/lib/ludoya/`. The organisation is implied by the key, so there is no group id. The key is **server-only** (modules import `server-only`; never send it from the browser, never log it). Reference and troubleshooting in `docs/ludoya-api-reference.md`; the vendor's own docs are `docs/ludoya-api-reference-official.md`.
- `config.ts` — hosts, endpoint paths, cache lifetimes (env-overridable host). `client.ts` — `ludoyaGet()`: `X-Api-Key`, timeout, retry, `Retry-After` handling, typed `LudoyaApiError` codes (`rate_limited`, `unauthorized`, `missing_api_key`, `timeout`, …), mock mode. `shape.ts` — guards that throw `LudoyaShapeError` with the exact field path. `normalize.ts` — the **only** file that knows raw shapes. `sessions.ts` — `fetchSessions()` (events + locations → usual venue) and Madrid-day windows. `username.ts` — Ludoya username lookup. `index.ts` — `fetchUpcomingEvents()`.
- Components only use the normalized types in `types.ts` (`LudoyaEvent` for `/events`, `LudoyaSession` for the member area). When Ludoya changes, touch `config.ts`/`normalize.ts`, not components.
- Flow: one `GET /events?includeSubEvents=true` returns sessions and their planned plays (`parentId`); `GET /locations` marks the usual venue (`isDefault`, shown as received). Drafts, cancelled, friends-only and private events are skipped; the public site lists `PUBLIC` only.
- Cache: `/events` and event images keep 86400 s; the member home (`src/lib/member-sessions.ts`: `fetchMemberWeekSessions`, `fetchMonthEvents`) uses 60 s because seat counts change. `.github/workflows/cache-refresh.yml` calls `/api/cron/refresh` twice a day (production only; runs from `main`), which marks the `ludoya` tag stale and re-reads the member-area and `/events` requests, so the data is at most about a day old without traffic
- Not in the public API: BGG id, game type (RPG flag), waiting-list count. `queuedParticipantCount` stays null.
- Event images (`/events/images`, `src/lib/game-matching.ts`): BGG is the source of truth for cover/weight/type, matched by **name + year**: club collection, then BGG search + thing, then Ludoya cover with the default frame (`GAME_NAME_OVERRIDES` can force a BGG id). The BGG cover is used only when the year also matches. Logs `[EventImage] Resolved N/M games: …` with the path each game took
- Username checks (sign-up and profile, `src/lib/profile/username-checks.ts`): server actions returning found / not_found / failed, never blocking; throttled per IP with the shared limiter (`src/lib/rate-limit.ts`)
- Mock mode: `LUDOYA_MOCK=1` reads sanitized fixtures from `/public/mock/ludoya/v1/` (no key needed; the E2E server sets it)
- Monitoring: `.github/workflows/ludoya-check.yml` runs `scripts/ludoya/check.mjs` weekly and needs the `LUDOYA_API_KEY` repository secret
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

## Environment Variables

| Variable | Description |
|---|---|
| `SMTP_USER` | Google Workspace account that sends contact form email (`no-reply@darkstone.cat`) |
| `SMTP_PASSWORD` | App password of `SMTP_USER` (requires 2-Step Verification on that account) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `BGG_USERNAME` | BoardGameGeek username for ludoteca collection |
| `BGG_API_KEY` | BoardGameGeek XML API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, for admin operations like account deletion) |
| `ENCRYPTION_KEY` | 64-character hex string (`/^[0-9a-f]{64}$/i`, 32 bytes) for AES-256-GCM encryption of member DNI and phone. `src/lib/encryption.ts` and `src/lib/supabase/admin.ts` import `server-only`; `decrypt` rejects anything that is not `iv:tag:data` with a 12-byte IV and 16-byte tag |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase publishable key for client-side auth |
| `LUDOYA_API_KEY` | Ludoya public API key (Business plan, 100 req/min). Server-side only; never expose to the browser. Used by `src/lib/ludoya/client.ts` |
| `CRON_SECRET` | Bearer secret of `GET /api/cron/refresh`. Set it in Vercel (Production) and as the `CRON_SECRET` GitHub repository secret, with the same value. Unset means the route answers 500 |
| `LUDOYA_API_URL` / `LUDOYA_APP_URL` | Optional. Ludoya API host (e.g. the sandbox `https://api.dev.ludoya.com`, which needs a sandbox key) and web app host used for event links |
| `CONTACT_ALLOW_LOCALHOST` | Optional. `1` makes `/api/contact` accept the `http://localhost:3000` origin even when `NODE_ENV=production` (local production build only; never set it in Vercel) |
| `LUDOYA_MOCK` | Optional. `1` serves Ludoya fixtures from `/public/mock/ludoya/v1/` |

## Translation Key Namespaces

`nav`, `hero`, `about`, `about_page`, `activities`, `schedule`, `join_us`, `location`, `footer`, `ludoteca`, `contact_page`, `events`, `event_images`, `faq`, `cookies`, `cookie_policy`, `conduct`, `legal`, `legal_notice`, `privacy`, `privacy_policy`, `data_protection`, `error_page`, `not_found`, `metadata`, `auth`, `verify`, `profile`, `admin`, `collaborators`

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
