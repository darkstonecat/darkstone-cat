# Security audit: contact form, auth and member data

## Objective

Audit the contact form, sign-up/login/recovery flows and everything that handles member data, then fix what is worth fixing on `develop-users` (non-production branch) and report every finding with its decision.

## Problem

The site now has open web sign-up, member data (encrypted DNI/phone), an admin CSV export and a public contact form that sends mail through the Workspace SMTP account. None of it had a dedicated security review.

## Why

User request (2026-10-01): audit vulnerabilities with focus on the contact form and user management, plan the audit, decide autonomously what to fix. Refactoring is allowed on this branch.

## Scope

- Contact form: `src/app/api/contact/route.ts`, `src/components/contact/ContactForm.tsx`.
- Auth: `src/proxy.ts`, `src/app/auth/*`, `src/components/auth/*`, `src/lib/supabase/*`, `src/lib/profile/*`, `supabase/config.toml`.
- Data and privileged APIs: `supabase/migrations/*`, `src/lib/encryption.ts`, `src/app/api/**`, admin pages, `next.config.ts` headers.

Out of scope: nonce-based CSP (removing `unsafe-inline`), CAPTCHA integration, applying migrations to the production Supabase project (needs explicit user authorization).

## Constraints

- All user-facing text in `ca`, `es`, `en`.
- Migrations must be safe on the production data (165 legacy members): use `NOT VALID` for new CHECK constraints, length-only checks.
- Fail-safe rate limiting: a Supabase outage must not take down the contact form (fall back to the in-memory limiter).
- No IP stored in clear: hash with a server secret, delete after the window (GDPR).
- Next 16: read `node_modules/next/dist/docs/` before relying on server action / headers semantics.

## Configuration

- **TDD**: off (source: no project/session TDD configuration; same as previous ODD documents). Runners: Vitest (`npm run test:unit`, `npm run test:integration`), Playwright (`npm run test:e2e`).
- **Delivery strategy**: `exception-ok`. Forecast ~900 authored changed lines, over the 400-line budget. Rationale: `develop-users` is the non-production integration branch; work-unit commits land there and the user decides the merge to `main`. No PR is opened by this feature.
- **RDD**: off (decided by global), so no native review; ordinary checks per task.

## Audit plan

1. Analysis: three read-only auditors in parallel (C contact form, A auth flows, D data layer and privileged APIs).
2. Triage: verify the main findings in code, decide fix / accept / ops per finding.
3. Fix task by task with tests, one work-unit commit per task.
4. Report: findings, severity, decision, evidence; ops checklist for the user.

## Findings and decisions

No Critical or High findings. `npm audit --omit=dev`: 0 vulnerabilities.

| ID | Finding | Severity | Decision |
|---|---|---|---|
| C-1 | Contact rate limit is in-memory per serverless instance, no global cap | Medium | Fix (T2): shared limiter in Supabase + global daily cap |
| C-2 | No honeypot/captcha; Origin check does not stop scripts | Medium | Fix (T1): honeypot + minimum fill time. CAPTCHA: ops option |
| C-3 | No length or body-size limits | Low-Medium | Fix (T1) |
| C-4 | Rate slot consumed before validation; `unknown` shared bucket; `x-forwarded-for` | Low | Fix (T1) |
| C-5 | Invalid JSON returns 500; SMTP timeout timer never cleared | Low | Fix (T1) |
| C-6 | `localhost:3000` allowed in production | Info | Fix (T1) |
| C-7 | Reply-To is unverified | Info | Accept (inherent to contact forms) |
| C-8 | Full SMTP error object logged | Info | Fix (T1) |
| C-9 / A-11 | CSP `unsafe-inline` + `unsafe-eval` | Low | Partial (T4): `unsafe-eval` dev-only if a production build shows no violations. Nonce CSP: accept for now |
| A-1 | Sign-up done screen may reveal an existing email | Medium (verify) | Verified locally; fixed (T5): identical done screen. Direct GoTrue API calls stay distinguishable (platform behaviour) |
| A-2 | Sign-out only deletes cookies, the session is not revoked | Medium | Fix (T5): server-side `signOut` |
| A-3 | Service-role sign-up actions callable without session | Low-Medium | Accept: needs the victim's UUID, 10/30 min window, blank row only |
| A-4 | Pre-account hijack (unconfirmed sign-up + magic link) | Low (verify) | Confirmed locally; magic-link path mitigated (T5). Sign-up path (iv): Fixed (T5b), last sign-up wins for unconfirmed accounts; accepted residual: a pending, unconfirmed sign-up can be cancelled by someone re-registering the same email (they get a fresh link), and an attacker who signs up AFTER the victim and BEFORE the victim confirms still produces a confirmation mail with the attacker's password (window of minutes) |
| A-5 | Profile edit action weakly validated, leaks raw DB errors | Low | Fix (T3) |
| A-6 / D-1 | CSV formula injection in the admin export | Medium | Fix (T3) |
| A-7 | Password min 6 server-side, no secure password change | Low | Fix local `config.toml` (T5); production: ops |
| A-8 | Username-check throttle is per instance | Low | Fix (T2): shared limiter |
| A-9 / D-3 | Public uncached image routes; `test-image` live in production | Low | Fix (T4) |
| A-10 | Auth callbacks accept any OTP `type` | Info | Fix (T5) |
| D-2 | No length limits in the DB for member text columns | Low | Fix (T3): `NOT VALID` length CHECKs |
| D-4 | Admin export has no audit trail | Low | Fix (T3): structured log line |
| D-5 | `generate_member_number()` executable by anon, no `search_path` | Low (verify) | Verify + fix (T3) |
| D-6 | `server-only` missing in `admin.ts` and `encryption.ts` | Low | Fix (T4) |
| D-7 | Encryption key/format validation not strict | Low | Fix (T4) |
| D-8 | Sensitive pages have no explicit `Cache-Control` | Info (verify) | Verify on a production build (T4) |
| D-9 | `/verify` shows the member number | Info | Accept (by design) |
| D-10 | Production schema not verifiable from the repo | Info | Ops: user runs the policy query |

