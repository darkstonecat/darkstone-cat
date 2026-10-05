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
  T6 enforces 5 for a board leave (`membership_leave_reason_min_length()`, provisional); T7
  enforces 10 for a former member's DNI reveal (`admin_reveal_reason_min_length()`, provisional;
  an active member's reveal takes an optional reason).
- D-F: what runs the retention job: GitHub Actions, pg_cron or Vercel cron (T12).
- D-G: path `/admin/tools/event-images` (T25).
- D-H: does a backdated leave move the purge date; proposal purge = `left_on` + 3 years (T6/T12).
  T6 also limits a board leave to at most 365 days back (`membership_leave_max_backdate_days()`,
  provisional; the spec only says "never in the future"), and never before the current alta.

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
- [x] T4 — TypeScript role model: `requireRole()` guard, proxy `/admin` prefix, NavBar and `useAuthUser` with `isBoardRole()` — route: delegated
- [x] T5 — M4 read RPCs: `admin_list_members`, `admin_get_member`, `admin_stats`, `admin_list_activity` — route: delegated
- [x] T6 — Leave and rejoin functions (ban, sessions, card token) — route: delegated
- [x] T7 — Update, reveal, badge and card functions — route: delegated
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
4. `supabase/migrations/20261005100300_admin_read_rpcs.sql` (T5). Safe to apply before any
   code ships: it only adds read-only functions; nothing calls them yet and
   `get_all_members_for_admin` is untouched. Needs M1–M3 (columns, `has_role`, `audit_log`).
   Must be applied before T16+ screens are deployed. After applying, as an admin
   `select * from public.admin_stats()` returns one row, and as a plain member every
   `admin_*` function fails with `admin:forbidden`.
5. `supabase/migrations/20261005100400_membership_lifecycle.sql` (T6). Safe to apply before any
   code ships: it adds the leave/rejoin functions (nothing calls them yet) and only narrows the
   `admin_list_members` search. Needs M1–M4. Must be applied before T10/T20/T26 code is
   deployed. Before applying, confirm on prod that `postgres` may write the Auth tables the
   functions touch (in a transaction you roll back: `update auth.users set banned_until =
   banned_until where false; delete from auth.sessions where false; delete from
   auth.refresh_tokens where false;`); locally it holds INSERT/UPDATE/DELETE on all three. If
   it does not, the functions fail atomically (no half-done leave) and T10 must ban through
   `auth.admin.updateUserById` instead. After applying, as a plain member
   `select public.admin_member_leave(gen_random_uuid(), 'xxxxx')` fails with
   `membership:forbidden`.
