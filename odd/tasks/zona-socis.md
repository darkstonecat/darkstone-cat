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

- [ ] B1.1 — Migration: `members.card_token` (random, unique, not null, backfilled for existing
  rows, default for new rows) + `regenerate_card_token(member)` admin-only function; RLS keeps
  the token readable by its owner and admins only. Types in `src/lib/supabase/auth.ts`.
  Tests: `tests/integration/triggers`/`rls` cases (new member gets a token, member cannot read
  another's token, member cannot change own token). Route: inline candidate (one migration +
  types), delegate if RLS work grows.
- [ ] B1.2 — Migration: `member_badges` (member id, badge key, awarded_at, unique pair), RLS
  select-own + admin all, no member writes; badge keys as a check constraint
  (`volunteer_egara_joga`, `ludoteca_donor`). "Membre {year}" is derived, not stored
  (decision 3; year from `membership_start_date`, decision Q2). Tests: RLS integration.
- [ ] B1.3 — Server helper `getMemberBadges()` + derived "Membre {year}". Unit test.

### B2 — Ludoya public API adapter (replaces the old client, decision Q4)

- [ ] B2.1 — Probe: fetch `GET /public/v1/openapi.json`, record response shapes for `events`
  (with `includeSubEvents`), `events/{id}/children`, `locations`, `search/users`,
  `search/boardgames`; save sanitized fixtures under `public/mock/ludoya/`. No personal data in
  fixtures. **Gate for B2.6**: find the public-API replacement for the BGG-id bridge
  (`GET /boardgames/{slug}` in `resolveBggIds`); if none exists, stop and ask before B2.6.
- [ ] B2.2 — Public client in `src/lib/ludoya/client.ts`: `LUDOYA_API_KEY` env, `X-Api-Key`
  header, typed error codes (`rate_limited` → honour `Retry-After`), mock mode `LUDOYA_MOCK`,
  per-call `revalidate`. Server-only module guard. The organisation is implied by the key, so
  group-id config and rediscovery go away. Unit tests with fixtures.
- [ ] B2.3 — Normalize + types for member-area data: session place (`location.name/address`,
  usual venue by `isDefault`/id, shown as received), `participantCount`, `capacity`,
  `queuedParticipantCount`, `minParticipants`, `organizer.name`, special flag (reuse the existing
  regular/special rule). `LudoyaShapeError` with field paths. Unit tests.
- [ ] B2.4 — `fetchMemberWeekSessions()` / `fetchMonthEvents()` with `revalidate: 60`
  (decision 1); covers through `src/lib/game-matching.ts`. `/events` keeps its long cache.
  Unit tests.
- [ ] B2.5 — Username checks as server actions: Ludoya `search/users?intent=PLAY` and BGG
  `xmlapi2/user?name=` (existing Bearer token). Result states found / not found / failed; never
  blocking. Unit tests with mocked fetch.
- [ ] B2.6 — Migrate existing consumers to the public API: `fetchUpcomingEvents` (`/events`,
  keeps its long cache), `resolveBggIds` + `/events/images`, `scripts/ludoya/check.mjs` and the
  weekly workflow (needs `LUDOYA_API_KEY` as a GitHub secret — user action). Remove the old
  endpoints, old fixtures and group-id env vars (`LUDOYA_GROUP_*`, `LUDOYA_APP_URL` if unused).
  Rewrite `docs/ludoya-api-reference.md` and the CLAUDE.md Ludoya section. Checks: events and
  event-images E2E, `npm run ludoya:check`, visual check of `/events`.

### B3 — Login + magic link (screen 01)

- [ ] B3.1 — Route `src/app/auth/magic-link/route.ts`: `verifyOtp({ token_hash, type: 'email' })`,
  keeps session cookies, redirects to a safe same-origin `redirect` or `/profile`; error →
  `/login?magic=error`. Local Supabase magic-link template in `supabase/config.toml` if needed.
  Tests: route unit tests (success, bad token, open-redirect rejected).
- [ ] B3.2 — Login redesign: two cards, "Envia'm un enllaç d'accés"
  (`signInWithOtp({ shouldCreateUser: false })`), sent state, aria-live errors, mobile single
  column, `AuthHero` copy. Keep `?confirmed=`/`?recovery=` handling. Tests: component + update
  `e2e/auth/login.spec.ts`. Visual comparison.