## Tasks

- [x] **T1 Contact form input hardening** (C-2, C-3, C-4, C-5, C-6, C-8). Route: delegated (writer, 2+ non-trivial files).
- [x] **T2 Shared rate limiter** (C-1, A-8): Supabase table + SECURITY DEFINER function, hashed keys, in-memory fallback; used by the contact route (per IP + global daily cap) and the username checks. Route: delegated.
- [x] **T3 Member data validation and export** (A-5, D-1/A-6, D-2, D-4, D-5). Route: delegated.
- [x] **T4 Platform hardening** (D-3/A-9, D-6, D-7, D-8, C-9 partial). Route: delegated.
- [x] **T5 Auth hardening** (A-1, A-2, A-4, A-7 local, A-10). Route: delegated.
- [x] **T5b Last sign-up wins for unconfirmed accounts** (A-4 iv), commit e685921. Route: delegated (single writer).
- [x] **T6 Docs and report**: CLAUDE.md updated per task by the writers (README not affected); ops checklist below; final report given to the user. Route: inline.

## Acceptance criteria

- Every finding has a recorded decision; every "Fix" has a test or an observed check.
- `npm run lint`, `npm run test:unit`, `npm run test:integration` and `npm run build` pass; E2E specs for touched flows pass.

## Ops checklist (user)

Order matters: apply the migrations BEFORE pushing or deploying `develop-users`. Without `is_email_confirmed` the magic-link request fails closed (the form shows an error); without the others the code degrades safely (in-memory rate limit, `prepareSignup` skipped).

1. [x] **Apply to the production Supabase project** (done 2026-10-01 by the user with `supabase db push` via the session pooler; anonymous PostgREST probes then returned 42501 for `generate_member_number`, `is_email_confirmed`, `unconfirmed_user_id`, `rate_limit_hit` and the `rate_limit_hits` table) (`httvpxakxaycqbagybym`), in order: `20261001100000_shared_rate_limiter.sql`, `20261001110000_member_data_hardening.sql`, `20261001120000_is_email_confirmed.sql`, `20261001130000_unconfirmed_user_id.sql`. Then test sign-up (member number assigned), magic link and the contact form on the preview.
2. **Supabase dashboard, Auth**: minimum password length 8; enable "Secure password change"; check that the Confirm signup template sends `type=email` or `type=signup` (and links to `/auth/confirm`) and Reset password sends `type=recovery` (links to `/auth/callback`), otherwise A-10's whitelist rejects them; Site URL `https://www.darkstone.cat` and redirect allow-list limited to the production `/auth/*` URLs; optionally lower the email OTP/magic-link expiry from 3600 s to 900-1800 s.
3. **Supabase SQL editor (D-10)**: run `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public';` and compare with the migrations.
4. **Vercel Firewall (optional)**: a rate-limit rule on `POST /api/contact` (e.g. 10/min per IP) as a cheap extra layer.
5. **Future option**: CAPTCHA (Cloudflare Turnstile) on sign-up/login/contact if abuse appears; needs code changes and a privacy note.
6. Never set `CONTACT_ALLOW_LOCALHOST` in Vercel.