6. `supabase/migrations/20261005100500_member_admin_mutations.sql` (T7). Safe to apply before any
   code ships: nothing in `src/` calls the new functions or `regenerate_card_token`; it removes
   `member.reveal_sensitive` from `log_admin_event()` (no shipped code logs it) and replaces
   `audit_details_leak()` (the audit_log CHECK is not re-checked on existing rows; prod has
   none). Needs M1–M5. Must be applied before T11a/T19/T21 code is deployed. After applying, as
   `postgres` `select public.audit_details_leak('{"v":"612 345 678"}')` returns true and
   `select public.audit_details_leak('{"rows":"123456789"}')` false, and as a plain member every
   `admin_*` mutation and `regenerate_card_token` fail with `admin:forbidden` (no state change). `regenerate_card_token` errors change from `Unauthorized: admin role
   required` / `Member not found` to `admin:forbidden` / `admin:not_found`.

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
- Independent read-only verification (tier `high`): PASS, no defects (probed in rolled-back
  transactions: no escalation, BR-10 holds for multi-row and concurrent demotions). Follow-ups:
  - T8: add a `BEFORE DELETE` branch to the role guard so deleting an active superadmin row
    respects BR-10 in the database (BR-16), not only in app code.
  - T11b: call the T8 role functions with the user's session client, never the service role;
    without a JWT `sub` BR-11 does not apply. T8 functions must not use REPEATABLE READ (BR-10
    relies on READ COMMITTED snapshots).
  - T4: TypeScript role checks to migrate: `src/lib/supabase/auth.ts:47`,
    `src/app/api/admin/members/export/route.ts:24`, `src/components/NavBar.tsx:381,535`,
    `src/components/admin/MembersTable.tsx:180,206`, `src/components/profile/ProfileEditForm.tsx:259`,
    `src/hooks/useAuthUser.ts:9,95`.
  - Test gaps in `roles.test.ts` (add when the file is next touched): a superadmin leaving via
    `role` + `left_on` in one UPDATE, multi-row demotion, concurrency.

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
- Independent read-only verification (tier `high`): PASS, no blocking defects (no forgery,
  alteration or deletion path; whitelist matches spec §5.1; owner stopped). Follow-ups for T7,
  whose migration can redefine `audit_details_leak()`:
  - False positives: any 9–15 digit string (`{"rows":"123456789"}`, Ludoya/BGG ids, a numeric
    username) is rejected and would roll back the admin action. Send counts/ids as JSON numbers,
    record username changes as field names only, and/or narrow the phone pattern.
  - Misses: phones as JSON numbers, values with surrounding whitespace/newlines, `12.345.678-Z`,
    `DNI 12345678Z`, `(+34) 612345678`, keys `telefono`/`movil`/`dniNie`. btrim values and scan
    numbers too.
  - App-logged events (exports, reveal) must call `log_admin_event` BEFORE serving the data so
    they fail closed. The target checks accept unconfirmed accounts; the app filters them (BR-22).
  - Weak tests (only `error` not null): "audit_write() is internal", "reason capped at 1000",
    anon calling `log_admin_event`. Add a test that legitimate values (member numbers, dates,
    UUIDs) pass the guard.

### T4 — done (route: delegated)

- Commit: `feat(auth): Recognise board and superadmin roles in the app` on `develop-users`
  (hash in `git log -- src/lib/auth/roles.ts`).
- Test-first: RED observed with the new/changed tests before the code (roles and guard suites
  failed to import; 12 failing in event-image-routes, members-export, useAuthUser, NavBar admin
  link, MembersTable roles); GREEN after (9 files / 106 tests). The new proxy test passed on the
  old code too: `matchesRoute` already matched by prefix, so the list was only simplified.
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 66 files /
  753 tests passed; `npm run test:integration` 17 files / 187 tests passed;
  `npx playwright test e2e/admin e2e/navigation` 47 passed, 1 failed:
  `locale-routing.spec.ts` "language switcher is visible" (pre-existing: it looks for a
  `button`/`select`, the switcher renders links since bdec996; untouched by T4).
- `src/lib/auth/roles.ts` (pure, client + server): `Role`, `ROLES`, `toRole`, `roleRank`,
  `hasRoleAtLeast`, `isBoardRole`, `isSuperadmin`, `roleLabelKey`. Ranks mirror `role_rank()`;
  unknown values have no rank and never pass.
- `src/lib/admin/guard.ts` (`server-only`): `getAdminAccess(min)` returns `ok` + actor
  (`{ id, role }`), `unauthenticated` or `forbidden` for API routes (401/403); `requireRole(min)`
  for pages redirects to the localized `/login` without a session and calls `notFound()` for
  anyone else. Both read `role, left_on` with the session client: `left_on` set, an unknown role
  or an unreadable row is forbidden (same rule as `has_role()`).
- `isAdmin()` removed from `src/lib/supabase/auth.ts`; every caller migrated (`/admin`,
  `/admin/members`, `/events/images`, the event image API, the members export). `Member.role`
  is `Role`.
- Behaviour change: a signed-in member without a board role now gets the 404 page on `/admin`,
  `/admin/members` and `/events/images` instead of the "Accés restringit" card; the unused
  `admin.unauthorized_*` keys were removed. The e2e dashboard spec asserts the 404.
