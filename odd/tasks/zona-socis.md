# Zona de socis — implementation plan (phase 1)

## Objective

Build the redesigned member area described in `docs/mockups/zona-socis/` (local-only, gitignored):
login, sign-up + "Revisa el teu correu", member home "La meva zona", profile details, member card
with a real QR, and the public card verification page.

## Problem and why

Today `/profile` is a plain data sheet, sign-up ends in an inline success box, there is no
passwordless login, the card PNG has no QR, and the Ludoya adapter uses the old undocumented API
without a key and without seat data. The design was closed on 2026-09-30 (README section 8) and
the Ludoya public API key is available, so the member area can now be built.

## Sources of truth

- `docs/mockups/zona-socis/README.md` (rules, tokens, responsive patterns, content facts, data gaps,
  decisions 1–6). Priority: screenshot > `screens/*.md` spec > `source/*.dc.html`.
- `docs/ludoya-api-reference-official.md` (public v1 API: `X-Api-Key`, server-side only,
  `Cache-Control: private, max-age=30`, sandbox `https://api.dev.ludoya.com`).
- Engram: `decision/zona-socis-open-decisions`, `decision/zona-socis-home-layout`,
  `decision/zona-socis-mobile`, `decision/zona-socis-style-alignment`, `decision/venue-name`.

## Scope

In: screens 01, 02, 02b, 03, 04, 05 and `/verify/<token>`; the data model, Ludoya public API
adapter and auth routes they need; `next-intl` copy in `ca`/`es`/`en`; tests; docs.

Also in: moving every Ludoya use (`/events`, `/events/images`, `ludoya:check`) to the public
API and removing the old undocumented client (decision Q4).

Out: screen 99 (member directory privacy), avatar upload, wallet pass, admin UI for badges,
BGG collection match, voting, site-wide input-border contrast change, consent timestamps (Q1).

## Constraints

- Design rules in README section 4 (headings, buttons, greys ≥ `/65`, 44 px targets, tokens,
  `quality={60}`, icons from `react-icons`, reuse the real NavBar and Footer).
- Never ship sample data (README section 10) or `no-reply@darkstone.cat` in the UI.
- `LUDOYA_API_KEY` is server-side only; only `src/lib/ludoya/normalize.ts` (or its public-API
  counterpart) knows raw shapes. Business plan: 100 req/min.
- QR never encodes the sequential member number.
- `/profile` keeps being the post-login target; it now means "La meva zona".
- Every new user-facing string in three locales.

## Branch, commits and checks

- **Branch**: work directly on `develop-users` (development branch). No feature branch, no pull
  requests, no chained PRs for this feature; merging to `main` is a later, separate decision.
- **Commits**: one Conventional Commit per task below (work unit = behaviour + its tests + its
  docs). No AI attribution lines. Record the hash under each task.
- **Reviews**: after each commit, when RDD is on, run
  `gentle-ai review assess --cwd . --agent claude-code --base-ref <last reviewed boundary> --committed-only --json`
  and follow `review_due`. First boundary: `b7d51d1`. Record tier and outcome per task.
- **TDD**: off (source: no project/session TDD configuration; same as previous ODD documents).
  Runners: Vitest (`npm run test:unit`, `npm run test:integration`), Playwright (`npm run test:e2e`).
  Tests are still written with each task, not deferred.
- **Checks per task**: `npm run lint`, `npx tsc --noEmit`, the relevant Vitest project;
  integration tests when a migration or RLS changes (`npm run db:reset` first); the E2E specs
  of the touched screen. At the end of each screen block: visual comparison at 1280 px and
  390 px (DSF 2) against `screenshots/` (README section 3, step 4). Full `npm test`,
  `npm run test:e2e` and `npm run build` at block B8.
- **Pace**: one screen block per session (README section 3). Each block starts by reading its
  spec and screenshots.

## Blocks, order and dependencies

```
B1 Data model ───────────────┬──────────────► B5 Card + QR + verify
B2 Ludoya public API ──┬─────┼──────────────► B6 La meva zona
                       └► B4 Sign-up ◄─ B3 Login (shared auth UI pieces)
B3 Login + magic link (independent)
B5 needs B1; B6 needs B1, B2, B7-shell (task B7.1); B2.6 needs the B2.1 BGG-bridge gate
B7 Profile shell + /profile/details (before B6, because /profile becomes the home)
B8 Close
```

