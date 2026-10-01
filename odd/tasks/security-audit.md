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
| A-1 | Sign-up done screen may reveal an existing email | Medium (verify) | Verify + fix (T5): identical done screen |
| A-2 | Sign-out only deletes cookies, the session is not revoked | Medium | Fix (T5): server-side `signOut` |
| A-3 | Service-role sign-up actions callable without session | Low-Medium | Accept: needs the victim's UUID, 10/30 min window, blank row only |
| A-4 | Pre-account hijack (unconfirmed sign-up + magic link) | Low (verify) | Verify locally (T5); mitigate if small, otherwise document |
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
- [ ] **T3 Member data validation and export** (A-5, D-1/A-6, D-2, D-4, D-5). Route: delegated.
- [ ] **T4 Platform hardening** (D-3/A-9, D-6, D-7, D-8, C-9 partial). Route: delegated.
- [ ] **T5 Auth hardening** (A-1, A-2, A-4, A-7 local, A-10). Route: delegated.
- [ ] **T6 Docs and report**: CLAUDE.md, README if affected, final report and ops checklist. Route: inline.

## Acceptance criteria

- Every finding has a recorded decision; every "Fix" has a test or an observed check.
- `npm run lint`, `npm run test:unit`, `npm run test:integration` and `npm run build` pass; E2E specs for touched flows pass.

## Ops checklist (user)

To be completed in T6.

## Progress

- 2026-10-01: audit done (3 auditors), triage recorded above.
- 2026-10-01: T1 done, commit 18f0c3e. Checks: `npm run lint` clean, `npx tsc --noEmit` clean, `npm run test:unit` 568 passed, `npm run test:integration` 70 passed, `e2e/forms/contact.spec.ts` 10 passed. Deviation: drop responses use `{ success: true }` (the real success shape) instead of `{ ok: true }` so bots cannot tell them apart.
- 2026-10-01: T2 done, commit 8bb0174. Migration `20261001100000_shared_rate_limiter.sql` applied locally (`supabase migration up`, then verified from scratch with `npm run db:reset`); NOT applied to production. Checks: lint clean, `tsc --noEmit` clean, `test:unit` 583 passed, `test:integration` 82 passed (12 new), contact e2e spec 10 passed.