- Proxy: `ADMIN_ROUTES = ["/admin", "/events/images"]` (prefix, every locale); still session only.
- Labels: `role_board` ("Junta" / "Junta" / "Board") and `role_superadmin` ("Superadmin") in the
  `profile` and `admin` namespaces replace `role_admin`. The legacy `admin` role is labelled
  as board. MembersTable chips: Junta orange, Superadmin dark (mockup README); sorting by role
  uses the rank. NavBar shows the admin link for any board role; `useAuthUser` maps unknown
  roles to null.
- Follow-up for T14: `requireRole()` is not memoised per request; wrap it in `React.cache` if
  the admin layout and the page both call it.
- Independent read-only verification (tier `high`): PASS, no defects (every admin surface
  guarded; guard uses the session client and fails closed; prefix matching safe). Follow-ups:
  - T16: `src/lib/admin/actions.ts:10` `getAllMembers` is a public `"use server"` action with
    only a session check (the RPC's `has_role` protects it) that returns the raw
    `error.message`; remove it with the V-2 rewrite or guard it with `getAdminAccess`.
  - T14: when the session expired between proxy and page, `requireRole` redirects to `/login`
    without a `redirect` param; pass the current path.
  - T27: `CLAUDE.md` (~line 217) and `docs/mockups/admin-panel/README.md` (~line 88) still
    mention `isAdmin()`.
  - Guard tests never exercise a `getUser` call that returns an error object.

### T5 — done (route: delegated)

- Commit: `feat(db): Add admin read functions for members, stats and activity` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100300_admin_read_rpcs.sql`).
- Test-first: RED observed with the new `tests/integration/admin-read-rpcs.test.ts` before the
  migration (37/37 failing, functions not found); GREEN after `npm run db:reset` (37/37).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 66 files / 753 tests passed; `npm run test:integration` 18 files /
  224 tests passed (run twice, both green).
- All four: SECURITY DEFINER, `search_path ''`, STABLE, guarded by `has_role('board')`
  (internal `admin_assert_board()`), EXECUTE for `authenticated` only. Errors:
  `admin:forbidden` 42501; `admin:invalid_argument` 22023 (unknown state, role, sort or actor
  kind). anon and service_role get Postgres "permission denied" (42501). Never return DNI/phone
  values or ciphertext; never list or show unconfirmed sign-ups (BR-22) or purged stubs.
  Internal helper `admin_search_fold(text)`: lower case + Catalan/Spanish accents folded + `·`
  dropped (no `unaccent` extension).
- `admin_list_members(p_state text = 'active', p_role text = NULL, p_q text = NULL,
  p_sort text = 'number_asc', p_limit int = 50, p_offset int = 0)` RETURNS TABLE
  `(id uuid, member_number, first_name, last_name, email text|null, has_login bool,
  state 'active'|'former', role, membership_start_date date, current_joined_on date,
  left_on date|null, total_count int)`. State NULL → active; role NULL/'all' | member | board
  (includes legacy admin) | superadmin. Search (first 100 chars, accent/case-insensitive,
  `%`/`_` literal) over "first last", member number, e-mail, Ludoya and BGG usernames. Sort:
  number/name/joined/left × asc/desc (left: active last), tie → member number. Limit clamped
  1..200; `total_count` = rows matching the filters (no rows past the end). E-mail via LEFT
  JOIN, so anonymised stubs without a login are listed (email NULL, has_login false).
- `admin_get_member(p_member_number text)` RETURNS TABLE, one row or none (unknown, purged,
  unconfirmed → "not found"): `id, member_number, state, first_name, last_name, email,
  has_login, role, role_since, postal_code, ludoya_username, bgg_username, newsletter_accepted,
  has_dni, has_phone, membership_start_date, current_joined_on, left_on, left_by, leave_reason,
  purge_on (left_on + 3 years), anonymised_at, card_valid (= active), card_issued_at,
  created_at, badges jsonb [{badge_key, awarded_at, awarded_by, awarded_by_name}]`. Former
  member: postal_code, usernames, newsletter_accepted and has_phone are NULL whatever the row
  holds (BR-20/21); has_dni stays. "Membre {year}" is not in badges (app derives it, BR-6).
  Masked DNI/phone tails need decryption: T7/T18 (the reveal path), not here.
- `admin_stats(p_reference_date date = NULL)` RETURNS TABLE one row: `active_members,
  former_members (not purged), joined_this_month (primera alta in the month, purged stubs
  included), left_this_month, left_this_month_self, left_this_month_board,
  rejoined_this_year (membership.rejoin audit entries in the year), newsletter_members,
  board_members (board + admin + superadmin), superadmins` (all int). Periods are Europe/Madrid
  calendar months/years of `p_reference_date` (default today in Madrid); the parameter moves
  only the period counters (added for tests and past periods). Cache refresh results wait for
  T13 (`ops_job_runs`); the newsletter percentage is computed by the app.
- `admin_list_activity(p_action text = NULL, p_actor uuid = NULL, p_target uuid = NULL,
  p_from timestamptz = NULL, p_to timestamptz = NULL, p_limit int = 25, p_before_id bigint =
  NULL, p_actor_kind text = NULL, p_target_number text = NULL)` RETURNS TABLE `(id bigint,
  created_at, actor_id, actor_role, actor_member_number, actor_name, action, target_member_id,
  target_member_number, target_name, details jsonb, reason, total_count int)`. Newest first,
  keyset on (created_at DESC, id DESC) via the last row's id (a vanished id → no rows).
  `p_action` = key or group `'badge.*'` / `'role.*'`; `p_actor_kind` = `'system'` (no actor) |
  `'self'` (actor = target) for the V-4 "Sistema" / "Soci (ell mateix)" choices;
  `p_target_number` filters by the snapshot (works after a purge); dates half-open
  `[p_from, p_to)`. Limit clamped 1..200; `total_count` ignores the cursor. Names are current
  names; NULL once purged, and the target's also once anonymised (spec §5.3).
- Deviations from the planned signatures: `admin_stats` takes an optional reference date;
  `admin_list_activity` has two extra trailing optional filters (`p_actor_kind`,
  `p_target_number`). Unknown sort/state/role values are rejected (22023), not ignored: T16
  must sanitise URL params before calling.
- Tests: the "now" stats are measured as deltas around changes to the file's own users, retried
  up to 4 times when another file lands in the window; period stats use 1999 (untouched by other
  files) and the 1999 audit entries are deleted in `afterAll` (older than 3 years, so the
  append-only trigger allows it).
- Independent read-only verification (tier `high`): PASS with one low defect, fixed in T6
  (search matched former members' Ludoya/BGG usernames, an existence oracle against
  BR-20/21). Other notes:
  - T7: `member.update` details must record only field names for postal code and usernames,
    otherwise old values survive in V-3 "Activitat" after a leave (BR-20).
  - `actor_name` still shows an anonymised actor's name (spec §5.3 only covers the target);
    `admin_list_activity` can show `target_name` for an unconfirmed sign-up target.
  - Test gaps: joined/left sort order not asserted, page-size cap tests trivial with < 200
    rows, keyset tie-break on equal `created_at` never exercised.

### T6 — done (route: delegated)

- Commit: `feat(db): Add leave and rejoin functions for memberships` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100400_membership_lifecycle.sql`).
- Test-first: RED observed with the new `tests/integration/membership-lifecycle.test.ts` and
  the new superadmin block in `roles.test.ts` before the migration (18 failing: functions not
  found, username search and ŀ fold); GREEN after `npm run db:reset` (50/50 in those two
  files). The "role + left_on in one UPDATE" superadmin case (T2 gap) passed already: it pins
  existing role-guard behaviour.
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 66 files / 753 tests passed; `npm run test:integration` 19 files /
  244 tests passed (3 consecutive green runs after the stats-test fix below).