Execution order: **B1 → B2 → B3 → B4 → B7 → B5 → B6 → B8**.
(B7 is numbered by screen but runs before B5/B6: it creates the shared hero + tabs and moves the
current data sheet off `/profile`.)

## Tasks

### B1 — Data model (Supabase)

- [x] B1.1 — Migration: `members.card_token` (random, unique, not null, backfilled for existing
  rows, default for new rows) + `regenerate_card_token(member)` admin-only function; RLS keeps
  the token readable by its owner and admins only. Types in `src/lib/supabase/auth.ts`.
  Tests: `tests/integration/triggers`/`rls` cases (new member gets a token, member cannot read
  another's token, member cannot change own token). Route: inline candidate (one migration +
  types), delegate if RLS work grows.
  - Evidence: `db:reset` applied; integration rls+triggers 20/20 pass (token on new member, distinct tokens, own read, other unreadable, own update rejected, admin regenerate, non-admin rejected); lint and tsc clean. Token = 32 hex from `gen_random_uuid()` (no extension). Commit: see git log.
  - Evidence (correction): migration `20260930100200` pins `membership_start_date` and `created_at` in `members_update_own` WITH CHECK, adds `CHECK (card_token ~ '^[0-9a-f]{32}$')` and revokes INSERT/UPDATE/DELETE/TRUNCATE on `member_badges` from anon/authenticated. Profile edit and signup actions never send those columns. New rls tests (own start date/created_at unchanged, malformed admin token rejected, anon rpc rejected, unknown member raises); `db:reset` and lint/tsc/unit/integration results in the commit report.
- [x] B1.2 — Migration: `member_badges` (member id, badge key, awarded_at, unique pair), RLS
  select-own + admin all, no member writes; badge keys as a check constraint
  (`volunteer_egara_joga`, `ludoteca_donor`). "Membre {year}" is derived, not stored
  (decision 3; year from `membership_start_date`, decision Q2). Tests: RLS integration.
  - Evidence: `db:reset` applied; `member-badges.test.ts` 8/8 pass (check constraint, unique pair, cascade, select own/admin all, no member or admin API writes).
- [x] B1.3 — Server helper `getMemberBadges()` + derived "Membre {year}". Unit test.
  - Evidence: `tests/unit/member-badges.test.ts` 4/4 pass; helper in `src/lib/supabase/badges.ts` (pure `buildMemberBadges` + `getMemberBadges`).

### B2 — Ludoya public API adapter (replaces the old client, decision Q4)

- [x] B2.1 — Probe: fetch `GET /public/v1/openapi.json`, record response shapes for `events`
  (with `includeSubEvents`), `events/{id}/children`, `locations`, `search/users`,
  `search/boardgames`; save sanitized fixtures under `public/mock/ludoya/`. No personal data in
  fixtures. **Gate for B2.6**: find the public-API replacement for the BGG-id bridge
  (`GET /boardgames/{slug}` in `resolveBggIds`); if none exists, stop and ask before B2.6.
  - Evidence: 9 GET probes against production (all 200, `Cache-Control: private, max-age=30`); sanitized fixtures in `public/mock/ludoya/v1/` (events with sub-events, 2 children, locations, users found/empty, boardgame search; organizer replaced by "Organizer A", user by "Member A"). Gate result: no BGG id in any public game shape, so the bridge is dropped; event images resolve by name + year (user decision 2026-09-30).
- [x] B2.2 — Public client in `src/lib/ludoya/client.ts`: `LUDOYA_API_KEY` env, `X-Api-Key`
  header, typed error codes (`rate_limited` → honour `Retry-After`), mock mode `LUDOYA_MOCK`,
  per-call `revalidate`. Server-only module guard. The organisation is implied by the key, so
  group-id config and rediscovery go away. Unit tests with fixtures.
  - Evidence: `tests/lib/ludoya/client.test.ts` 13/13 pass (URL + `X-Api-Key` + revalidate, missing key, 401 no retry, 5xx retry, 429 `Retry-After` honoured / over cap surfaced, timeout/network codes, key never in errors or logs, mock fixtures). Old client kept as `legacy-*` files until B2.6; `server-only` added as a dependency with a Vitest alias stub.
