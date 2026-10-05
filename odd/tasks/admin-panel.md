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

- Strategy: `exception-ok`. Forecast ~10,000 authored lines; the user chose (2026-10-05) to
  keep everything on `develop-users` with no chained PR slicing.
- Work-unit commits on `develop-users` (not the default branch). Push, PR and merge are the
  user's decisions.
- RDD: off (global). Verification per task follows the writer's reported commands plus one
  parent spot check; `gentle-ai review assess` tier `high` adds an independent read-only
  verifier.

## Tasks

Route per task: `delegated` = one bounded writer subagent; `inline` = parent.

### Data model and database functions

- [x] T1 — M1 `membership_state`: membership columns + backfill, NOT VALID CHECKs, `card_issued_at`, column-level UPDATE grants, `members_update_own` blocks former members, drop `admins_update_all`, FK cascade replaced by an `auth.users` AFTER DELETE trigger that only deletes active members, state-aware `verify_card_token` and `is_email_confirmed`, `member_badges.awarded_by` — route: delegated (writer trigger: migration + 3+ test files)
- [x] T2 — M2 `roles_expand`: role CHECK widened (member/admin/board/superadmin), `role_since`, `role_rank`, `has_role`, `is_admin` on top of it, role-guard trigger for BR-10/11/12, existing guards switched to `has_role` — route: delegated
- [x] T3 — M3 `audit_log`: append-only table, RLS read for board, `audit_write()` internal, `log_admin_event()` whitelist — route: delegated
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
2. `supabase/migrations/20261005100100_roles_expand.sql` (T2). Safe to apply before any code
   ships: `admin` keeps every permission (`is_admin()` = `has_role('board')`, and `admin` ranks
   like `board`), and no current code path writes `role`. After applying, an admin should still
   open `/admin`, see the member list and regenerate a card. From then on a superadmin can only
   be demoted while two others remain (BR-10): promote the replacement first.
3. `supabase/migrations/20261005100200_audit_log.sql` (T3). Safe to apply before any code
   ships: it only adds `audit_log`, its trigger and three functions; nothing reads or writes
   them yet. Must be applied before T5+ code is deployed (every admin function and action
   writes an entry). After applying, `select count(*) from public.audit_log` as an admin works
   and an UPDATE on the table fails with `audit:append_only`.

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
- Independent read-only verification (tier `high`): PASS, no defects. Follow-ups carried to
  later tasks:
  - T5/T9a: `get_all_members_for_admin` inner-joins `auth.users`, so former-member stubs
    without a login account drop out of the admin list and CSV; use a LEFT JOIN plus the
    state columns.
  - T6: a former member whose login was deleted and who signs up again gets a new row and
    member number from `handle_new_user`; the rejoin flow (BR-1) must account for it.
  - T27 runbook: `DROP CONSTRAINT members_id_fkey` and `DROP POLICY admins_update_all` have
    no `IF EXISTS`; confirm both names on prod before applying M1 (it fails atomically).
  - Optional: `anon`/`authenticated` still hold TRIGGER and REFERENCES on `members` and
    `member_badges` (Supabase default, not exploitable through PostgREST).

### T2 — done (route: delegated)

