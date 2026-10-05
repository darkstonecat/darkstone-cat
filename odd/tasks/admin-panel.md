# Admin panel — implementation

## Objective

Implement the admin panel described in `docs/admin-panel/spec.md` and designed in
`docs/mockups/admin-panel/` (README §7 lists the data gaps). Data model and migrations
first, then the server layer, then the screens.

## Problem / why

- The admin UI is read-only and there is no membership state (leave, rejoin, anonymise,
  purge), no role hierarchy (board / superadmin) and no audit log.
- `members.id` references `auth.users(id)` with `ON DELETE CASCADE`
  (`supabase/migrations/20260930110000_members_fk_on_delete_cascade.sql`), so deleting a login
  account deletes the member row; the spec needs former-member stubs to survive.
- `admins_update_all` (`20260312191146_create_members_table_and_rls.sql:84`) lets any admin
  update any column, including `role`.

## Scope

- Migrations M1–M6 (safe to apply to prod before the code ships) and M7 (role contract,
  applied last, after deploy and the superadmin runbook).
- Server layer: SECURITY DEFINER functions with audit in the same transaction, thin server
  actions using the user's session client, `requireRole()` guard, exports, retention, ops runs.
- Screens V-1..V-8 and their dialogs, plus the member side (V-7).

## Constraints

- All user-facing text in `ca`, `es`, `en`. Technical artifacts in English.
- New `CHECK` constraints are added `NOT VALID`. Migrations are not applied to prod
  automatically: each one is listed in the prod runbook before the code that needs it ships.
- Decrypted DNI/phone only inside server actions, never logged.
- E2E: `memberPage`/`adminPage` are read-only; mutating tests create their own throwaway users.
- The working tree holds uncommitted work from `zona-socis-mockups-v2` (MemberHeader, staged
  deletions). Every commit of this feature uses `git commit -- <paths>` with its own paths only.
- Commits: Conventional Commits, no AI attribution.

## Open decisions (owner: user)

- D-A: which current admins become the two superadmins (needed by T27 runbook).
- D-B: fields of the llibre de socis export, DNI or not (T9b).
- D-C: language of the leave/rejoin e-mails; no locale is stored (T10).
- D-D: A-11 on a former member; proposal superadmin only (T7/T9a).
- D-E: confirm A-7 checklist and minimum reason lengths, 5 for leave and 10 for reveal (T6/T7).
- D-F: what runs the retention job: GitHub Actions, pg_cron or Vercel cron (T12).
- D-G: path `/admin/tools/event-images` (T25).
- D-H: does a backdated leave move the purge date; proposal purge = `left_on` + 3 years (T6/T12).

## Delivery

- Strategy: `ask-on-risk`. Forecast ~10,000 authored lines, so the chain strategy
  (`stacked-to-main` or `feature-branch-chain`) is pending the user's choice before any PR.
- Work-unit commits on `develop-users` (not the default branch). Push, PR and merge are the
  user's decisions.
- RDD: off (global). Verification per task follows the writer's reported commands plus one
  parent spot check.

## Tasks

Route per task: `delegated` = one bounded writer subagent; `inline` = parent.

### Data model and database functions