- [x] B2.3 — Normalize + types for member-area data: session place (`location.name/address`,
  usual venue by `isDefault`/id, shown as received), `participantCount`, `capacity`,
  `queuedParticipantCount`, `minParticipants`, `organizer.name`, special flag (reuse the existing
  regular/special rule). `LudoyaShapeError` with field paths. Unit tests.
  - Evidence: `tests/lib/ludoya/normalize.test.ts` 14/14 pass (sessions + plays from fixtures, drafts/cancelled/standalone skipped, regular vs special, place + seat counts, organizer, usual venue by default location id with name as received, locations, user search, `LudoyaShapeError` field paths). Guards moved to `shape.ts`, shared with the legacy normalizer. Gaps: `queuedParticipantCount` and RPG flag are absent from the public API (field is null / `isRpg` optional).
- [x] B2.4 — `fetchMemberWeekSessions()` / `fetchMonthEvents()` with `revalidate: 60`
  (decision 1); covers through `src/lib/game-matching.ts`. `/events` keeps its long cache.
  Unit tests.
  - Evidence: `tests/lib/ludoya/sessions.test.ts` + `tests/lib/member-sessions.test.ts` pass (Madrid-day windows, next-7-days incl. in-progress, month filter, `revalidate: 60` and single sub-events request, `pastLimit` only when the month already started, locations failure tolerated, BGG covers only on name+year match else Ludoya cover, BGG down falls back, errors as `api_error`/`timeout`). Home functions live in `src/lib/member-sessions.ts` (not in `src/lib/ludoya`) to avoid a `ludoya` ↔ `game-matching` import cycle.
- [x] B2.5 — Username checks as server actions: Ludoya `search/users?intent=PLAY` and BGG
  `xmlapi2/user?name=` (existing Bearer token). Result states found / not found / failed; never
  blocking. Unit tests with mocked fetch.
  - Evidence: server actions `checkLudoyaUsername` / `checkBggUsername` in `src/lib/profile/username-checks.ts` (found / not_found / failed, never throw, 20 checks/min per client IP and service); `tests/lib/username-lookup.test.ts`, `tests/lib/rate-limit.test.ts`, `tests/server/actions/username-checks.test.ts` pass. Real BGG shape (probed 2026-09-30): known user = 200 XML `<user id=… name=…>`; unknown name = **404 HTML page** (not a 200 with empty id); both handled, other outcomes = failed. Ludoya search returns partial matches, so found requires an exact case-insensitive username match.
- [x] B2.6 — Migrate existing consumers to the public API: `fetchUpcomingEvents` (`/events`,
  keeps its long cache), `resolveBggIds` + `/events/images`, `scripts/ludoya/check.mjs` and the
  weekly workflow (needs `LUDOYA_API_KEY` as a GitHub secret — user action). Remove the old
  endpoints, old fixtures and group-id env vars (`LUDOYA_GROUP_*`, `LUDOYA_APP_URL` if unused).
  Rewrite `docs/ludoya-api-reference.md` and the CLAUDE.md Ludoya section. Checks: events and
  event-images E2E, `npm run ludoya:check`, visual check of `/events`.
  - Commits: f7da5e5, fa409c2, 0312fdd, e8ac780, 8266bd2, af86956 (B2.1–B2.6). Route: delegated
    (writer trigger). Assess: high → independent verifier: 2 major (private plays leaked into
    `/events`; one null date broke the whole feed) + 10 minor. Correction d8f3145, 45fb678,
    21f2055, 3457d12: per-play visibility, skip null dates/unknown visibility, username input
    guard, global Ludoya cap (30/min/instance), non-retryable bad JSON, time budgets, multi-day
    sessions, `pastLimit` 200 (it counts sub-events, probed), year-gated fuzzy game matches,
    dead code removed. Parent spot check: `npm run test:unit` 249/249, `npx tsc --noEmit` clean.
  - Evidence: `npm run ludoya:check` live: all 5 sections pass (key, 9 locations with one default, 33 events with 6 inline plays, children, user search, 12/12 images); lint/tsc clean, `npm run test:unit` 208/208, `npm run build` ok, Playwright `navigation` + `seo` specs (the only ones touching `/events`) 72/72 pass; `next start` with the live key serves `/events` (200, real sessions) and `/api/events/{id}/image` (200 PNG, `Resolved 4/4 games … bgg-search`). Legacy client/config/normalizer, old fixtures and `LUDOYA_GROUP_*` / `LUDOYA_IMAGE_BASE_URL` removed; `docs/ludoya-api-reference.md` rewritten (gitignored, local only). Pending user action: add the `LUDOYA_API_KEY` GitHub secret for the weekly workflow.