- Signatures (SECURITY DEFINER, `search_path ''`, EXECUTE for `authenticated` only; anon and
  service_role get "permission denied"):
  - `admin_member_leave(p_member_id uuid, p_reason text, p_left_on date = NULL)` RETURNS TABLE
    `(member_number, email, first_name, left_on)`: board+ (A-6). `p_left_on` NULL = today in
    Europe/Madrid (deviation from `DEFAULT current_date`, which is UTC in Supabase).
  - `member_leave_self(p_reason text = NULL)` RETURNS TABLE `(member_number, left_on)`: the
    caller leaves today (M-1); the reason is optional and stored like a board one.
  - `admin_member_rejoin(p_member_id uuid, p_channel text, p_note text = NULL)` RETURNS TABLE
    `(member_number, email, first_name, current_joined_on)`: board+ (A-7). Channels `form` |
    `email` | `in_person` | `other`; the note goes to the audit `reason` column (max 500).
  - Internal (no API grant): `membership_close()` (shared leave body),
    `membership_leave_reason_min_length()` = 5, `membership_leave_max_backdate_days()` = 365,
    `membership_today()` (Madrid date).
- Leave (both paths): `left_on`, `left_by`, `leave_reason`; `phone_encrypted`, `postal_code`,
  `ludoya_username`, `bgg_username` set to NULL and `newsletter_accepted` false (§4.2, BR-5,
  BR-20); DNI, names, dates and badges kept; new `card_token` + `card_issued_at`. Board leave
  date: not in the future, not before `current_joined_on`, at most 365 days back. Rejoin:
  `left_*` cleared, `current_joined_on` = Madrid today, `membership_start_date` untouched, new
  card token, newsletter stays off, ban lifted.