## Progress

- 2026-10-01: audit done (3 auditors), triage recorded above.
- 2026-10-01: T1 done, commit 18f0c3e. Checks: `npm run lint` clean, `npx tsc --noEmit` clean, `npm run test:unit` 568 passed, `npm run test:integration` 70 passed, `e2e/forms/contact.spec.ts` 10 passed. Deviation: drop responses use `{ success: true }` (the real success shape) instead of `{ ok: true }` so bots cannot tell them apart.
- 2026-10-01: T2 done, commit 8bb0174. Migration `20261001100000_shared_rate_limiter.sql` applied locally (`supabase migration up`, then verified from scratch with `npm run db:reset`); NOT applied to production. Checks: lint clean, `tsc --noEmit` clean, `test:unit` 583 passed, `test:integration` 82 passed (12 new), contact e2e spec 10 passed.
- 2026-10-01: T3 done, commit 112a95c. Migration `20261001110000_member_data_hardening.sql` applied locally only (`supabase migration up`); NOT applied to production. D-5 verified before the fix: anon `POST /rest/v1/rpc/generate_member_number` returned `"000-034"` (callable, burns a sequence value); after: `42501 permission denied`. Grants kept for postgres (trigger path) and service_role. Checks: lint clean, `tsc --noEmit` clean, `test:unit` 606 passed, `test:integration` 93 passed (11 new), e2e `profile-edit` (+1 new) and `admin/members-list` passed.
- 2026-10-01: T4 done, commit 96a39dd. D-3/A-9: the event image route is only called by the admin tool `/events/images`, so it now requires admin (401/403, `no-store`); `test-image` is a 404 in production. C-9: `unsafe-eval` removed from production `script-src`; verified on `npm run build` + `next start -p 3200` with Chromium on `/`, `/ludoteca`, `/contact`, `/events`, `/login`, `/about`, `/faq`: 0 CSP violations or eval messages (only the expected local 404s of the Vercel analytics scripts). D-8: all `[locale]` pages are dynamic (ƒ) and Next sends `private, no-cache, no-store, max-age=0, must-revalidate`; unauthenticated `/profile`, `/admin`, `/events/images` answer a 307 to `/login` with no Cache-Control (not cacheable); no header added. Checks: lint clean, `tsc --noEmit` clean, `test:unit` 621 passed, `test:integration` 93 passed, `npm run build` OK, e2e `admin/` + `profile/` 52 passed (incl. new `event-image-api.spec.ts`).
- 2026-10-01: T5 done, commits 1edf83c (A-2, A-10, A-7, A-1) and 80d4228 (A-4). Migration `20261001120000_is_email_confirmed.sql` applied locally only (`supabase migration up`); NOT applied to production.
  - **A-2**: `signOutCurrentSession` server action (`src/lib/supabase/session-actions.ts`, SSR client, `signOut({ scope: "local" })`); NavBar awaits it up to 3 s, then the old cookie wipe + hard redirect. Integration test: after the action the old refresh token cannot be refreshed while a second session of the same user still can. E2E `e2e/auth/logout.spec.ts`: after clicking "Tancar sessió" the old refresh token gets HTTP 400 from GoTrue. `DeleteAccountDialog` keeps its browser `signOut()` on purpose: the account (and every session) is already deleted.
  - **A-10**: `/auth/callback` accepts only `recovery`; `/auth/confirm` accepts `signup`, `email`, `email_change`. Only `magic_link` has a local template (`type=email` to `/auth/magic-link`); the confirm/recovery templates live in the production dashboard and are not in the repo, so the whitelist covers both documented spellings for sign-up. Ops: check the production Confirm signup template sends `type=email` or `signup`, and Reset password sends `type=recovery`.
  - **A-7**: `minimum_password_length = 8` locally (no client place accepts 6: register and reset forms enforce 8). `secure_password_change = true` kept: verified against local GoTrue (container env `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION=true`) that a recovery session (`generateLink` + `verifyOtp` + `updateUser({ password })`) still changes the password, a fresh logged-in session too, and a 6-char password is rejected ("at least 8 characters"). In-app password change goes through the recovery email anyway. Production: dashboard settings (ops).
  - **A-1 observation** (local GoTrue, confirmations on): `signUp` for a new email returns the user (`identities: 1`, no session) and sends one mail; for an already CONFIRMED email it returns the error `User already registered` (so the form showed "email in use": distinguishable) and sends no mail; for an UNCONFIRMED existing email it returns the real existing user id and resends the mail, and `updateMemberAfterSignup` then refuses (row not blank), which showed the "details not saved" notice (distinguishable). `auth.resend` for confirmed and unknown emails both return no error. Fix: the "already registered" error now ends on the same done screen (no member update, nothing to discard), the notice is removed (keys `register_error_email_in_use` and `register_done_profile_notice` deleted from ca/es/en), and `updateMemberAfterSignup` logs `[signup] member details not saved reason=<code>` server-side. The `/profile` "Completa el perfil" checklist already prompts for DNI, phone and postal code. Residual: anyone can still call the GoTrue API directly with the public key and see the raw error; a client-side fix cannot hide that.
  - **A-4 observations** (local, Mailpit): (i) YES: `signInWithOtp({ shouldCreateUser: false })` for an unconfirmed user sends a "Confirm your email address" mail (type `signup`, GoTrue verify link), not a magic link; (ii) YES: following it confirms the email and signs the follower in; (iii) YES: before the link the attacker's `signInWithPassword` fails ("Email not confirmed"), after it succeeds with the attacker's password; (iv) NO replacement: the victim re-signing up with their own password keeps the same user id and the ATTACKER's password; after confirming, only the attacker's password works (the victim's fails), so the sign-up path has the same exposure; (v) forgot password on the unconfirmed account sends a `recovery` link; following it confirms the email and gives a recovery session, so the victim can set their own password there (this is the recovery path of the victim). Decision: (iii) was YES, so the magic-link path is mitigated: server action `requestMagicLink` + `public.is_email_confirmed(p_email)` (SECURITY DEFINER, `search_path=''`, service_role only), uniform answer, shared rate limit (10 per IP and 3 per address per 10 min). Open: (iv) is not covered (needs a sign-up server action that replaces a stale unconfirmed user for the same email, or a platform setting); accepted as Low: requires the attacker to pre-register a specific email before the victim joins, and the victim's failing login leads them to password reset.
  - Checks: `npm run lint` clean, `npx tsc --noEmit` clean, `npm run test:unit` 663 passed, `npm run test:integration` 100 passed, e2e `e2e/auth` + `e2e/profile` + `e2e/navigation` passed except the pre-existing `locale-routing` "language switcher is visible". Local Supabase restarted once (`npx supabase stop && start`, data kept) to load the `config.toml` change.
- 2026-10-01: T5b done, commit e685921. Migration `20261001130000_unconfirmed_user_id.sql` applied locally only (`supabase migration up`); NOT applied to production (apply it before deploying: until then `prepareSignup` logs a lookup failure and sign-up proceeds as before). `prepareSignup(email)` (`src/lib/supabase/actions.ts`) runs from `RegisterForm` right before `signUp`, asks `public.unconfirmed_user_id` and deletes the stale unconfirmed user (`members` cascades via `members_id_fkey ON DELETE CASCADE`). Deviation: throttled per IP only (10 per 10 min), no per-address limit, because an attacker could burn the victim's per-address bucket (3 calls) and then pre-register, so the victim's prepare would be skipped. Always `{ ok: true }`, never blocks sign-up, logs one line without the address. Accepted residual: see A-4. Checks: integration test (attacker unconfirmed sign-up, prepare, victim sign-up, link from Mailpit: attacker password fails, victim password works; confirmed user never deleted; anon/authenticated get 42501); unit tests (neutral answer, IP limit, lookup/delete failure); e2e `signing up over an unconfirmed pre-registration` FAILS with the `prepareSignup` call removed and passes with it. `npm run lint` clean, `npx tsc --noEmit` clean, `npm run test:unit` 680 passed, `npm run test:integration` 105 passed, `npx playwright test e2e/auth` 29 passed.
- 2026-10-01: T6 closed. Whole-branch checks after all commits: `npm run lint` clean, `npm run test:unit` 680 passed, `npm run build` OK (integration 105 passed and `e2e/auth` 29 passed in T5b). Parent fix 43ebbb0: a missing `elapsedMs` is accepted (a tab opened before the deploy must not lose its message silently).
- 2026-10-01: the 4 migrations applied to production Supabase `httvpxakxaycqbagybym`; anonymous grants verified (all 42501). Pending: sign-up, magic link and contact form smoke test on the preview after push; dashboard Auth settings; D-10 policy query.