### B3 — Login + magic link (screen 01)

- [x] B3.1 — Route `src/app/auth/magic-link/route.ts`: `verifyOtp({ token_hash, type: 'email' })`,
  keeps session cookies, redirects to a safe same-origin `redirect` or `/profile`; error →
  `/login?magic=error`. Local Supabase magic-link template in `supabase/config.toml` if needed.
  Tests: route unit tests (success, bad token, open-redirect rejected).
  - Commit: 1adc2c4. Route: delegated (writer trigger).
  - Evidence: `tests/server/api/magic-link.test.ts` 13/13 (success + cookies kept, safe redirect, 8 open-redirect variants fall back to `/profile`, missing/wrong type, verify error); live against local Supabase + dev server: OTP email arrives in Mailpit in Catalan with `http://127.0.0.1:3000/auth/magic-link?token_hash=...&type=email`, the route answers 307 to the `redirect` with the `sb-127-auth-token` cookie, a replay of the same link answers 307 to `/login?magic=error`; lint/tsc clean, `npm run test:unit` 221/221. Local Supabase restarted for the new template (`supabase/templates/magic_link.html`, `additional_redirect_urls`). Note: `signInWithOtp({ shouldCreateUser:false })` for an unknown email returns 422 `otp_disabled` (the UI must treat it as neutral, B3.2). The magic-link email does not carry `redirect` (prod template has no `{{ .RedirectTo }}`): after a magic link the member lands on `/profile`.
- [x] B3.2 — Login redesign: two cards, "Envia'm un enllaç d'accés"
  (`signInWithOtp({ shouldCreateUser: false })`), sent state, aria-live errors, mobile single
  column, `AuthHero` copy. Keep `?confirmed=`/`?recovery=` handling. Tests: component + update
  `e2e/auth/login.spec.ts`. Visual comparison.
  - Commit: d81e96a. Route: delegated (writer trigger).
  - Evidence: `tests/components/LoginForm.test.tsx` 11/11; `npx playwright test e2e/auth` 25/25 (incl. new magic-link E2E through local Mailpit: neutral sent state for unknown email, real link signs in and lands on `/profile`, replay goes to `/login?magic=error`, unsafe `redirect` falls back to `/profile`, both buttons disabled while submitting); `e2e/navigation`+`admin`+`seo` 85/86 (the only failure, `locale-routing` "language switcher is visible", fails identically on the base without my changes). lint clean, `npm run test:unit` 249/249, `npm run test:integration` 52/52, `npx tsc --noEmit` only errors in `tests/lib/ludoya/normalize.test.ts` (other writer). Visual comparison at 1280 px (DSF 1) and 390 px (DSF 2): after fixing hero padding, grid width (944 px incl. gutters), input height (48), forgot link hit area and card B line-heights, the only differences left are the real NavBar/Footer render (logo x 28 vs 52, footer lazy animation) and sample data; page height 1340 vs 1347 px. Mobile follows the spec proposal (single column, photo 140 px). Also: new token `brand-orange-light` (#E07A2E), shared `src/lib/safe-redirect.ts` now also guards the password-login `redirect` param (was an open redirect), `AuthHero` paddings enlarged (all auth pages).
- [ ] B3.3 — External check (user): Supabase prod Site URL, redirect allow-list includes
  `/auth/magic-link`, OTP expiry, email rate limits. Recorded, not code.

### B4 — Sign-up + "Revisa el teu correu" (screens 02, 02b)

- [x] B4.1 — Register redesign: hero steps, three fieldsets, aside (below submit on mobile),
  consent box (required unchecked, newsletter optional → `newsletter_accepted`; no acceptance
  timestamp: required consent is implied by the account creation date, decision Q1), presentational
  strength meter (rule stays min 8). Tests: update `e2e/auth/register.spec.ts`,
  `tests/server/actions/signup.test.ts`.
  - Evidence: `RegisterFlow` (hero + steps + form + aside + swap) replaces the page body; `RegisterForm` rewritten (three `FieldsetCard`s, strength meter, consent box, submit row; privacy link now `/privacy`); `AuthHero` gained optional `children`/`headingRef` (login unaffected). Sign-up needs a success screen, so `RegisterDone` (B4.3 code) lands in this commit; B4.2/B4.3 commits add username checks and the done-screen tests. `tests/components/RegisterFlow.test.tsx` 8/8, `npx playwright test e2e/auth` 26/26, lint and `tsc` clean. `signup.test.ts` unchanged (server action untouched). Route: inline (single writer).
- [x] B4.2 — On-blur Ludoya/BGG checks wired to B2.5 (idle/checking/found/not found/failed).
  Component tests.
  - Evidence: `useUsernameCheck` hook (idle/checking/found/not_found/failed; per-value cache, no duplicate call while in flight or for an unchanged value, stale answers discarded, leading `@` stripped) wired on blur to `checkLudoyaUsername`/`checkBggUsername` in `RegisterForm`; `role="status"` lines with icon + text; not_found is a soft warning that never blocks submit, failed is silent. `tests/components/RegisterUsernameChecks.test.tsx` 7/7 with mocked actions; lint and `tsc` clean. Deviation: the found line shows the username as typed, not the account's display name (the actions return only a status; exposing a stranger's name on a public form needs a product/privacy decision).
