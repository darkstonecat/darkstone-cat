# Contact form via Google Workspace SMTP

## Objective

Send contact form messages through the association's Google Workspace
(`no-reply@darkstone.cat`) instead of Resend, and deliver them to
`hola@darkstone.cat`.

## Problem / why

- The form sends from `onboarding@resend.dev`, Resend's sandbox sender: it only
  delivers to the Resend account owner and has poor deliverability.
- The association now has Google Workspace nonprofit with `darkstone.cat`
  authenticated (MX, SPF, DKIM, DMARC verified 2026-09-29). Supabase Auth already
  sends through `smtp.gmail.com` as `no-reply@darkstone.cat`.
- One mail provider instead of two; Workspace limit (~2,000/day) far above
  Resend free (100/day).

## Scope

- `src/app/api/contact/route.ts`: Resend -> nodemailer over `smtp.gmail.com:465`,
  from `no-reply@darkstone.cat`, to `hola@darkstone.cat`, `replyTo` = sender.
  Keep CSRF, rate limit, validation, 15 s timeout and error contract
  (`send_failed`, `server_error`).
- Env: `SMTP_USER`, `SMTP_PASSWORD` (Workspace app password) replace
  `RESEND_API_KEY`.
- Deps: remove `resend`, add `nodemailer` + `@types/nodemailer`.
- Docs: CLAUDE.md, README.md.
- develop-users: update `tests/server/api/contact.test.ts` mocks and
  `playwright.config.ts` env after merging main.

Public contact address: the user approved replacing the old Gmail address with
`hola@darkstone.cat` everywhere it is shown (footer, contact info, collaborators,
legal texts, JSON-LD).

## Constraints

- Ship on `main` first (branch `fix/contact-form-workspace-smtp`); main has no
  test suite, tests live on `develop-users`.
- `SMTP_USER` and `SMTP_PASSWORD` must exist in Vercel **before** deploying, or
  the form returns 500.
- `hola@darkstone.cat` must exist in Workspace (user, group or alias).

## TDD

Mode: off (source: no project/session TDD configuration). Ordinary checks:
`npm run lint`, `npx tsc --noEmit`, `npm run build` on main; `npm run test:unit`
on develop-users.

## Tasks

- [x] T1 (main, inline: one non-trivial file + mechanical docs/deps) — Switch
  route to nodemailer SMTP, swap deps, update docs. Checks: lint, tsc, build.
- [x] T1b (main, inline: mechanical replace) — Public contact address ->
  `hola@darkstone.cat` in 4 components + 3 locale files. Checks: eslint src,
  tsc, JSON parse, build.
- [x] T2 (develop-users) — Merge main, rewrite contact test mocks for
  nodemailer, update Playwright env. Checks: test:unit, lint.

## Acceptance criteria

- A valid POST to `/api/contact` from an allowed origin sends one email from
  `no-reply@darkstone.cat` to `hola@darkstone.cat` with `replyTo` = user email.
- SMTP failure or timeout returns 500 `send_failed`; no Resend references remain
  in code or docs.

## Progress

- 2026-09-29: document created; branch created from main @82a8976.
- T1 done (inline). Observed: `npx eslint src` clean, `npx tsc --noEmit` clean,
  `npm run build` OK. `npm run lint` reports ~11.6k problems from untracked
  `.next-e2e/` and `test-results/` (main lacks the develop-users eslint
  ignores; pre-existing). Real send not verified: needs SMTP_USER/SMTP_PASSWORD
  in `.env.local` and a local production build on port 3000.
  Removed `details` from the `send_failed` response (the form never read it;
  avoids exposing SMTP error text to clients). Commit f5b1149.
- T1b done: no occurrence of the old address left in `src`; eslint src, tsc,
  locale JSON parse and build OK. No develop-users test references it. Commit 2bcde82.
- Real send verified: local production build on :3000, POST /api/contact ->
  200 {"success":true} with the user's SMTP credentials (app password rotated
  after being echoed once in the session). Inbox delivery to hola@ pending user
  confirmation. User confirmed delivery; main pushed at f27d0ab.
- T2 done (inline): main merged into develop-users (lockfile conflict resolved
  by keeping develop-users and re-running npm install). contact.test.ts mocks
  nodemailer and asserts from/to/replyTo/subject and the details-free 500;
  Playwright and CI env use SMTP_USER/SMTP_PASSWORD (E2E intercepts
  /api/contact). Observed: test:unit 131/131, lint clean, tsc clean.
  Integration/E2E not run (need local Supabase; unaffected by this change).

## Next step

Done. User pushes develop-users when ready.