- [x] T1 — M1 `membership_state`: membership columns + backfill, NOT VALID CHECKs, `card_issued_at`, column-level UPDATE grants, `members_update_own` blocks former members, drop `admins_update_all`, FK cascade replaced by an `auth.users` AFTER DELETE trigger that only deletes active members, state-aware `verify_card_token` and `is_email_confirmed`, `member_badges.awarded_by` — route: delegated (writer trigger: migration + 3+ test files)
- [ ] T2 — M2 `roles_expand`: role CHECK widened (member/admin/board/superadmin), `role_since`, `role_rank`, `has_role`, `is_admin` on top of it, role-guard trigger for BR-10/11/12, existing guards switched to `has_role` — route: delegated
- [ ] T3 — M3 `audit_log`: append-only table, RLS read for board, `audit_write()` internal, `log_admin_event()` whitelist — route: delegated
- [ ] T4 — TypeScript role model: `requireRole()` guard, proxy `/admin` prefix, NavBar and `useAuthUser` with `isBoardRole()` — route: delegated
- [ ] T5 — M4 read RPCs: `admin_list_members`, `admin_get_member`, `admin_stats`, `admin_list_activity` — route: delegated
- [ ] T6 — Leave and rejoin functions (ban, sessions, card token) — route: delegated
- [ ] T7 — Update, reveal, badge and card functions — route: delegated
- [ ] T8 — Role and anonymise functions — route: delegated
- [ ] T9a — Export functions + routes: members CSV, member data (A-10, A-11) — route: delegated
- [ ] T9b — Export functions + routes: e-mail lists, llibre de socis (A-16, S-4) — route: delegated
- [ ] T10 — Mail module (`src/lib/mail/`) + leave/rejoin actions + templates — route: delegated
- [ ] T11a — Server actions A-4, A-5, A-8, A-9 — route: delegated
- [ ] T11b — Server actions A-15, roles (S-1, S-2), anonymise (S-3) — route: delegated
- [ ] T12 — `run_retention()` + `/api/cron/retention` + workflow (dry run first) — route: delegated
- [ ] T13 — `ops_job_runs` + refresh action (A-14), cron route records automatic runs — route: delegated

### Screens

- [ ] T14 — Admin shell: layout with guard, AdminHeader/AdminTabs, AdminDialog primitive, i18n — route: delegated
- [ ] T15 — V-8 procedures — route: delegated
- [ ] T16 — V-2 members list (server search/pagination, mobile cards) — route: delegated
- [ ] T17 — V-2 dialogs (A-10, A-16, S-4) — route: delegated
- [ ] T18 — V-3 member file, read-only — route: delegated
- [ ] T19 — V-3 edit mode + reveal (A-4, A-5) — route: delegated
- [ ] T20 — V-3 leave/rejoin dialogs (A-6, A-7) — route: delegated
- [ ] T21 — V-3 badges, card, member data, access link (A-8, A-9, A-11, A-15) — route: delegated
- [ ] T22 — V-3 role card + S-3, V-5 roles — route: delegated
- [ ] T23 — Audit renderer + V-4 activity — route: delegated
- [ ] T24 — V-1 dashboard (replaces AdminDashboard) — route: delegated
- [ ] T25 — V-6 tools + event images move + 308 redirect — route: delegated
- [ ] T26 — V-7 member side: M-1 leave dialog, login help, neutral password reset via server action — route: delegated
- [ ] T27 — M7 `roles_contract` + prod runbook + CLAUDE.md/README — route: delegated

## Acceptance criteria

- Every spec action A-*, S-* and rule BR-* is enforced in the database, not only in the UI.
- Every admin mutation writes exactly one audit entry in the same transaction.
- `npm run lint`, `npm test` and the affected E2E specs pass after each task.

## Prod runbook (migrations to apply before deploying the code that needs them)

1. `supabase/migrations/20261005100000_membership_state.sql` (T1). Safe to apply before any
   code ships: no current code path writes a column that loses its UPDATE grant. Must be
   applied before T6+ code is deployed (leave/rejoin functions use its columns). After applying,
   check that profile edit, the gaming-account link/unlink and the newsletter switch still save.

## Progress

### T1 — done (route: delegated)

- Commit: `feat(db): Add membership state and lock down member updates` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100000_membership_state.sql`).
- Test-first: RED observed with the new/changed integration tests before the migration
  (23 failing in membership-state, rls, account-deletion, verify-card, is-email-confirmed);
  GREEN after `npm run db:reset` (68/68 in those files).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 61 files / 684 tests passed; `npm run test:integration` 15 files /
  132 tests passed.
- Notes: also revoked INSERT/DELETE/TRUNCATE on `members` from `anon`/`authenticated`
  (already impossible through RLS; TRUNCATE is not covered by RLS). Added CHECK
  `members_board_leave_has_reason` (BR-8; exempt once purged). `card_issued_at` is
  `NOT NULL DEFAULT now()`; `regenerate_card_token` does not update it yet (T7).
  `scripts/migrate-members.mjs` sets `membership_start_date` only, so a future import would
  get `current_joined_on` = import day; existing rows are backfilled.

## Next step

T2.