- [x] B4.3 — 02b state: success swaps to "Revisa el teu correu" (focus h1, submitted email,
  `auth.resend({ type: 'signup' })` with 60 s cooldown, "back to form" keeps values, link to
  `/login`). Tests: component + E2E. Visual comparison desktop + mobile.
  - Evidence: done screen implemented in `RegisterDone` (landed with B4.1 because sign-up needs a success screen): h1 focused after submit, email from state only, resend via `auth.resend({ type: 'signup', email })` (idle/sending/sent with 60 s cooldown/error/rate-limit, `aria-live`), back to form keeps values (form stays mounted, hidden), `/login` link. Tests: `tests/components/RegisterDone.test.tsx` 4/4 (fake timers for the cooldown), `RegisterFlow.test.tsx` (swap, focus, back keeps values), E2E `register.spec.ts` (swap, focused h1, email shown, resend payload, back keeps values; the resend call is stubbed because local Supabase has `enable_confirmations = false`, so no signup email reaches Mailpit). Checks: lint clean, `tsc` clean, `npm run test:unit` 317/317, `npm run test:integration` 52/52, `npx playwright test e2e/auth` 26/26. Visual comparison (1280 DSF1, 390 DSF2 for 02; 1280 for 02b) after fixing legend padding, hero-to-body and card spacing: 02b matches (page 1245 vs 1254 px; hero 4 px shorter, real NavBar/Footer); 02 desktop matches structure, aside width 300, card and row spacing; remaining differences are sample data, the real NavBar/Footer, and on mobile the shared `AuthHero` top padding (`pt-32`, from B3.2), about 30 px taller than the mockup under the fixed NavBar.


### B7 — Profile shell + profile details (screen 04) — runs before B5/B6

- [x] B7.1 — Shared member hero + sub-nav tabs (Inici / Perfil / Carnet) and initials avatar;
  route `/profile/details` with the current data sheet moved there temporarily; `/profile`
  still renders the old view until B6. NavBar `SUBPAGE_THEMES` + menu link. E2E `profile.spec.ts`
  adjusted.
  - Evidence: `MemberHero` (avatar, h1 name, number, "Membre des del" via `formatCalendarDate`) + `MemberTabs` (`nav` with `aria-current="page"`, active tab passed by the page so B5/B6 reuse it) + `MemberAvatar` (initials, `aria-hidden`); `/profile/details` (noindex, `revalidate = false`, breadcrumb JSON-LD) shows the old data sheet under the hero for now; added to `SUBPAGE_THEMES` and `PROTECTED_ROUTES`; the NavBar menu lists no profile sub-pages, so no menu link (the old `/profile` view links to details). `tests/unit/initials.test.ts` + `tests/components/MemberHero.test.tsx` 9/9; `npx playwright test e2e/profile` 24/24 (new `profile-details.spec.ts`, `profile.spec.ts` link test). Route: delegated writer (B7.1 + B7.2 one session).