- [ ] B3.3 — External check (user): Supabase prod Site URL, redirect allow-list includes
  `/auth/magic-link`, OTP expiry, email rate limits. Recorded, not code.

### B4 — Sign-up + "Revisa el teu correu" (screens 02, 02b)

- [ ] B4.1 — Register redesign: hero steps, three fieldsets, aside (below submit on mobile),
  consent box (required unchecked, newsletter optional → `newsletter_accepted`; no acceptance
  timestamp: required consent is implied by the account creation date, decision Q1), presentational
  strength meter (rule stays min 8). Tests: update `e2e/auth/register.spec.ts`,
  `tests/server/actions/signup.test.ts`.
- [ ] B4.2 — On-blur Ludoya/BGG checks wired to B2.5 (idle/checking/found/not found/failed).
  Component tests.
- [ ] B4.3 — 02b state: success swaps to "Revisa el teu correu" (focus h1, submitted email,
  `auth.resend({ type: 'signup' })` with 60 s cooldown, "back to form" keeps values, link to
  `/login`). Tests: component + E2E. Visual comparison desktop + mobile.

### B7 — Profile shell + profile details (screen 04) — runs before B5/B6

- [ ] B7.1 — Shared member hero + sub-nav tabs (Inici / Perfil / Carnet) and initials avatar;
  route `/profile/details` with the current data sheet moved there temporarily; `/profile`
  still renders the old view until B6. NavBar `SUBPAGE_THEMES` + menu link. E2E `profile.spec.ts`
  adjusted.
- [ ] B7.2 — Profile details cards: "On jugues" (link/unlink Ludoya and BGG with soft checks
  from B2.5), "Dades de soci" (server-side masked DNI/phone, "Edita" → `/profile/edit`),
  "Comunicacions" (`role=switch`, optimistic toggle with rollback, 44 px hit area),
  "Compte" (change password, download data, existing delete dialog). Server actions + tests.
  Visual comparison.

### B5 — Card, QR and verify (screen 05 + `/verify/<token>`)

- [ ] B5.1 — Add a QR library (server-side SVG/PNG generation, small, maintained); QR encodes
  `https://www.darkstone.cat/verify/<card_token>`. Unit test.
- [ ] B5.2 — `composer.tsx` landscape layout matching 5b (logo, SOCI, name, number, member
  since, QR on the right); `/api/members/card` unchanged contract. Tests for the route.
- [ ] B5.3 — `/profile/card` page: mobile portrait page with centred QR and pinned download,
  keeping the real NavBar (decision Q3); tapping the QR opens a full-screen overlay with a large
  QR on white (accessible dialog: focus trap, Escape and close button, 44 px targets; no
  screen-brightness API). Desktop hero with landscape card + 3 explanatory cards. Update
  `e2e/profile/member-card.spec.ts`. Visual comparison.
- [ ] B5.4 — `/verify/[token]` public page, `noindex`, not in sitemap: "Carnet vàlid · Núm. de
  soci …" or "Carnet no vàlid"; lookup through a narrow security-definer function (no member data
  beyond validity + number). NavBar theme entry. Integration test (valid, unknown, deleted
  member) + E2E.

### B6 — La meva zona (screen 03)

- [ ] B6.1 — `/profile` becomes the home: hero (greeting, number, since-date, tabs, mini card),
  "Completa el perfil" checklist (reads `email_confirmed_at`; hidden at 4/4), badges grid /
  mobile carousel from B1.3. Tests.
- [ ] B6.2 — "Properes sessions": expandable per-session list (place per session, covers,
  counts, seat dots only desktop and capacity ≤ 8, max 5 plays, "Especial" chip, join/queue
  links to Ludoya), loading skeleton, empty, and Ludoya-down states. Mobile cards. Tests.
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

## Notes

- Route per task is declared when the task starts; B2, B4, B6 and B7.2 each touch 2+ non-trivial
  files and will use one delegated writer.
- Risk for B2.6: the public API may not expose the Ludoya → BGG id bridge used by event images.
  B2.1 checks it before any removal.