- Commit: `feat(db): Add board and superadmin roles with a role guard` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100100_roles_expand.sql`).
- Test-first: RED observed with the new `tests/integration/roles.test.ts` before the migration
  (suite failed in setup: `members_role_check` rejected `board`); GREEN after `npm run db:reset`
  (28/28).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 61 files / 684 tests passed; `npm run test:integration` 16 files /
  160 tests passed (run twice, both green).
- Role guard errors (SQLSTATE 23514, message prefix for the app): `role_guard:self_role_change`
  (BR-11), `role_guard:last_superadmin` (BR-10), `role_guard:former_member_role` (BR-12). The
  trigger fires on `UPDATE OF role, left_on`, so a leave of a member who holds a role gets the
  BR-12 message too; the `members_former_member_no_role` CHECK (NOT VALID) is the backstop.
- BR-10 follows the spec wording ("if that would leave fewer than two"): a demotion is blocked
  whenever fewer than two OTHER active superadmins remain, also with only one superadmin today.
  Promotions are always allowed, so the bootstrap (0 → 1 → 2) works. Concurrent demotions are
  serialised by a transaction advisory lock. BR-10 applies to the service role too.
- BR-11 is tested with `createServiceClientAs(userId)` (`tests/helpers/supabase.ts`): an HS256
  JWT with `role=service_role` and `sub=userId`, signed with the local Supabase secret, so the
  update runs with elevated privileges while `auth.uid()` is the user, as the T8 SECURITY
  DEFINER functions will. T8 still tests BR-11 through its real function.
- `role_since`: backfilled with `created_at` for existing non-member roles (the real grant date
  was never recorded), NULL for members. The trigger stamps `now()` when the rank changes, NULL
  on `member`, and keeps it when the rank stays (admin → board in M7).
- `has_role()` is EXECUTE for `authenticated` only (revoked from PUBLIC, anon, service_role).
  RLS policies that anon can reach must call `is_admin()` (PUBLIC grant kept) or be scoped
  `TO authenticated` (relevant for the T3 audit_log policy). `is_admin()` now also requires an
  active membership.
- Not guarded: DELETE of a superadmin row (account deletion cascades through
  `handle_deleted_user`); T8/T26 must block a superadmin's self-deletion/leave per BR-10/BR-12.

### T3 — done (route: delegated)

- Commit: `feat(db): Add an append-only admin audit log` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100200_audit_log.sql`).
- Test-first: RED observed with the new `tests/integration/audit-log.test.ts` (suite failed in
  setup: `log_admin_event` not found) and the new superadmin block in `roles.test.ts`; GREEN
  after `npm run db:reset` (55/55 in those two files).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 61 files / 684 tests passed; `npm run test:integration` 17 files /
  187 tests passed (run twice, both green).
- Action keys (spec §5.1, 18, the table CHECK): `member.update`, `member.reveal_sensitive`,
  `membership.leave`, `membership.rejoin`, `badge.award`, `badge.revoke`, `card.regenerate`,
  `export.members_csv`, `export.member_data`, `export.member_register`, `export.emails`,
  `member.send_access_link`, `role.grant`, `role.revoke`, `member.anonymise`, `member.purge`,
  `account.purge_unconfirmed`, `ops.cache_refresh`.
- `log_admin_event()` whitelist (board+, authenticated only): the 4 exports, `member.reveal_sensitive`,
  `member.send_access_link`, `ops.cache_refresh`. `export.member_register` needs superadmin.
  Target required (not purged) for member_data / reveal / access link (access link: active
  only); no target for the others. Reveal needs `details.field` = `dni`|`phone`; on a former
  member only a superadmin, only `dni`, with a non-blank reason (BR-21). Not enforced (open):
  minimum reason length (D-E), A-11 on a former member stays board (D-D). If T7 moves the
  reveal into a DB function, drop it from the whitelist there.
- Grants: anon nothing; authenticated SELECT (RLS `TO authenticated USING (SELECT has_role('board'))`);
  service_role SELECT only (no INSERT/UPDATE/DELETE/TRUNCATE; sequence revoked too). Writes only
  through `audit_write()` (SECURITY DEFINER, EXECUTE revoked from PUBLIC/anon/authenticated/
  service_role; T5–T8 functions call it) and `log_admin_event()`. Trigger refuses UPDATE,
  TRUNCATE and DELETE of entries younger than 3 years for every role including the owner; T12
  retention deletes as the owner (SECURITY DEFINER function or postgres connection).
- BR-15 enforced in `audit_write()` and again as a CHECK (`audit_details_leak()`): no key at
  any depth named dni/nie/dni_nie/dni_nie_encrypted/phone/phone_encrypted/phone_number/
  telefon/telephone/mobile, and no string value shaped like a DNI, NIE or phone (9–15 digits).
  Field names go as values (`{"field":"dni"}`, `{"fields":["dni_nie"]}`): T7's `member.update`
  details must follow that shape. The free-text reason is not scanned.
- Errors: `audit:forbidden` 42501; `audit:action_not_allowed`, `audit:invalid_target`,
  `audit:invalid_details`, `audit:reason_required` 22023; `audit:sensitive_details`,
  `audit:append_only` 23514. Unknown keys passed to `audit_write()` fail on the CHECK (23514).
- Tests: superadmin cases live in `roles.test.ts` (the only file allowed to create superadmins,
  it asserts the global count). New helper `runSqlAsPostgres()` (`tests/helpers/supabase.ts`)
  runs one statement as `postgres` through the local postgres-meta `/pg/query` endpoint (service
  role key), used to prove the trigger stops the owner and to insert a backdated row. Audit rows
  written by tests cannot be deleted, so they stay until `db:reset`; tests filter by own ids.

## Next step

T4.