- [x] B7.2 — Profile details cards: "On jugues" (link/unlink Ludoya and BGG with soft checks
  from B2.5), "Dades de soci" (server-side masked DNI/phone, "Edita" → `/profile/edit`),
  "Comunicacions" (`role=switch`, optimistic toggle with rollback, 44 px hit area),
  "Compte" (change password, download data, existing delete dialog). Server actions + tests.
  Visual comparison.
  - Evidence: `/profile/details` now renders the four cards. Server actions `linkGamingAccount` / `unlinkGamingAccount` / `setNewsletterAccepted` (`src/lib/profile/details-actions.ts`; own row only, same username charset via new `username-pattern.ts`, 0-row RLS result = error, revalidate). DNI/phone decrypted and masked in the server page (`mask.ts`), only masked strings and the tail reach the client; E2E asserts the raw values are absent from the HTML. Change password reuses `resetPasswordForEmail` -> `/auth/callback` -> `/reset-password`. Tests: `tests/lib/profile-mask.test.ts`, `tests/server/actions/details-actions.test.ts`, `tests/components/ProfileDetailsCards.test.tsx` (`npm run test:unit` 361/361, `test:integration` 52/52), lint + tsc clean; `npx playwright test e2e/profile e2e/navigation` 64/65 (only `locale-routing` "language switcher is visible" fails, pre-existing); writes use `editorPage`. Visual comparison 1280 DSF1 vs `04-perfil.png`: avatar, tabs, cards, dl grid, switch (52x44 hit area) match; tiles 175 vs 172 px, page 1870 vs 1835 px (real footer), hero name row 2 px lower; mobile 390 DSF2 single column, no horizontal scroll. Deviations: Ludoya "Veure" link is `app.ludoya.com/<username>` (profile URL not in the public API, unverified); the hero omits the `@ludoya` handle drawn in the screenshot.

### B5 — Card, QR and verify (screen 05 + `/verify/<token>`)

- [x] B5.1 — Add a QR library (server-side SVG/PNG generation, small, maintained); QR encodes
  `https://www.darkstone.cat/verify/<card_token>`. Unit test.
  - Evidence: `uqr` 0.1.3 (unjs, pure JS, zero deps, 79 kB unpacked, released 2026-04; chosen over `qrcode` 1.5.4 (Node/canvas oriented, 135 kB) and `qrcode-generator` (555 kB)) returns a boolean module matrix, so the same data feeds an HTML/SVG card and the Satori PNG; no `optimizePackageImports` entry needed (`sideEffects: false`, tiny). `src/lib/member-card/verify-url.ts` (`buildCardVerifyUrl` via `getLocalizedUrl("ca", ...)`, token pattern) and `qr.ts` (`buildQrMatrix` ECC M, `qrToPath`). `tests/lib/member-card-qr.test.ts` 6/6 incl. a real decode with `jsqr` (dev dependency); lint and tsc clean.
- [x] B5.2 — `composer.tsx` landscape layout matching 5b (logo, SOCI, name, number, member
  since, QR on the right); `/api/members/card` unchanged contract. Tests for the route.
  - Evidence: `composeMemberCard({ fullName, memberNumber, membershipStartDate, cardToken })` renders the 1011x639 landscape face (logo, "SOCI", name, number, "Membre des del" via `formatCalendarDate`, real QR of `buildCardVerifyUrl(card_token)` on a white tile at 236 px); route reads `card_token` + `membership_start_date`, contract unchanged (`?preview=1` inline, else attachment, `no-store`, 401/404). A throwaway render decoded with `jsqr` returned the verify URL. Fonts stay Belleza/IntroBlackAlt (embedded brand fonts; no bold sans available in Satori assets), so type differs slightly from the mockup's sans; no "Núm. de soci" label, number only as in 5b. Old background PNG constant removed. `tests/server/api/members-card.test.ts` 5/5 (401, 404, real PNG 1011x639, headers, preview inline, image depends on token); lint and tsc clean.
- [x] B5.3 — `/profile/card` page: mobile portrait page with centred QR and pinned download,
  keeping the real NavBar (decision Q3); tapping the QR opens a full-screen overlay with a large
  QR on white (accessible dialog: focus trap, Escape and close button, 44 px targets; no
  screen-brightness API). Desktop hero with landscape card + 3 explanatory cards. Update
  `e2e/profile/member-card.spec.ts`. Visual comparison.
  - Evidence: `/profile/card` (noindex, `revalidate = false`): md+ = dark hero (eyebrow, h1, intro, `MemberTabs` with Carnet current, download) + `-rotate-2` 540x340 landscape `CardFace` with the QR at 150 px on a white tile + 3 explanatory cards; <md = real NavBar kept, back link, portrait card with centred QR, note, sticky "Descarrega la imatge", footer hidden (focused mode). Card face is HTML/SVG (`CardFace`, `QrCodeSvg`), the PNG is only for download. `CardQrOverlay` (portal, `role=dialog` `aria-modal`, focus on the 44 px close button and kept there on Tab, Escape/close dismiss, body overflow + Lenis locked, focus returns to the tile, no brightness API). Old `MemberCard` removed, old `profile.card_*` keys replaced by `profile.card.*` in ca/es/en. Tests: `tests/components/CardQrOverlay.test.tsx` 4/4; `e2e/profile/member-card.spec.ts` 10/10 (desktop hero/tabs/real QR/3 cards/download filename/PNG endpoint/401; mobile NavBar kept, overlay focus/Escape/close). Visual comparison (throwaway local user, deleted): 1280 DSF1 vs `05b`: card, tilt, tabs, button and body cards match (hero 28 px taller because the real NavBar is taller, body container 1120 like the screenshot); 390 DSF2 vs `05a`: card, note and pinned button match; differences are the real NavBar (Q3), the real (denser) QR, and the downloaded PNG decodes to the verify URL with `jsqr`. Route: single writer (B5.1-B5.4).