- Sign-in block (BR-4/BR-18) is done in the database, in the same transaction: `postgres` (the
  function owner, not a superuser) holds INSERT/UPDATE/DELETE on `auth.users`, `auth.sessions`
  and `auth.refresh_tokens` locally (checked with `information_schema.role_table_grants` and a
  rolled-back probe). Leave sets `auth.users.banned_until = now() + 100 years` and deletes the
  user's sessions and refresh tokens; rejoin sets `banned_until = NULL`. Tested: after a leave
  `signInWithPassword` fails with `user_banned`, the open session's `refreshSession()` fails,
  its still-valid access token gets `has_role('member') = false` and cannot update the row,
  `is_email_confirmed` is false and `verify_card_token` is invalid; after rejoin the old
  password works again and the new card is valid. No flag is returned (nothing left for T10
  to ban).
- Audit (one entry per call, same transaction): `membership.leave` details
  `{"left_by":"board"|"self","left_on":"YYYY-MM-DD"}`, reason = motiu (NULL for a self leave
  without one), actor = target for M-1; `membership.rejoin` details `{"channel":…,
  "previous_left_on":"YYYY-MM-DD","previous_left_by":…}`, reason = note.
- Errors (message prefix): `membership:forbidden` 42501; `membership:role_held` 23514 (BR-12,
  checked before the role guard; also stops every superadmin, so BR-10 never comes into play);
  22023 for `membership:not_found` (unknown or unconfirmed sign-up), `membership:self_target`
  (board leave on oneself: use M-1), `membership:not_active`, `membership:reason_required`
  (< 5 after trim), `membership:reason_too_long` (> 500), `membership:invalid_date`,
  `membership:not_former`, `membership:register_closed` (anonymised or purged),
  `membership:no_login`, `membership:invalid_channel`, `membership:note_too_long`.
- Rejoin without a login account: refused with `membership:no_login`. The spec keeps the old
  password on return (§4.3) and `members` stores no e-mail, so a former member whose account is
  gone cannot be matched to a new sign-up: that person signs up again (new row and number) and
  the board resolves the duplicate (P-1 step 4). `handle_new_user` unchanged. While the account
  exists (banned), GoTrue does not create a second user for the same e-mail.
- T5 verification follow-up fixed here: `admin_list_members` matches Ludoya/BGG usernames only
  on active rows (a former member's leftover username can no longer be confirmed through
  search; BR-20/21), and `admin_search_fold` folds ŀ/Ŀ (U+0140/U+013F) to l. Tested in the
  lifecycle file (former member not found by username, still found by name and number).
- Test fix: the "now" stats test in `admin-read-rpcs.test.ts` failed 2 of 3 runs once this
  file added more membership churn; its retry loop now makes up to 8 attempts with a growing
  pause (250 ms × attempt) and a 30 s timeout.