- [x] B5.4 — `/verify/[token]` public page, `noindex`, not in sitemap: "Carnet vàlid · Núm. de
  soci …" or "Carnet no vàlid"; lookup through a narrow security-definer function (no member data
  beyond validity + number). NavBar theme entry. Integration test (valid, unknown, deleted
  member) + E2E.
  - Evidence: migration `20260930120000_verify_card_token.sql` (`verify_card_token(p_token text)` returns `(valid, member_number)`, plpgsql SECURITY DEFINER `search_path=''`, validates `^[0-9a-f]{32}$` before touching the table, EXECUTE revoked from PUBLIC and granted to anon/authenticated); `db:reset` applied. `/verify/[token]` (`force-dynamic`, `robots: noindex, nofollow`, no canonical, ca/es/en `verify` namespace, not in sitemap; `robots.ts` left without `Disallow` so crawlers can read the noindex); `next.config.ts` adds `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow` for `/[locale]/verify/:token` (later rule overrides the global header, confirmed in E2E). NavBar: `getSubpageTheme` with `DYNAMIC_SUBPAGE_PREFIXES = ["/verify/"]`. A backend error throws (error boundary) instead of showing "no vàlid". Tests: `tests/integration/verify-card.test.ts` 14/14 (anon valid, only validity + number, authenticated, unknown, 6 malformed shapes, removed member, regenerated token, anon cannot read members) and `e2e/verify/verify-card.spec.ts` 5/5 (valid without login, no name/email in page, headers, meta robots, unknown, malformed, es/en, sitemap). Screenshots checked at 1280 and 390 (dark NavBar theme OK).

### B6 — La meva zona (screen 03)

- [ ] B6.1 — `/profile` becomes the home: hero (greeting, number, since-date, tabs, mini card),
  "Completa el perfil" checklist (reads `email_confirmed_at`; hidden at 4/4), badges grid /
  mobile carousel from B1.3. Tests.
- [ ] B6.2 — "Properes sessions": expandable per-session list (place per session, covers,
  counts, seat dots only desktop and capacity ≤ 8, max 5 plays, "Especial" chip, join/queue
  links to Ludoya), loading skeleton, empty, and Ludoya-down states. Mobile cards. Tests.
  Carry-over from the B2 correction: `fetchMemberWeekSessions` requests no past events, so a
  multi-day event that started before today may be missing if Ludoya moves it to `pastEvents`;
  probe once and add a small `pastLimit` if needed.
- [ ] B6.3 — Month calendar: desktop sheet with pills, mobile 44 px grid + selected-day panel,
  Monday-first, prev/next month, out-of-month days `aria-hidden`. Tests.
- [ ] B6.4 — Visual comparison of the four home screenshots; E2E for the home.

### B8 — Close

- [ ] B8.1 — Docs: CLAUDE.md (Pages table, components, env vars, namespaces, Ludoya section),
  README.md pages table; Lighthouse config only for indexable pages (none new).
- [ ] B8.2 — Full `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint`; record results.

## Acceptance criteria

- Every phase-1 screen matches its screenshots at 1280 px and 390 px except sample data.
- Magic-link login works end to end locally; `/auth/confirm` behaviour unchanged.
- The card PNG and the page show a real QR that resolves to `/verify/<token>`; unknown tokens show
  "Carnet no vàlid"; no member data beyond validity + number is exposed.
- Home sessions data refreshes within 60 s; public `/events` cache unchanged.
- No sample data, no `no-reply@` in UI, all copy in three locales, lint/types/tests green.

## Decisions (2026-09-30)

- Q1 No consent timestamps: the conduct and privacy checkboxes are required, so acceptance equals
  the account creation date.
- Q2 "Membre des del" and "Membre {year}" come from `members.membership_start_date`
  (`NOT NULL DEFAULT CURRENT_DATE`, so always present).
- Q3 The mobile card page keeps the real NavBar; tapping the QR shows it full screen above
  everything, like other wallet/ticket apps.
- Q4 Every Ludoya use moves to the public API; the old undocumented client is removed (B2.6).

## Progress

- 2026-09-30: plan created, no code written. Open questions Q1–Q4 decided. Next: B1.1.
- 2026-09-30: autonomous run (orchestrator + delegated writers, RDD globally off → `review assess`
  per block, independent verifier on high risk).
  - B1 done: f42cf94, 8dfd8b6, 216b455; verifier (high) → 1 major (member could backdate
    `membership_start_date`) + 3 minor, fixed in 081c0b2, 055cd9a. Spot check: integration 52/52.
  - B2 done (see B2.6). Decision: event images match BGG by name + year (public API has no bggId).
  - B3.1/B3.2 done: 1adc2c4, d81e96a; assess high → verifier: 1 major (open redirect after
    password login via dot segments, e.g. `/.//evil.com`) + minor (429 revealed membership,
    magic link lost `redirect`/locale, focus lost). Fixed in 97484ef (validate after URL parsing,
    neutral 429, `magic_redirect` cookie on `/auth`, focus to `#email`, scanner limitation
    documented). Spot check: safe-redirect + magic-link tests 53/53. B3.3 is a user action.
  - B4 done: 52181c2, 71b10e2, 22bc816 (writer). Orchestrator decision: the username check
    shows the username only, never the Ludoya/BGG display name (public form, avoids exposing
    third-party names). Local Supabase has `enable_confirmations = false`, so the resend E2E
    stubs `/auth/v1/resend`. Assess high → verifier: 1 major (privacy consent linked to the
    website policy instead of `/data-protection`, which governs member data; the mockup spec was
    wrong) + pre-existing major IDOR (`updateMemberAfterSignup` trusted a client `userId` with
    the admin client) + minor (hidden live regions, Ludoya focus ring, first sign-up left behind
    on "back", DNI error text, stuck submitting). Fixed in 707016b (guard: unconfirmed user
    < 10 min with blank row, server-side field validation, `discardUnconfirmedSignup`) and
    e527489. Checks: unit 388/388, integration 55/55, `e2e/auth` 26/26.
  - B7 done: 21b52d9, 196745d (writer). Assess high → verifier: no blockers, 6 minor (a11y live
    regions, focus after link/unlink, disabled focused buttons, input focus ring, decrypt
    failure shown as "No indicat", invalid username message). "Veure a Ludoya" link pattern
    `app.ludoya.com/<username>` unverified (SPA returns 200 for any path) → check in a browser
    in B8.
  - Pre-existing bug found: `members.id` FK to `auth.users` has no `ON DELETE CASCADE`, so
    `deleteAccount` likely fails. Correction round running: B7 minors + FK cascade migration +
    local `enable_confirmations = true` to mirror production.
- Pending user actions: `LUDOYA_API_KEY` GitHub secret; B3.3 production Supabase checks.

## Notes

- Public API shapes seen in B2.1 (production, 2026-09-30):
  - `GET /events?includeSubEvents=true` returns children in the same list (`parentId`), so the
    home and `/events` need one call, not one per event. The list has no `childEventCounts`.
    `draft: true` events are included (skip them). Standalone `PLANNED_PLAY` (no `parentId`,
    e.g. an RPG table with a `master`) also appears.
  - Event location is embedded, but its `isDefault` is always false there; the usual venue must
    come from `GET /locations` (`isDefault`) matched by id.
  - Missing from the public API: `queuedParticipantCount` (no waiting-list count), `game.type`
    (no RPG flag), BGG id, `childEventCounts`. Organizer is `master`/`teacher` (optional).
  - `search/users` returns `{users:{elements:[{id,username,name,avatarUrl}]}}`; no match is a
    200 with an empty `elements`.

- Route per task is declared when the task starts; B2, B4, B6 and B7.2 each touch 2+ non-trivial
  files and will use one delegated writer.
- Risk for B2.6: the public API may not expose the Ludoya → BGG id bridge used by event images.
  B2.1 checks it before any removal.