- For T10: send the baixa e-mail with the reason (BR-8) using the returned e-mail/first name,
  and the "Tornes a ser soci" e-mail after rejoin; no Auth admin calls are needed for the ban.
  Map `membership:*` prefixes to translated texts (role_held → the BR-12 message of A-6/M-1).
- For T26: after `member_leave_self`, sign the browser out (wipe cookies) and redirect with the
  notice; map `user_banned` on login to the same generic error as a wrong password (§4.4).
  Protected member pages must check `left_on`, because an access token issued before the
  leave stays valid for up to an hour.
- Prod risk: whether prod's `postgres` may write `auth.users`/`auth.sessions` (see runbook 5).
  Supabase-managed Auth columns could change shape in a future GoTrue release; the functions
  only touch `banned_until`, `updated_at`, `sessions.user_id` and `refresh_tokens.user_id`.

### T7 — done (route: delegated)

- Commit: `feat(db): Add admin edit, reveal, badge and card functions` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100500_member_admin_mutations.sql`).
- Test-first: RED observed with the new `tests/integration/member-admin-mutations.test.ts`
  before the migration (55 of 93 failing: functions missing, old detector's misses and false
  positives); GREEN after the migration (93/93). Adjusted existing tests to the new contract:
  `audit-log.test.ts` (reveal out of the whitelist; the 3 weak T3 tests now assert 42501 /
  23514 + constraint name), `roles.test.ts` (superadmin reveal through `admin_reveal_sensitive`,
  new card error prefix), `rls.test.ts` (card error prefixes), `admin-read-rpcs.test.ts` (the
  activity fixture reveals through the new function).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 66 files / 753 tests passed; `npm run test:integration` 20 files /
  335 tests passed (run twice, both green).
- Signatures (SECURITY DEFINER, `search_path ''`, EXECUTE for `authenticated` only; anon and
  service_role get "permission denied"; board+ via `admin_assert_board()`):
  - `admin_update_member(p_member_id uuid, p_patch jsonb)` RETURNS `text[]` (changed audit field
    names, sorted). Whitelist (A-4): `first_name`, `last_name` (trimmed, 1..100), `postal_code`
    (5 digits or null/""), `ludoya_username`, `bgg_username` (normalised like
    `normalizeUsername`, `[[:alnum:]_. -]{1,64}`, null/"" clears), `phone_encrypted`,
    `dni_nie_encrypted` (ciphertext shape `iv:tag:data` with 12-byte IV and 16-byte tag, ≤ 512,
    or null). Newsletter is not editable (not in A-4). Active, confirmed targets only. No-op
    patch (empty or equal values) → returns an empty array, no UPDATE, no audit entry. A new
    ciphertext always differs (random IV): T11a must send DNI/phone only when the plain value
    changed.
    Audit `member.update` details `{"fields":[...], "changes":{"first_name":{"from","to"},
    "last_name":{...}}}`; field names `first_name, last_name, postal_code, ludoya_username,
    bgg_username, phone, dni`; before/after only for names (never DNI/phone, BR-15; never postal
    code/usernames, BR-20).
  - `admin_reveal_sensitive(p_member_id uuid, p_field text, p_reason text = NULL)` RETURNS
    `text` (the ciphertext; T11a decrypts). Writes `member.reveal_sensitive` `{"field"}` + reason
    BEFORE returning. Active member: board, optional reason. Former member: superadmin, `dni`
    only, reason ≥ 10 after trim (`admin_reveal_reason_min_length()`, D-E provisional). Reason
    ≤ 500. Nothing stored → `admin:no_value`, no entry. `member.reveal_sensitive` removed from
    the `log_admin_event()` whitelist (rest of that function unchanged).
  - `admin_award_badge(p_member_id uuid, p_badge_key text, p_note text = NULL)` RETURNS
    `timestamptz` (awarded_at); `admin_revoke_badge(p_member_id uuid, p_badge_key text,
    p_reason text = NULL)` RETURNS void. Catalogue `admin_badge_keys()` =
    `volunteer_egara_joga`, `ludoteca_donor` (= the table CHECK; "Membre {year}" is derived and
    never awardable). Active members only (a former member's badges are frozen, BR-7). Not
    idempotent: `admin:badge_held` / `admin:badge_not_held`, no entry. `awarded_by` = caller.
    Details: award `{"badge"}`, revoke `{"badge","awarded_on":"YYYY-MM-DD"}`; note/reason → audit
    reason (≤ 500).
  - `regenerate_card_token(target_member_id uuid)` RETURNS `text` (unchanged signature): board+,
    active members only, `card_issued_at = now()`, `card.regenerate` with details `{}` (the token
    is never logged). No member self-service (the spec has none). Errors now use the `admin:`
    prefixes (was `Unauthorized: admin role required` / `Member not found`); no `src/` caller.
  - Internal (no API grant): `admin_lock_member()` (confirmed, not purged, `FOR UPDATE`),
    `admin_reason_max_length()` = 500, `admin_assert_reason_length()`, `admin_badge_keys()`,
    `admin_reveal_reason_min_length()` = 10, `audit_value_is_sensitive()`.
- Errors (prefix, SQLSTATE): `admin:forbidden` 42501 (also a board member revealing a former
  member's DNI); 22023 for `admin:not_found` (unknown, purged, unconfirmed), `admin:not_active`,
  `admin:invalid_argument` (patch not an object, key outside the whitelist, reveal field, phone
  of a former member, badge key), `admin:invalid_value: <patch key> …`, `admin:no_value`,
  `admin:reason_required`, `admin:reason_too_long`, `admin:badge_held`, `admin:badge_not_held`;
  `audit:sensitive_details` 23514 can still surface from `audit_write` (e.g. a name shaped like
  a phone).
- BR-15 detector v2 (`audit_details_leak()`, same signature, still the CHECK and the
  `audit_write` guard). Leak when, at any depth: (1) a key, lower-cased, accents folded and
  `_ - space` removed, is one of dni, nie, nif, dninie, dniencrypted, dninieencrypted, phone,
  phonenumber, phoneencrypted, telefon, telefono, telephone, telefonnumber, mobile, mobil, movil,
  mobilephone; (2) a string, trimmed (incl. newlines/tabs), with one leading label (dni, nie,
  nif, tel, telf, telefon, telèfon, telefono, teléfono, phone, mobile, mobil, mòbil, movil, móvil
  + optional `: . #`) dropped and separators `space . - / ( )` removed, matches DNI
  `^[0-9]{8}[A-Za-z]$`, NIE `^[XYZxyz][0-9]{7}[A-Za-z]$`, `^\+[0-9]{9,15}$` or Spanish phone
  `^(0034|34)?[6-9][0-9]{8}$`; (3) a JSON number matching `^(34)?[6-9][0-9]{8}$`. Lets through
  member numbers, dates, timestamps, UUIDs, card tokens, counts and ids like 123456789,
  123456789012, 512345678. Residuals: a 9-digit id starting 6–9 (or 11 digits 346–349…) is
  treated as a phone and makes the write fail; values inside longer sentences are not scanned;
  the free-text reason column is not scanned.
- T3 follow-ups closed: detector misses and false positives; reveal logged before serving
  (inside the DB function); weak tests strengthened. T1 follow-up closed: card_issued_at.
- For T11a: map the `admin:*` prefixes above; `admin:invalid_value: <key>` → the profile edit's
  `invalid_name` / `invalid_postal_code` / `invalid_username` / `invalid_phone` / `invalid_dni`
  texts. Validate and encrypt first (as `updateMemberProfile`), then call with the session
  client. Decrypt the reveal result in the action only, never log it.
- Prod risk: none beyond runbook 6; the regex classes `[[:alnum:]]`/`[[:space:]]` depend on the
  database ctype (local `en_US.UTF-8` matches accented letters and ŀ; Supabase prod uses the
  same default).

## Next step

T8.
