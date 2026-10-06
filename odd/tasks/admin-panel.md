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

- D-A: which current admins become the two superadmins. **Still open**: the runbook (phase 6)
  carries placeholders for the two member numbers; M7 cannot be applied until it is decided.
- D-B: fields of the llibre de socis export, DNI or not (T9b). **Decided 2026-10-05 by the user:
  with DNI** (member number, names, DNI/NIE, first sign-up, current sign-up, leave date, left by).
- D-C: language of the leave/rejoin e-mails; no locale is stored (T10). **Decided 2026-10-05 by
  the user: always Catalan** (no `preferred_locale` column).
- D-D: A-11 on a former member; proposal superadmin only (T7/T9a). T9a enforces the proposal,
  provisionally, in one place: `admin_member_data_former_min_role()` = `'superadmin'`.
- D-E: confirm A-7 checklist and minimum reason lengths, 5 for leave and 10 for reveal (T6/T7).
  T6 enforces 5 for a board leave (`membership_leave_reason_min_length()`, provisional); T7
  enforces 10 for a former member's DNI reveal (`admin_reveal_reason_min_length()`, provisional;
  an active member's reveal takes an optional reason).
- D-F: what runs the retention job: GitHub Actions, pg_cron or Vercel cron (T12). **Decided
  2026-10-05 by the user: GitHub Actions** (daily workflow calling `/api/cron/retention` with
  `CRON_SECRET`, like the cache refresh).
- D-G: path `/admin/tools/event-images` (T25). Implemented provisionally (T25); the redirect lives in
  `next.config.ts`, so changing the path means editing the page folder, three redirects and the link.
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
- [x] T8 — Role and anonymise functions — route: delegated
- [x] T7b — Lock down DNI/phone ciphertext (correction from the T7 verification): drop `admins_select_all` and `member_badges_admins_select_all`, `get_all_members_for_admin` service-role only (guarded server callers use the admin client), remove the public `getAllMembers` action, bind ciphertext to its member with AES-GCM AAD (`v2:` format, legacy fallback until prod is re-encrypted) + re-encryption script, BR-15 detector v3, e2e teardown demotes before deleting — route: delegated (writer trigger: migration + encryption module + 6+ callers and tests)
- [x] T9a — Export functions + routes: members CSV, member data (A-10, A-11) — route: delegated (writer trigger: migration + lib + 2 routes + 6 test files)
- [x] T9b — Export functions + routes: e-mail lists, llibre de socis (A-16, S-4), A-11 reason for a former member (T9a verification), POST + Origin for every export, T7b follow-ups — route: delegated (writer trigger: migration + lib + 4 routes + 10 test files)
- [x] T10 — Mail module (`src/lib/mail/`) + leave/rejoin actions + templates — route: delegated (writer trigger: mail module + templates + 2 action files + contact refactor + 6 test files)
- [x] T11a — Server actions A-4, A-5, A-8, A-9 — route: delegated (writer trigger: actions + error module + 3 test files)
- [x] T11b — Server actions A-15, roles (S-1, S-2), anonymise (S-3) — route: delegated (writer trigger: 2 action files + sender extraction + error module + 5 test files)
- [x] T12 — `run_retention()` + `/api/cron/retention` + workflow (dry run first), member-number width fix, T10 follow-ups — route: delegated (writer trigger: 2 migrations + route + lib + workflow + mail/leave fixes + 6 test files)
- [x] T13 — `ops_job_runs` + refresh action (A-14), cron route records automatic runs — route: delegated (writer trigger: migration + lib + action + route + 4 test files)

### Screens

- [x] T14 — Admin shell: layout with guard, AdminHeader/AdminTabs, AdminDialog primitive, i18n — route: delegated
- [x] T15 — V-8 procedures — route: delegated
- [x] T16 — V-2 members list (server search/pagination, mobile cards) — route: delegated
- [x] T17 — V-2 dialogs (A-10, A-16, S-4) — route: delegated
- [x] T18 — V-3 member file, read-only — route: delegated
- [x] T19 — V-3 edit mode + reveal (A-4, A-5) — route: delegated
- [x] T20 — V-3 leave/rejoin dialogs (A-6, A-7) — route: delegated
- [x] T21 — V-3 badges, card, member data, access link (A-8, A-9, A-11, A-15) — route: delegated
- [x] T22 — V-3 role card + S-3, V-5 roles — route: delegated
- [x] T23 — Audit renderer + V-4 activity — route: delegated
- [x] T24 — V-1 dashboard (replaces AdminDashboard) — route: delegated
- [x] T25 — V-6 tools + event images move + 308 redirect — route: delegated
- [x] T26 — V-7 member side: M-1 leave dialog, login help, neutral password reset via server action — route: delegated
- [x] T27 — M7 `roles_contract` + prod runbook + CLAUDE.md/README — route: delegated
- [x] T28 — UX fixes from the manual check: release the page when an AdminDialog starts closing, clear stale card notices on state change, drop networkidle waits in e2e/admin — route: delegated

## Acceptance criteria

- Every spec action A-*, S-* and rule BR-* is enforced in the database, not only in the UI.
- Every admin mutation writes exactly one audit entry in the same transaction.
- `npm run lint`, `npm test` and the affected E2E specs pass after each task.

## Final prod runbook (ordered, copy-pasteable)

Run top to bottom. Each step says whether it is safe before the code ships. Details and the
post-checks of every migration are in "Per-migration notes" below (item numbers in brackets).
Apply migrations **one file at a time** (Supabase MCP `apply_migration` or the SQL editor of the
production project), never `supabase db push` for this feature: it applies every pending file at
once and would skip the deploy-together point of phase 3.

### Phase 0 — prerequisites (no database change)

1. Backup: confirm a recent backup / point-in-time recovery exists for the production project.
2. Vercel (Production) already has `SMTP_USER`, `SMTP_PASSWORD` (leave/rejoin e-mails reuse the
   contact form transport), `ENCRYPTION_KEY` (unchanged), `SUPABASE_SERVICE_ROLE_KEY`, and
   `CRON_SECRET`. GitHub has the repository secret `CRON_SECRET` with the same value (the cache
   refresh and retention workflows use it). Do NOT create the variable `RETENTION_APPLY` yet.
3. Supabase → Authentication → URL configuration: the redirect allow-list contains
   `https://www.darkstone.cat/auth/callback` and `https://darkstone.cat/auth/callback` (the
   neutral password reset builds `redirectTo` from the request origin, T26), plus the existing
   `/auth/confirm` and `/auth/magic-link` URLs.
4. The earlier migrations `20261001100000_shared_rate_limiter.sql` and
   `20261001130000_unconfirmed_user_id.sql` are applied (previous features).

### Phase 1 — read-only checks (SQL editor, as `postgres`)

```sql
-- a) names M1 drops without IF EXISTS [1]: expect members_id_fkey, admins_update_all,
--    admins_select_all and member_badges_admins_select_all (the last two are dropped by T7b [8])
select conname from pg_constraint
 where conrelid = 'public.members'::regclass and conname = 'members_id_fkey';
select tablename, policyname from pg_policies
 where policyname in ('admins_update_all', 'admins_select_all', 'member_badges_admins_select_all');

-- b) postgres may write the Auth tables the leave/rejoin and retention functions touch [5, 12]
begin;
update auth.users set banned_until = banned_until where false;
delete from auth.sessions where false;
delete from auth.refresh_tokens where false;
delete from auth.users where false;
rollback;
-- If any statement is refused: stop. Leave/rejoin (T6) and retention (T12) need a change first.

-- c) member numbers: the sequence must be ahead of every stored number [11]
select (select last_value from public.member_number_seq) as seq_last_value,
       (select max(substring(member_number from 5)::int) from public.members
         where member_number ~ '^000-[0-9]+$') as max_number;
-- seq_last_value must be >= max_number, otherwise sign-ups collide: fix with setval first.

-- d) who holds a role today (all become board in M7; none can delete their account after M2/T8 [7])
select member_number, first_name, last_name, role from public.members
 where role <> 'member' order by member_number;
```

### Phase 2 — migrations safe before the code (in order)

Apply each file, then run its post-check from the notes:

1. `20261005100000_membership_state.sql` [1] — then check profile edit, gaming-account link and
   newsletter switch still save on the live site.
2. `20261005100100_roles_expand.sql` [2] — an admin still opens `/admin`.
3. `20261005100200_audit_log.sql` [3]
4. `20261005100300_admin_read_rpcs.sql` [4]
5. `20261005100400_membership_lifecycle.sql` [5]
6. `20261005100500_member_admin_mutations.sql` [6]
7. `20261005100600_roles_and_anonymise.sql` [7] — from here a role holder cannot delete their
   account (old "Dona't de baixa" fails for them until the deploy).

### Phase 3 — deploy window (apply, then deploy at once)

The live (pre-panel) code breaks between step 1 and the deploy: sign-up details and profile edits
of DNI/phone are refused, and the old `/admin` list and CSV are empty/500. Keep it short.

1. `20261005100700_lock_down_member_secrets.sql` [8]
2. `20261005100800_admin_exports.sql` [9]
3. `20261005100900_admin_exports_more.sql` [10]
4. `20261006100000_member_number_width.sql` [11]
5. `20261006100100_retention.sql` [12] (nothing runs it until phase 5)
6. `20261006100200_ops_job_runs.sql` [13]
7. `20261006100300_ops_record_actor.sql` [14]
8. `20261006100400_activity_hide_names.sql` [15]
9. Merge `develop-users` into `main` and let Vercel deploy production. Do NOT apply
   `20261007100000_roles_contract.sql` yet.

### Phase 4 — right after the deploy

1. Re-encrypt DNI/phone [8] (prod `ENCRYPTION_KEY` and service-role key in the shell
   environment, never in the repo):
   ```sh
   node scripts/reencrypt-member-secrets.mjs --dry-run   # expect errors=0 duplicates=0; exit 0
   node scripts/reencrypt-member-secrets.mjs --apply
   node scripts/reencrypt-member-secrets.mjs --dry-run   # expect legacy=0; exit 0
   ```
   Exit codes: 0 clean, 1 errors, 2 usage/environment, 3 duplicates (resolve every
   `duplicate_ciphertext` line before re-running). Keep the legacy decrypt fallback in the code.
2. Smoke checks as a board member: `/admin` shows figures and activity; `/admin/members` lists
   and searches; a member file opens; an A-10 CSV export downloads and leaves an
   `export.members_csv` entry in `/admin/activity`; a member's `/profile/edit` still shows their
   own DNI/phone. As a board member, `select dni_nie_encrypted from members where id <> auth.uid()`
   returns no rows.
3. Actions → Cache refresh → Run workflow; then `select job, ran_at, ok from ops_job_runs order by
   id desc limit 2` shows two rows [13]. (The workflow file was invalid YAML before T27; this is
   its first real run.)

### Phase 5 — retention activation [12]

1. Actions → Retention → Run workflow with `apply` unticked. The log shows `Mode: dry run` and
   the counts. Compare with the database (queries in item 12 step 3).
2. Confirm D-H (purge = `left_on` + 3 years) with the association: a purge cannot be undone.
3. Only then: a manual run with `apply` ticked, or the repository variable
   `RETENTION_APPLY=true` for the daily schedule. Delete the variable to stop deletions.

### Phase 6 — superadmin bootstrap (needs D-A)

`supabase/snippets/` is owned by root (Supabase Studio), so the snippet lives here. Replace the
two placeholders with the member numbers decided in D-A, paste the whole block into the SQL
editor (runs as `postgres`) and run it. It is one transaction: any failed check changes nothing.

```sql
-- Superadmin bootstrap (D-A). BR-10 allows promotions, so 0 → 1 → 2 works; BR-11 does not
-- apply (no auth.uid() in the SQL editor). Writes one role.grant entry per promotion
-- (actor "Sistema"). Tested locally in a rolled-back transaction (T27).
BEGIN;

DO $$
DECLARE
  -- D-A: replace these two placeholders ----------------------------------------------------------
  v_numbers constant text[] := ARRAY['<MEMBER_NUMBER_1>', '<MEMBER_NUMBER_2>'];
  --------------------------------------------------------------------------------------------------
  v_number text;
  v_id uuid;
  v_old_role text;
  v_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(v_numbers) AS n WHERE n LIKE '<%') THEN
    RAISE EXCEPTION 'promote_superadmins: replace the member number placeholders first';
  END IF;
  IF v_numbers[1] = v_numbers[2] THEN
    RAISE EXCEPTION 'promote_superadmins: the two member numbers must differ';
  END IF;

  FOREACH v_number IN ARRAY v_numbers LOOP
    v_id := NULL;
    SELECT m.id, m.role INTO v_id, v_old_role
    FROM public.members AS m
    JOIN auth.users AS u ON u.id = m.id
    WHERE m.member_number = v_number
      AND m.left_on IS NULL
      AND m.purged_at IS NULL
      AND u.email_confirmed_at IS NOT NULL
    FOR UPDATE OF m;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'promote_superadmins: % is not an active member with a confirmed login', v_number;
    END IF;

    IF v_old_role = 'superadmin' THEN
      RAISE NOTICE 'promote_superadmins: % is already superadmin, skipped', v_number;
      CONTINUE;
    END IF;

    UPDATE public.members SET role = 'superadmin' WHERE id = v_id;

    PERFORM public.audit_write(
      'role.grant',
      v_id,
      jsonb_build_object('from', v_old_role, 'to', 'superadmin'),
      'Superadmin bootstrap (prod runbook, D-A)'
    );

    RAISE NOTICE 'promote_superadmins: % promoted from %', v_number, v_old_role;
  END LOOP;

  SELECT count(*) INTO v_count
  FROM public.members AS m
  WHERE m.role = 'superadmin' AND m.left_on IS NULL;

  IF v_count <> 2 OR EXISTS (
    SELECT 1 FROM public.members AS m
    WHERE m.role = 'superadmin' AND m.left_on IS NULL AND NOT (m.member_number = ANY (v_numbers))
  ) THEN
    RAISE EXCEPTION 'promote_superadmins: expected exactly the two chosen members as superadmins, found %', v_count;
  END IF;
END;
$$;

-- Check before COMMIT: two rows, role superadmin, role_since = now.
SELECT member_number, first_name, last_name, role, role_since
FROM public.members
WHERE role = 'superadmin' AND left_on IS NULL
ORDER BY member_number;

COMMIT;
```

Rollback: before COMMIT nothing is written (any error aborts the block). After COMMIT, to swap
one person, promote the replacement first from the member file (Rol → Canvia el rol), then demote
the one leaving: with two superadmins BR-10 refuses every demotion. To undo the whole bootstrap
(exceptional, before M7 only): in one transaction as `postgres`, `ALTER TABLE public.members
DISABLE TRIGGER members_role_guard;`, set both roles back, `ALTER TABLE public.members ENABLE
TRIGGER members_role_guard;`, `COMMIT`.

After it: both superadmins sign in and see the "Rols" tab and `/admin/roles`.

### Phase 7 — M7 `20261007100000_roles_contract.sql` (last)

1. Apply it [16]. It refuses to run (nothing changes) with fewer than two active superadmins.
2. Check: `select role, count(*) from public.members group by role` shows no `admin`; former
   admins still open `/admin` (now as Junta); `select public.role_rank('admin')` is NULL.

### Phase 8 — follow-ups after production is done

1. Once phase 4 showed `legacy=0`: remove the legacy decrypt fallback from
   `src/lib/encryption.ts` and its tests (and the legacy branch of
   `scripts/reencrypt-member-secrets.mjs` if wanted).
2. Once M7 is applied: remove `admin` from `ROLES`/`RANKS` in `src/lib/auth/roles.ts` and its
   tests (keep the audit renderer's `actor_role = 'admin'` → Junta mapping for old entries).
3. Apply `odd/tasks/admin-panel-claude-md.md` to `CLAUDE.md` once `zona-socis-mockups-v2` has
   committed its CLAUDE.md changes.

## Per-migration notes (reference for the runbook)

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
7. `supabase/migrations/20261005100600_roles_and_anonymise.sql` (T8). Safe to apply before any
   code ships: nothing in `src/` calls `admin_set_role` or `admin_anonymise_member`. Needs M1–M6.
   Must be applied before T11b/T22 code is deployed. One shipped behaviour changes: the new
   `BEFORE DELETE` role guard makes the current `deleteAccount` (profile "Dona't de baixa") fail
   with its generic error for anyone holding `admin`/`board`/`superadmin` (BR-12), and an
   operator can no longer delete a role holder's account in the dashboard without removing the
   role first. Before applying, check that the people who must keep their role do not need to
   delete their account. After applying, as `postgres` in a transaction you roll back,
   `delete from public.members where role <> 'member' and left_on is null` fails with
   `role_guard:` (or touches no row), and as a board member
   `select public.admin_set_role(gen_random_uuid(), 'board')` fails with `admin:forbidden`.

8. `supabase/migrations/20261005100700_lock_down_member_secrets.sql` (T7b). Apply it and deploy
   the T7b code right after: the trigger `members_ciphertext_guard` refuses the legacy
   `iv:tag:data` writes of the code before T7b (sign-up details, profile edit fail until the
   deploy); reads of legacy values keep working on both versions. It also drops
   `admins_select_all` / `member_badges_admins_select_all` (the old `/admin` pages read
   through `get_all_members_for_admin()` with the session client, which now answers 42501, so
   the old `/admin` list and CSV export are empty/500 until the deploy), makes
   `get_all_members_for_admin()` service-role only, revokes TRUNCATE on `members` and
   `member_badges` from `service_role`, and replaces the BR-15 detector (v3) and
   `admin_update_member()`. Needs M1–M7. Steps:
   1. Apply the migration; deploy the T7b code at once.
   2. With the prod `ENCRYPTION_KEY` and service-role key in the environment (never in the
      repo): `node scripts/reencrypt-member-secrets.mjs --dry-run`. Expect `errors=0` and
      `duplicates=0`; any `! member=<id> column=<c> reason=<r>` line needs a look first
      (`duplicate_ciphertext` = a value copied between rows: decide which row owns it before
      touching it; `decrypt_failed` = wrong key or corrupt value).
   3. `node scripts/reencrypt-member-secrets.mjs --apply`, then `--dry-run` again: expect
      `legacy=0`.
   4. Check: as a board member, `select dni_nie_encrypted from members where id <> auth.uid()`
      returns no rows; `/admin/members` still shows masked DNI/phone; a member's
      `/profile/edit` still shows their own values.
   5. Follow-up (T27): once step 3 shows `legacy=0` on prod, remove the legacy decrypt
      fallback from `src/lib/encryption.ts` (and its tests). (Post-merge follow-up; not done in T27.)
   6. Script exit codes (T9b): 0 clean, 1 errors, 2 usage/environment, 3 duplicates found (and
      no errors). Exit 3 is evidence of the T7 exploit: resolve every `duplicate_ciphertext`
      line before re-running. `duplicates=0` is **not** proof that no copy happened: a victim
      who changed their value since the copy breaks the match.
   7. No rollback to pre-T7b code once v2 values exist: the old code cannot read `v2:` values
      and the trigger refuses its legacy writes, so every DNI/phone read and write breaks. Roll
      forward instead.

9. `supabase/migrations/20261005100800_admin_exports.sql` (T9a). Apply after item 8 (needs
   M1–M8: the BR-15 detector v3 and `members_ciphertext_guard`) and deploy the T9a code right
   after: it removes `export.members_csv` / `export.member_data` from `log_admin_event()`, but
   no shipped code logs them (the pre-T9a CSV route only writes a server log line), so applying
   it before the deploy breaks nothing; the pre-T9a route keeps working through the
   service-role `get_all_members_for_admin()` until the T9a code replaces it. Adds
   `admin_export_members`, `admin_export_member_data` and the internal
   `admin_member_data_former_min_role()`. After applying, as a plain member
   `select * from public.admin_export_members()` fails with `admin:forbidden`; after the
   deploy, an export from `/admin/members` leaves one `export.members_csv` entry
   (`select details from audit_log where action = 'export.members_csv' order by id desc
   limit 1` shows `{"filter":{"state":"active","role":"all"},"rows":<n>}`), and n equals the
   CSV's data lines. More than 1000 active members would hit PostgREST `max_rows`: the route
   then answers 500 instead of a partial file (raise `max_rows` or page the export first).
   (T9b adjusts the checks: the export is now `POST /api/admin/members/export` with a
   same-origin Origin header; the check after the deploy is a download from `/admin/members`.)

10. `supabase/migrations/20261005100900_admin_exports_more.sql` (T9b). Apply after item 9 and
    deploy the T9b code right after. Changes: `admin_export_member_data(uuid)` is dropped and
    replaced by `admin_export_member_data(uuid, text default null)` (a former member now needs
    a reason of 10+ characters; the T9a route calls it with one argument and keeps working for
    active members, so the gap between apply and deploy only refuses a superadmin's former-member
    export); adds `admin_export_emails` (A-16) and `admin_export_register` (S-4); removes
    `export.emails` and `export.member_register` from `log_admin_event()` (no shipped code logs
    them). The T9b code makes every export POST + same-origin Origin (`darkstone.cat`,
    `www.darkstone.cat`; localhost outside production only): exports never work on
    `*.vercel.app` previews, and the list in `src/lib/http/origin.ts` must change with the
    domain. After applying, as a plain member `select * from public.admin_export_emails('association')`
    fails with `admin:forbidden`, and as a board member `select * from
    public.admin_export_register('Requeriment de prova')` fails with `admin:forbidden`. After the
    deploy: a CSV export from `/admin/members` still downloads (the dialog now POSTs), and
    `curl -X POST https://www.darkstone.cat/api/admin/members/export` without an Origin answers
    403 `forbidden_origin`. A-16/S-4 have no UI until T17.

11. `supabase/migrations/20261006100000_member_number_width.sql` (T12). Apply any time, and
    before the association reaches member 1000: `generate_member_number()` truncated numbers
    past 999 (`lpad(n, 3, '0')`, '1196' → '119'), which makes sign-up fail on a duplicate
    number. Existing numbers keep their value; nothing else changes. After applying, as
    `postgres` `select public.member_number_format(1000)` returns `000-1000` and
    `select public.member_number_format(168)` returns `000-168`.

12. `supabase/migrations/20261006100100_retention.sql` (T12) + the retention route and workflow.
    Needs M1, M3 and T6 (items 1, 3, 5). Safe to apply before the code ships (nothing calls it).
    Steps:
    1. Before applying, in a transaction you roll back, check that `postgres` may delete from
       `auth.users` (the job deletes purged members' and stale unconfirmed accounts in the
       database so the deletion and its audit entry are atomic):
       `begin; delete from auth.users where false; rollback;`. If it is refused, do not set
       `RETENTION_APPLY`: an apply would fail atomically (nothing half-done), and the job must
       move the account deletion to `auth.admin.deleteUser` first.
    2. Apply the migration and deploy the code (route `/api/cron/retention`, workflow
       `.github/workflows/retention.yml` on `main`). `CRON_SECRET` is already set in Vercel and
       as a repository secret (cache refresh).
    3. First production run = **dry run**: Actions → Retention → Run workflow with `apply`
       unticked. The log shows `Mode: dry run` and the JSON counts (`membersPurged`,
       `unconfirmedDeleted`, `auditEntriesDeleted`). Check them against the database (as
       `postgres`: former members with `left_on + 3 years <= today` and `purged_at is null`;
       `auth.users` with `email_confirmed_at is null and created_at < now() - interval '30
       days'`; `audit_log` older than 3 years). Today expect members ≈ 0 and audit 0; the
       unconfirmed count is the backlog of abandoned sign-ups.
    4. When the counts are right, either run once by hand with `apply` ticked, or set the
       repository variable `RETENTION_APPLY=true` (Settings → Secrets and variables → Actions →
       Variables) so the daily schedule applies. Until then every scheduled run is a dry run.
       To stop deletions at any time, delete the variable (or set it to anything but `true`).
    5. After an apply: `select action, details from audit_log where action in ('member.purge',
       'account.purge_unconfirmed') order by id desc limit 5` shows the entries (actor NULL).
    6. D-H is still provisional (purge = `left_on` + 3 years, `member_purge_on()`): confirm it
       before setting `RETENTION_APPLY`, because a purge cannot be undone.

13. `supabase/migrations/20261006100200_ops_job_runs.sql` (T13). Needs M2 (item 2,
    `has_role`). Safe to apply before the code ships: it only adds `ops_job_runs` and four
    functions (one internal); nothing calls them yet. Apply it before (or with) the T13 code: if the code ships
    first, `/api/cron/refresh` still refreshes and answers as before, and only logs
    `[ops] record_job_run failed job=<job> code=<code>` once per job. After applying and
    deploying: the next scheduled refresh (or Actions → Cache refresh → Run workflow) leaves one
    row per job (`select job, ran_at, ok, actor_id, duration_ms, error_code from
    ops_job_runs order by id desc limit 4`, as `postgres`, `actor_id` NULL), and as a board
    member `select * from public.admin_ops_status()` returns the `ludoya` and `bgg` rows.

14. `supabase/migrations/20261006100300_ops_record_actor.sql` (T25, fix of T13). Needs item 13.
    Apply before (or with) the T25 code: the new code records manual refreshes through
    `ops_record_manual_job_run`, so without the migration they only log `[ops] record_job_run
    failed`. It DROPS `admin_record_job_run` (a board member could call it directly with fake
    ok/error rows) and adds the service-role-only `ops_record_manual_job_run(job, ok, duration_ms,
    error_code, actor)`, which refuses an actor that is not an active board+ member. If the OLD
    code is still deployed when you apply it, manual refreshes keep working but are not recorded
    (the old code calls the dropped function) until the new code ships. After applying, as a board
    member `select public.ops_record_manual_job_run('ludoya', true, 1, null, auth.uid())` fails
    with permission denied.

15. `supabase/migrations/20261006100400_activity_hide_names.sql` (T23 fix). Apply any time; it
    only replaces `admin_list_activity`. After applying, a `member.update` entry about an
    anonymised or purged member no longer carries `details.changes` (the old names).

16. `supabase/migrations/20261007100000_roles_contract.sql` (T27, M7). **Not safe before the code**
    and not before the superadmin bootstrap: the pre-panel code only lets `role = 'admin'` into
    `/admin`, so applying it under that code locks every admin out. Step 0 refuses to run when the
    database has members but fewer than two active superadmins (the bootstrap is the only way to
    get them: after M7 roles change only through `admin_set_role`, which needs a superadmin). It
    maps active `admin` → `board` (`role_since` kept: the role guard restamps only on a rank
    change, and both rank 1 while the UPDATE runs; a former member still holding `admin` becomes
    `member`), narrows `members_role_check` to member/board/superadmin, drops `admin` from
    `role_rank()`, and drops `get_all_members_for_admin()` and the type `admin_member_view`
    (no caller since T24). Old audit entries keep `actor_role = 'admin'` (shown as Junta). No
    rollback needed in practice; to undo, re-add `admin` to the CHECK and `role_rank()` (the
    dropped function has no caller).

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
- Independent read-only verification (tier `high`): PASS, no defects (authorization, single
  transaction, BR-4/5/8/12/20/22 and the Madrid date probed; the `admin_list_members` redefinition
  differs from T5 only in the two username predicates). Notes:
  - T26: add a test that a magic link and a recovery link are refused after a leave (relies on
    GoTrue's ban check and `is_email_confirmed`; untested today).
  - The audit `reason` column is never scanned for sensitive values: the dialogs (T19–T22) must
    tell people not to type a DNI or phone in reasons.
  - `current_joined_on DEFAULT CURRENT_DATE` (T1) is the UTC date, while T6 uses the Madrid date.
  - Test gaps: tests depend on running in order; not covered: BR-22 `not_found`, a legacy
    `admin`-role target, `reason_too_long` on a self-leave, phone/postal code still null after
    rejoin.

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
- Independent read-only verification (tier `high`): FAIL. The T7 code is sound, but a
  pre-existing HIGH defect breaks A-5/BR-16/BR-21: the RLS policy `admins_select_all`
  (`is_admin()`) plus table-wide SELECT lets any board session read every member's
  `dni_nie_encrypted`/`phone_encrypted` through PostgREST (confirmed by the parent in
  `pg_policies`); `get_all_members_for_admin()` (EXECUTE for authenticated) returns them too.
  Because AES-GCM is used without AAD, the ciphertext copied into the caller's own row
  (`members_update_own` grants those columns) decrypts on `/profile/edit`, with no audit entry.
  Second finding (LOW): BR-15 detector v2 misses `Telf.: 93 123 45 67`, `tel.:612345678`,
  `DNI/NIE: X1234567L`, `N.I.E. X1234567L`, `12,345,678Z`, `612_345_678`, non-integer numbers,
  keys `DNI/NIE`, `phone_no`, `mobile_number`. Both are corrected in T7b. The user chose
  (2026-10-05) to also bind ciphertext to its member with AAD in T7b.
  Notes: database locale dependence (prod ctype not verified); NBSP-only names pass the DB trim;
  test gaps (BR-22/purged targets, former-board caller, service_role denial).

### T8 — done (route: delegated)

- Commit: `feat(db): Add role management and anonymisation functions` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100600_roles_and_anonymise.sql`).
- Test-first: RED observed with the new T8 blocks in `roles.test.ts` and the new
  `tests/integration/roles-and-anonymise.test.ts` before the migration (27 of 62 failing:
  functions missing, deletions of role holders not refused); GREEN after `npm run db:reset`
  (62/62).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 66 files / 753 tests passed; `npm run test:integration` 21 files /
  365 tests passed (run twice, both green; no role holder left in `members` afterwards).
- Signatures (SECURITY DEFINER, `search_path ''`, EXECUTE for `authenticated` only; anon and
  service_role get "permission denied"; superadmin only via the internal
  `admin_assert_superadmin()`):
  - `admin_set_role(p_member_id uuid, p_role text, p_reason text = NULL)` RETURNS TABLE
    `(action text, role text, role_since timestamptz)`. `p_role` ∈ member | board | superadmin
    (never the legacy `admin`). Compared by rank: up → `role.grant`, down → `role.revoke`,
    details `{"from","to"}`, reason optional (the S-1/S-2 dialogs ask for none, ≤ 500). Same
    rank (incl. legacy admin → board) → `admin:role_unchanged`, no UPDATE, no entry (not a
    silent no-op, like the badges: a stale screen learns its state was out of date). BR-10/11/12
    are left to `members_role_guard` (the UPDATE raises `role_guard:*`, the call rolls back with
    no entry). Refuses to run outside READ COMMITTED (`admin:isolation`, 25000).
  - `admin_anonymise_member(p_member_id uuid, p_confirm_number text, p_reason text = NULL)`
    RETURNS TABLE `(member_number text, purge_on date)`. Superadmin only; target a former
    member, not purged (`admin_lock_member`); typed member number compared after trim. Deletes
    the badges, clears any leftover phone/postal code/usernames/newsletter (legacy rows; a
    leave already cleared them), rotates `card_token`, sets `anonymised_at`. Keeps names, DNI
    ciphertext, member number, all dates, `left_by` and `leave_reason` until the purge (spec
    §4.5 / S-3 dialog: "Queda bloquejat: el nom, el DNI, les dates"; the motiu goes with the
    purge, and `members_board_leave_has_reason` needs it until then). Audit `member.anonymise`
    details `{"badges_deleted": n, "purge_on": "YYYY-MM-DD"}`, reason optional. Second call →
    `admin:already_anonymised`, no entry (retry path). Tested: deleting the auth user afterwards
    keeps the stub (`on_auth_user_deleted` only deletes active rows), and the retry still answers
    `already_anonymised` without a login account.
- Role guard on DELETE: new trigger `members_role_delete_guard` (BEFORE DELETE on `members`,
  sibling of `members_role_guard`, same advisory lock). Former and plain members pass. An
  active role holder is refused: a superadmin with fewer than two other active superadmins →
  `role_guard:last_superadmin`; any other role holder (board, superadmin, legacy admin) →
  `role_guard:role_held` (23514). It fires inside `handle_deleted_user`, so
  `auth.admin.deleteUser` of a role holder fails as a whole (GoTrue answers 500 "Database error
  deleting user"; the auth user stays — tested); only a direct DELETE carries the prefix. No
  bypass for service role or owner. Unconfirmed sign-ups (prepareSignup, `account.purge_unconfirmed`),
  plain active members and former members delete as before (tested).
- Errors: `admin:forbidden` 42501; 22023 for `admin:not_found`, `admin:invalid_argument`,
  `admin:role_unchanged`, `admin:reason_too_long`, `admin:not_former`, `admin:confirm_mismatch`,
  `admin:already_anonymised`; `admin:isolation` 25000; `role_guard:self_role_change`,
  `role_guard:last_superadmin`, `role_guard:former_member_role`, `role_guard:role_held` 23514.
- Test fixtures: `deleteTestUser` (`tests/helpers/supabase.ts`) now removes the role before
  deleting; for the last two superadmins it calls the new `forceDemoteForTests(userId)`, a single
  `DO` block run as `postgres` that disables `members_role_guard` only inside its own
  transaction (the id is checked against a strict UUID pattern; `DO` takes no parameters). The
  T2 "single superadmin" test now reaches that state through it, and a new test proves that
  deleting a superadmin's account with two left is refused.
- For T11b: call both functions with the session client. Map `admin:*` and `role_guard:*`
  prefixes (`last_superadmin` → "Calen almenys dos superadmins…", `self_role_change` → "No pots
  canviar el teu propi rol.", `former_member_role` → BR-12 text, `role_unchanged` → refresh the
  screen). Anonymise flow: call `admin_anonymise_member`; on success OR
  `admin:already_anonymised`, call `auth.admin.deleteUser(id)` (service role) and treat a 404 as
  done; if the deletion fails, report it and let the superadmin retry the same action. The
  dialog's purge date comes from the returned `purge_on`.
- For T26: account self-deletion of a role holder is now refused by the database too
  (`deleteAccount` returns "failed"); `member_leave_self` returns `membership:role_held` first.
- Follow-up outside this task's surface: `e2e/helpers/supabase-admin.ts` `deleteTestUser` deletes
  the `e2e-admin` user (role `admin`) without removing the role first, so the e2e global
  teardown now logs "Could not delete user" and leaves that user; global setup reuses an
  existing user, so the next run still works. Demote before deleting there (T14 or the next task
  touching e2e helpers).
- Prod risk: runbook 7 (role holders can no longer delete their account until they lose the
  role). Concurrent role changes rely on READ COMMITTED (checked in `admin_set_role`).

### T7b — done (route: delegated)

- Commit: `fix(security): Stop board sessions from reading member secrets` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100700_lock_down_member_secrets.sql`).
- Test-first: RED observed before the code: `tests/unit/encryption.test.ts` 10 of 30 failing
  (no v2 / AAD), `tests/lib/masked-field.test.ts` 3 of 6, new
  `tests/integration/member-secrets-lockdown.test.ts` 38 of 64 (board reads, RPC grant, trigger,
  TRUNCATE, detector v3 misses); GREEN after the module and the migration. The script test
  (`tests/lib/reencrypt-member-secrets.test.ts`, 7) was written right after the script.
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 67 files / 778 tests passed; `npm run test:integration` 22 files / 430
  tests passed; `npx playwright test e2e/admin e2e/profile e2e/auth` 80 passed (teardown left no
  `e2e-*` user, so e2e-admin is deleted again); `node --env-file=.env.test.local
  scripts/reencrypt-member-secrets.mjs --dry-run` → `Summary: mode=dry-run rows=0 already_v2=0
  legacy=0 would_reencrypt=0 duplicates=0 errors=0` (empty local DB). Extra local smoke run: a
  legacy row went dry-run `would_reencrypt=1` → `--apply` `reencrypted=1` → dry-run
  `already_v2=1 legacy=0`.
- Encryption (`src/lib/encryption.ts`, still `server-only`): `encrypt(plain, memberId)` →
  `v2:<member uuid>:<iv>:<tag>:<data>` (AES-256-GCM, 12-byte IV, 16-byte tag, AAD
  `member:<uuid>`, uuid lower-cased); `decrypt(value, memberId)`: v2 needs the embedded owner
  to equal `memberId` and the AAD to verify; legacy `iv:tag:data` decrypts without AAD
  (transitional, removed in T27); anything else → `Invalid ciphertext…` (no value in errors).
  `ciphertextOwner(value)` returns a v2 value's owner. Every caller passes the row owner:
  sign-up `data.userId`, profile edit/export `user.id` / `member.id`, admin list/export `m.id`.
  Longest value ~120 chars (CHECK 512 fits).
- Deviation (format): the owner uuid is embedded in clear. Reason: `/profile/details`
  (`src/app/[locale]/profile/details/page.tsx`, uncommitted WIP of `zona-socis-mockups-v2`)
  calls `maskEncryptedField(value, mask, field)` without the member id and could not be edited.
  `maskEncryptedField` gained an optional 4th `memberId`; without it, it decrypts with the owner
  the value names, which is safe because the new trigger guarantees a stored v2 value names its
  own row and rewriting the owner breaks the tag. Follow-up for `zona-socis-mockups-v2`: pass
  `member.id` as the 4th argument on lines 64–65 of the details page.
- Database (migration 20261005100700): policies `admins_select_all` and
  `member_badges_admins_select_all` dropped. Evidence that nothing needed them: every
  session-client read in `src/` is own-row (`useAuthUser.ts:92`, `api/members/card/route.ts:28`,
  `api/profile/calendar/route.ts:22`, `admin/guard.ts:39`, `supabase/auth.ts:38,64`,
  `supabase/badges.ts:47-48`, `profile/details-actions.ts:29`, `profile/actions.ts:103,160`, all
  `.eq("id"|"member_id", user.id)`); the sign-up read uses the admin client; board reads go
  through SECURITY DEFINER `admin_*` functions or, until T27, the service-role
  `get_all_members_for_admin()`. That function: EXECUTE revoked from PUBLIC/anon/authenticated,
  granted to service_role; guard `auth.role() = 'service_role'` (also refuses the owner without
  that JWT), body unchanged. TRUNCATE on `members`/`member_badges` revoked from service_role,
  anon, authenticated (nothing in `src/`, `scripts/`, `tests/` truncates them; T8 verification).
  New trigger `members_ciphertext_guard` (BEFORE INSERT/UPDATE OF the two columns or id,
  SECURITY DEFINER) + `member_ciphertext_is_bound(text, uuid)`: a changed value must be NULL or
  v2 naming the row id (`members:ciphertext_unbound: <column>`, 23514), for every role; rows
  still holding legacy values update other columns normally. `admin_update_member()` checks the
  same rule plus ≤ 512 (`admin:invalid_value: <key> must be ciphertext bound to the member`).
  BR-15 detector v3 as documented in the migration header (every T7-verification miss is a test
  case; the v2 safe cases still pass).
- App: public server action `getAllMembers` (`src/lib/admin/actions.ts`) removed; new
  `src/lib/admin/members.ts` `listAllMembersForAdmin(actor)` (`server-only`, admin client, needs
  the actor returned by `requireRole`/`getAdminAccess`). `/admin`, `/admin/members` and the CSV
  export use it after their role check.
- Scripts: `scripts/reencrypt-member-secrets.mjs` (dry run by default, `--apply`; idempotent;
  compare-and-set per value; duplicate legacy ciphertext reported and skipped; per-value
  findings with id/column/reason only; exit 1 on errors). `scripts/migrate-members.mjs` now
  writes v2 through it. No npm script added (the runbook calls it directly).
- Tests adapted (why): fixtures that stored fake legacy ciphertext now store v2 bound to the row
  (`tests/helpers/cipher.ts`; admin-read-rpcs, membership-lifecycle, membership-state, roles,
  member-admin-mutations, which also gained legacy / other-member cases); admin-rpc, roles,
  rls, member-badges now assert that board sessions get 42501 / only their own row and badges;
  member-data-hardening reaches the length CHECK with a v2-shaped value; auth-flow,
  profile-update, signup, profile-actions, members-export pass/assert the member id; the export
  test asserts the admin client is used only after the role check.
- E2E helpers (T8 follow-up closed): `deleteTestUser` and `deleteTestUserById` demote to
  `member` with the service role before deleting.
- WIP files: none of the files modified by `zona-socis-mockups-v2` was edited (API kept
  backward-compatible, see Deviation).
- Size: about 1,800 authored lines without this document (tests ~910, migration ~375 of which
  ~145 are the copied `admin_update_member` body, scripts ~295, app ~240); over the 400-line
  heuristic because the fix only holds as a whole (policies, RPC grant, trigger and AAD land
  together, and every ciphertext fixture had to move to v2); not split.
- Prod risks: runbook 8 (apply and deploy together; re-encrypt; legacy fallback until then). A
  legacy ciphertext copied between rows before this migration still decrypts for the copier
  until the script runs; the script reports it as `duplicate_ciphertext` instead of binding it.
- Independent read-only verification (tier `high`): PASS, no blocking defects (a board session
  sees 0 other rows/badges; no views or realtime publications; the only ciphertext path is the
  audited `admin_reveal_sensitive`; crypto, trigger, script and detector v3 sound). Follow-ups
  (folded into T9b):
  - `scripts/reencrypt-member-secrets.mjs` exits 0 when `duplicates>0`; a duplicate is evidence
    of the T7 exploit, so exit non-zero.
  - Runbook 8: `duplicates=0` is not proof that no copy happened (a victim who changed their
    value since breaks the match); rolling back to pre-T7b code after v2 values exist breaks every
    DNI/phone read and write.
  - Detector misses compound keys (`telefono_movil`, `nie_number`, `dni_hash`); low risk because
    audit keys are set in code.

### T9a — done (route: delegated)

- Commit: `feat(admin): Add audited member and member-data exports` on `develop-users`
  (hash in `git log -- supabase/migrations/20261005100800_admin_exports.sql`).
- Test-first: RED observed before the code: `tests/server/api/members-export.test.ts` +
  `member-data-export.test.ts` 31 failing / 3 passing (route still on the admin client, A-11
  route missing); `tests/integration/admin-exports.test.ts` + `audit-log.test.ts` 13 failing /
  22 passing (functions missing, whitelist still open). GREEN after the migration
  (`npm run db:reset`) and the code: 124/124 in admin-exports, audit-log, admin-read-rpcs,
  roles; 51/51 in the two route files.
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 68 files / 813 tests passed; `npm run test:integration` 23 files / 444
  tests passed; `npx playwright test e2e/admin` 17 passed (incl. the new `exports.spec.ts`).
- Signatures (SECURITY DEFINER, `search_path ''`, VOLATILE, EXECUTE for `authenticated` only;
  anon and service_role get "permission denied"; board+ via `admin_assert_board()`):
  - `admin_export_members(p_role text = NULL)` RETURNS TABLE `(id, member_number, first_name,
    last_name, email, phone_encrypted, dni_nie_encrypted, postal_code, ludoya_username,
    bgg_username, role, newsletter_accepted, membership_start_date, current_joined_on,
    created_at, total_rows int)`. Active members only (BR-21), confirmed (BR-22), not purged,
    LEFT JOIN `auth.users`; ordered by member number. `p_role` NULL/'all' | member | board
    (incl. legacy admin) | superadmin, otherwise `admin:invalid_argument` (22023, no entry).
    Writes `export.members_csv` with details `{"filter":{"state":"active","role":…},"rows":n}`
    (n = rows returned, a JSON number) after `RETURN QUERY` and before the function returns:
    the rows reach the caller only if the entry was written. `total_rows` lets the route detect
    a response capped by PostgREST `max_rows` (1000).
  - `admin_export_member_data(p_member_id uuid)` RETURNS TABLE, one row `(id, member_number,
    state, email, first_name, last_name, phone_encrypted, dni_nie_encrypted, postal_code,
    ludoya_username, bgg_username, role, newsletter_accepted, membership_start_date,
    current_joined_on, left_on, left_by, leave_reason, created_at, badges jsonb [{key,
    awarded_at}])`, as stored. Locks the row (`admin_lock_member`: unknown, purged, unconfirmed →
    `admin:not_found` 22023). Former member: `has_role(admin_member_data_former_min_role())`,
    else `admin:forbidden` 42501 (D-D provisional, superadmin). Writes `export.member_data`
    (target the member, details `{"state":"active"|"former"}`) before the read.
  - Internal: `admin_member_data_former_min_role()` = `'superadmin'` (no API grant).
  - `log_admin_event()` whitelist now: `export.member_register`, `export.emails`,
    `member.send_access_link`, `ops.cache_refresh` (rest of the body unchanged).
- EXECUTE model (documented in the migration header): EXECUTE for `authenticated`, role checked
  inside, actor = `auth.uid()`; the routes call with the user's SESSION client after
  `getAdminAccess('board')`. Not service_role + actor parameter: the audit actor would be
  whatever the server passes and `auth.uid()` is NULL without a user JWT. Ciphertext reaching
  the route handler is fine (server; plain values only in the response body). A board session
  calling the RPC from the browser gets only AAD-bound v2 ciphertext it cannot decrypt (key is
  server-only) and cannot copy into its own row (`members_ciphertext_guard`), and the call is
  audited like a download; only the ciphertext length leaks.
- Routes:
  - `GET /api/admin/members/export` (`src/app/api/admin/members/export/route.ts`): 401/403 from
    `getAdminAccess('board')` before anything; query whitelist `role=all|member|board|superadmin`
    and `state=active` only (anything else, repeated keys, `state=former` → 400
    `{"error":"invalid_filter"}`); `admin_export_members` with the session client (no more
    `listAllMembersForAdmin` / service role here); DB 42501 → 403, other errors → 500 (log
    the code only); truncated response → 500. CSV: UTF-8 BOM, `escapeCsv` on every cell,
    columns `Número, Nom, Cognoms, Email, Telèfon, DNI/NIE, CP, Ludoya, BGG, Rol, Newsletter,
    Primera alta, Alta actual, Creat` (the old "Data alta" = membership_start_date is now
    "Primera alta"), DNI/phone decrypted with the row id (failure → empty cell), filename
    `darkstone_members_<YYYY-MM-DD>.csv` (`darkstone_members_<role>_<date>.csv` when filtered),
    `no-store`, one `[admin-export] user=<uuid> rows=<n>` line. Errors are JSON `{"error"}` with
    `no-store` (was plain text; `ExportConfirmDialog` only checks `res.ok`).
  - `GET /api/admin/members/<number>/data` (`src/app/api/admin/members/[number]/data/route.ts`,
    the V-3 URL shape) for A-11: 401/403; a number outside `[0-9A-Za-z-]{1,32}` → 404 without a DB
    call; `admin_get_member` resolves number → id (no row → 404), then
    `admin_export_member_data` (42501 → 403, `admin:not_found` → 404, `admin:invalid_argument`
    → 400, else 500). JSON attachment `darkstone-data-<number>.json` (same name as the member's
    own download), `application/json; charset=utf-8`, `no-store`, log line
    `[admin-export] user=<uuid> member_data=<member uuid>`.
  - Shared builders and error mapping: `src/lib/admin/exports.ts` (`server-only`):
    `parseMembersExportFilter`, `buildMembersCsv`, `buildMemberDataJson`, `exportErrorStatus`,
    `exportErrorResponse`, `MEMBERS_CSV_HEADERS`.
- Spec interpretations: A-10 "gains two columns" → the existing columns stay (Rol and Creat
  too, though the mockup's column list omits them) plus Primera alta / Alta actual. A-10 has no
  filter in the spec or the dialog; §5.1 records "filter used", so the only filter is the V-2
  role filter, and the state is always `active` (search and sort are not export filters). A-11
  "the same JSON the member can download themselves" → the exact keys of `exportProfileData`
  plus `current_joined_on`, `left_on`, `left_by`, `leave_reason` (data the association holds
  that the member's own download predates); no audit history and no role history (not personal
  data of the member's file in the spec's JSON). A former member's export returns the row as
  stored, so a legacy row that still holds a phone/postal code exports it (it is held).
- Deviations: none from the task, except that the A-11 route needs two RPCs (number → id via
  `admin_get_member`, then the export by id) because the task fixed the function signature to
  `p_member_id uuid` and the route to `[number]`.
- Tests adapted (why): `audit-log.test.ts` uses `member.send_access_link` / `export.emails`
  where it used the two removed keys, and asserts they are now refused;
  `admin-read-rpcs.test.ts` writes its A-11 activity fixture through `admin_export_member_data`
  (the former-member entry is inserted as `postgres`: board can no longer export a former
  member); `roles.test.ts` gains the superadmin A-11 cases (former member; anonymised former
  member without a login: email null, badges []).
- `/admin` and `/admin/members` still read through `listAllMembersForAdmin` (T16/T24 replace it;
  T27 drops `get_all_members_for_admin`).
- Follow-ups: T17 (A-10 dialog) passes `?role=` only if the dialog offers the filter; the
  dialog count "N socis actius" can come from `admin_stats`. T21 (A-11 action) calls
  `/api/admin/members/<number>/data` and hides "Exporta dades" for a board member on a former
  member (D-D). T27: CLAUDE.md export-route paragraph (now via `admin_export_members`, new A-11
  route; outside this task's surface because CLAUDE.md holds another feature's WIP). If D-D is
  decided as board, change `admin_member_data_former_min_role()` only (and the roles/exports
  tests).
- Prod risks: runbook 9. PostgREST `max_rows` 1000 caps the CSV (the route refuses a partial
  file; prod has ~190 rows). The A-11 function locks the member row for the length of the call.
- Independent read-only verification (tier `high`): FAIL on one MEDIUM spec defect, corrected in
  T9b: A-11 lets a superadmin download a former member's DNI without the written reason BR-21
  requires (probe: `export.member_data | {"state":"former"} | reason=NULL`), bypassing A-5's
  reason rule. Fix: for a former member require `p_reason` (same minimum as the reveal) and store
  it in the audit entry; make A-11 a POST with the reason in the body (never in a URL or log).
  Confirmed correct: audit-before-data (a forced `audit_write` failure returns no rows for both
  functions), data scope (BR-21/BR-22), route security, `log_admin_event` diff. Notes: add a
  fail-closed test (rolled-back trigger forcing the audit write to fail); CSV tests never check a
  purged stub; e2e has no successful A-11 download; GET exports can be triggered cross-site (file
  not readable by the attacker, entry written in the board member's name); never enable
  PostgREST `db-tx-end` overrides (`Prefer: tx=rollback` would drop the audit entry).

### T9b — done (route: delegated)

- Commit: `feat(admin): Add e-mail and register exports and require a reason for former members`
  on `develop-users` (hash in `git log -- supabase/migrations/20261005100900_admin_exports_more.sql`).
- Test-first: RED observed before the code: unit/route files (`tests/lib/http-origin.test.ts`,
  the two new route files, the POST rewrites of the A-10/A-11 route tests, the script exit-code
  cases) 82 failing + 3 suites failing to import; integration (`admin-exports`, `audit-log`,
  `roles`) 22 failing / 83 passing. The two fail-closed cases on the T9a functions passed at
  once (they pin existing behaviour). GREEN after the migration (`npm run db:reset`) and the
  code: 105/105 in the three integration files, 513/513 in `tests/lib` + `tests/server/api` +
  the dialog test.
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 74 files / 1048 tests passed; `npm run test:integration` 24 files / 472
  tests passed; `npx playwright test e2e/admin e2e/forms/contact.spec.ts` 29 passed (contact
  spec lives in `e2e/forms/`).
- Signatures (migration 20261005100900; SECURITY DEFINER, `search_path ''`, EXECUTE for
  `authenticated` only, anon/service_role "permission denied", audit before rows, fail closed):
  - `admin_export_member_data(p_member_id uuid, p_reason text = NULL)` (the one-argument
    version is dropped so no reasonless overload survives). Board+; reason trimmed, > 500 →
    `admin:reason_too_long`; former member: `admin_member_data_former_min_role()` (still
    superadmin, D-D) checked first (42501), then a reason of `admin_reveal_reason_min_length()`
    (10) characters or `admin:reason_required` (22023), no entry. The reason goes into the
    entry's `reason` column (active members: optional, stored when given). Same columns.
  - `admin_export_emails(p_list text)` RETURNS TABLE `(first_name, last_name, email,
    total_rows int)`. Board+. `association` = active (`left_on IS NULL`), not purged, confirmed
    login with an e-mail; `newsletter` = those with `newsletter_accepted IS TRUE` (BR-23);
    unknown/NULL list → `admin:invalid_argument`, no entry. Ordered by member number. Entry
    `export.emails`, no target, details `{"list":<list>,"rows":<n>}`.
  - `admin_export_register(p_reason text = NULL)` RETURNS TABLE `(id, member_number,
    first_name, last_name, dni_nie_encrypted, membership_start_date, current_joined_on,
    left_on, left_by, total_rows int)`. `has_role('superadmin')` first (`admin:forbidden`
    42501, so board never learns the reason rule), then reason length rules as above. Every
    member not purged whose login is absent or confirmed (BR-22), active and former
    (anonymised former members too). Entry `export.member_register`, no target, details
    `{"rows":<n>}` (§5.1 "row count"), reason in the reason column.
  - `log_admin_event()` whitelist now only `member.send_access_link`, `ops.cache_refresh`
    (the superadmin branch for the register key is gone with the key).
- Routes (all exports are now POST + same-origin Origin; GET answers 405 `method_not_allowed`
  with `Allow: POST`; order: origin 403 `{"error":"forbidden_origin"}` → session/role 401/403 →
  body (JSON object, empty = `{}`, > 4096 bytes 413 `payload_too_large`, otherwise 400) → DB;
  every response `no-store`; DB errors log the Postgres code only):
  - `POST /api/admin/members/export` (A-10): body `{ role?, state?: "active" }`, any other key
    or value, or a query string → 400 `invalid_filter`. CSV unchanged.
  - `POST /api/admin/members/<number>/data` (A-11): body `{ reason?: string | null }` (other
    keys or a non-string → 400 `invalid_request`); `admin:reason_required` / `reason_too_long`
    → 400 with that code. The reason is never logged.
  - `POST /api/admin/members/emails` (A-16, new): body `{ list: "association" | "newsletter",
    format?: "csv" | "json" }` (else 400 `invalid_request`). `csv` (default): BOM, `Nom,Cognoms,
    Email`, escapeCsv, `darkstone_emails_<list>_<date>.csv`. `json`: `{ list, count, addresses
    }` for "Copia les adreces" (no attachment). Log `[admin-export] user=<uuid> emails
    list=<list> rows=<n>`. Truncated response → 500.
  - `POST /api/admin/members/register` (S-4, new): `getAdminAccess('superadmin')`; body
    `{ reason }` (missing/blank → 400 `reason_required` without a DB call; non-string or other
    keys → 400 `invalid_request`). CSV: BOM, `Número,Nom,Cognoms,DNI/NIE,Primera alta,Alta
    actual,Data de baixa,Baixa per` (D-B), DNI decrypted with the row id (failure → empty),
    `Baixa per` `self` → `Soci`, `board` → `Junta`, `darkstone_llibre_socis_<date>.csv`. Log
    `[admin-export] user=<uuid> register rows=<n>`. Truncated response → 500.
  - Shared: `src/lib/http/origin.ts` `isAllowedOrigin(origin, { localhostPorts?,
    allowLocalhostEnv? })` + `SITE_ORIGINS`. The contact route uses it with `{ localhostPorts:
    [3000], allowLocalhostEnv: "CONTACT_ALLOW_LOCALHOST" }` (behaviour identical; its tests are
    unchanged and pass). The exports use the defaults: production origins, plus any
    `http://localhost:<port>` outside production (e2e runs on 3100), no production override.
    `src/lib/admin/exports.ts` gained `exportOriginError`, `exportMethodNotAllowed`,
    `readExportBody`, `parseMemberDataBody`, `parseRegisterBody`, `parseEmailsExportBody`,
    `exportDbErrorResponse`, `isTruncated`, `csvResponse`, `buildEmailsCsv`,
    `buildRegisterCsv`; `parseMembersExportFilter` now takes the body object;
    `exportErrorStatus` matches `admin:<code>` only up to `:`/space/end.
  - `ExportConfirmDialog` POSTs `{}` with `Content-Type: application/json` (new component test).
- Spec interpretations: A-16 lists = the two of BR-23 (`association`, `newsletter`), board+
  (spec table); former members, purged stubs and unconfirmed sign-ups never (BR-22/23); the two
  outputs map to `format` csv/json, each call audited (both expose the addresses). S-4 = every
  member except purged stubs (spec S-4) and unconfirmed sign-ups (BR-22: not members); a
  reason is required (10+), because the mockup's "legal purpose" checkbox predates D-B and the
  file now carries former members' DNI, which BR-21 reason-gates; the T17 dialog needs a
  reason textarea (and may keep the checkbox). Audit details of S-4 hold the row count only
  (§5.1); an active/former split was dropped because a second count would run on a different
  snapshot.
- T7b follow-ups closed: `scripts/reencrypt-member-secrets.mjs` exits 3 on duplicates (errors
  win with 1; 2 stays usage/env), `EXIT_CODES` / `exitCodeFor` exported and tested, header and
  runbook 8 document the codes; runbook 8 now says `duplicates=0` is no proof and that rolling
  back to pre-T7b code after v2 values exist breaks every DNI/phone read and write.
- T9a verification notes closed: fail-closed tests (one DO block as `postgres` with
  `auth.uid()` = a board member, a throwaway `BEFORE INSERT` trigger on `audit_log` that raises,
  the export in a sub-block, a final RAISE that reports `rows=-1` and rolls everything back) for
  `admin_export_members`, `admin_export_emails` and `admin_export_member_data`, plus a control
  probe that returns rows without the trigger; purged stub excluded from A-10, A-11 (404),
  A-16 and S-4; e2e successful A-11 download (board on e2e-member); GET exports are gone
  (cross-site trigger closed by POST + Origin).
- T11a verification notes (parent request, `src/lib/admin/action-errors.ts`): the prefix regex
  now needs `:`, whitespace or the end after the code (`admin:forbidden-x`, `admin:not_foundX`
  → `failed`) and the invalid_value key must end at a word boundary; both tables are read with
  `Object.hasOwn` (`__proto__`, `constructor`, `toString` → `invalid`). RED 6 failing first,
  then GREEN (47 cases).
- Tests adapted (why): `audit-log.test.ts` uses `ops.cache_refresh` where it used
  `export.emails` and expects both export keys refused; `roles.test.ts` asserts a superadmin can
  no longer log `export.member_register` directly, passes a reason to the former-member A-11
  cases and gains a purged member and an unconfirmed sign-up for S-4; the A-10/A-11 route
  tests moved to POST (shared helper `tests/helpers/admin-route.ts`).
- Deviations: exit code 3 (not 2) for duplicates, because 2 already meant usage/environment.
  The A-10 route refuses a query string instead of ignoring it (an old `?role=` link must not
  silently export everything). No i18n texts (no UI in this task).
- Follow-ups: T17 (A-16/S-4 dialogs) POSTs to the new routes; the counts in the dialogs
  ("168 adreces", "191 files") should come from a read RPC, not from an audited export call.
  T21 (A-11 action) adds the reason textarea for a former member. T27: CLAUDE.md export-route
  paragraphs (POST + Origin, new routes; outside this task's surface). Detector misses compound
  keys (T7b note) stay open, low risk.
- Size: about 2,300 authored lines without this document (tests + e2e ~1,360, migration ~340 of
  which ~150 are the copied `log_admin_event` / A-11 bodies, lib + routes + dialog ~610, script
  ~25); over the 400-line heuristic because the task bundles a correction, the CSRF change across
  all exports, two new exports and their tests; not split.
- Prod risks: runbook 10 (apply then deploy; exports refuse previews and any non-listed
  origin; a superadmin's former-member A-11 is refused between apply and deploy). The register
  file holds decrypted DNI of former members: the route never logs it, but the downloaded file
  is the most sensitive artefact of the panel (dialog warning in T17).

### T11a — done (route: delegated)

- Commit: `feat(admin): Add server actions to edit, reveal, badge and reissue cards` on
  `develop-users` (hash in `git log -- src/lib/admin/member-actions.ts`).
- Test-first: RED observed with `tests/lib/admin-action-errors.test.ts` and
  `tests/server/actions/admin-member-actions.test.ts` before the code (both files failed to
  import the missing modules); GREEN after (136/136). `tests/integration/admin-member-actions.test.ts`
  was written right after the code and passed on its first run (10/10).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 70 files /
  949 tests passed; `npm run test:integration` 24 files / 454 tests passed.
- `src/lib/admin/member-actions.ts` (`"use server"`). Every action: `getAdminAccess('board')`
  first (`unauthenticated` / `forbidden`), then the member id must be a UUID string (else
  `invalid`, lower-cased before use), then input validation, then the DB function with the
  user's SESSION client (never the service role). Logs only `[admin-member] <action> failed
  code=<Postgres code | encrypt | decrypt | unknown>`; never a DB message, value, name or reason.
  - `updateMember(memberId: string, input: MemberUpdateInput): Promise<{ changed: string[] } |
    { error }>` (A-4). `MemberUpdateInput = { first_name, last_name, postal_code?,
    ludoya_username?, bgg_username?, phone?, dni? }`. Names always required (trimmed, 1..100,
    as `updateMemberProfile`). Optional keys are patched only when present and not `undefined`;
    `""`/`null` clears; postal code / usernames / phone / DNI use the profile rules and helpers
    (`isValidPostalCode`, `normalizeUsername`, `isValidPhone`, `isValidDniNie`). DNI/phone are
    encrypted with `encrypt(plain, memberId)` (the TARGET id) and sent only when present: the
    UI must send them only if the admin edited the field. Other keys (e-mail, role, …) are
    ignored. Returns the DB's changed audit field names (`first_name, last_name, postal_code,
    ludoya_username, bgg_username, phone, dni`); empty for a no-op. Revalidates
    `/[locale]/admin/members` and `/[locale]/admin/members/[number]` (`page`) only when
    something changed.
  - `revealSensitive(memberId: string, field: 'dni' | 'phone', reason?: string | null):
    Promise<{ value: string } | { error }>` (A-5). Reason trimmed, blank → null, > 500 code
    points → `reason_too_long` before the DB; the 10-character minimum for a former member's DNI
    is left to the DB (`reason_required`, D-E). Decrypts with `decrypt(value, memberId)`; a
    value bound to another member → `failed`. No revalidation (value shown on that screen only;
    the member file's activity list refreshes on the next navigation).
  - `awardBadge(memberId: string, badgeKey: string, note?: string | null): Promise<{ ok: true;
    awardedAt: string | null } | { error }>`, `revokeBadge(memberId: string, badgeKey: string,
    reason?: string | null): Promise<{ ok: true } | { error }>` (A-8). Key must match
    `^[a-z0-9_]{1,64}$` (else `invalid_badge`, no DB call); the catalogue is checked by the DB
    (`admin:invalid_argument` → `invalid_badge`). Note/reason as the reveal reason. Revalidate
    both pages.
  - `regenerateCard(memberId: string): Promise<{ ok: true } | { error }>` (A-9). Never returns
    or logs the token. Revalidates both pages.
- `src/lib/admin/action-errors.ts` (pure): `AdminActionError`, `adminDbErrorCode(error)`,
  `isMemberId(value)`. Full code list (T19/T21 map these to texts): `unauthenticated`,
  `forbidden`, `invalid`, `not_found`, `not_active`, `invalid_name`, `invalid_phone`,
  `invalid_dni`, `invalid_postal_code`, `invalid_username`, `reason_required`,
  `reason_too_long`, `no_value`, `badge_held`, `badge_not_held`, `invalid_badge`, `failed`.
  Mapping (prefix read from the start of `error.message` only): `admin:forbidden`,
  `audit:forbidden`, bare SQLSTATE 42501 → `forbidden`; `admin:not_found` → `not_found`;
  `admin:not_active` → `not_active`; `admin:invalid_argument` → `invalid` (badge actions:
  `invalid_badge`); `admin:invalid_value: <key>` → `first_name`/`last_name` `invalid_name`,
  `postal_code` `invalid_postal_code`, `*_username` `invalid_username`, `phone_encrypted`
  `invalid_phone`, `dni_nie_encrypted` `invalid_dni`, other keys `invalid`; `admin:no_value`,
  `admin:reason_required`, `admin:reason_too_long`, `admin:badge_held`, `admin:badge_not_held`
  → same name; `audit:sensitive_details` → `invalid_name` (names are the only free text these
  actions put in audit details); anything else (`members:ciphertext_unbound`, `admin:isolation`,
  network, unknown prefixes) → `failed`.
- Codes per action: update `unauthenticated, forbidden, invalid, invalid_name, invalid_phone,
  invalid_dni, invalid_postal_code, invalid_username, not_found, not_active, failed`; reveal
  `unauthenticated, forbidden, invalid, reason_required, reason_too_long, no_value, not_found,
  failed`; award/revoke `unauthenticated, forbidden, invalid, invalid_badge, reason_too_long,
  badge_held | badge_not_held, not_found, not_active, failed`; regenerate `unauthenticated,
  forbidden, invalid, not_found, not_active, failed`.
- Tests: unit (guard denial paths for all five; validation without DB call; non-string input;
  real AES-GCM round-trip with the target id and failure with another id; DNI/phone/optional
  keys omitted when absent; error mapping per prefix; console spied for values, reasons, names
  and DB messages; token never returned). Integration with real board / member session clients
  (only `createClient` and `revalidatePath` mocked): encrypted DNI/phone accepted by
  `members_ciphertext_guard` and decrypt to the original; no-op keeps ciphertext and writes no
  entry; reveal returns the plaintext and its audit entry holds only `{field}` + reason; badges
  held/not held/catalogue/former; card token rotates. No superadmin (former-member DNI reveal by
  a superadmin stays covered by `roles.test.ts`).
- Deviations: a malformed member id answers `invalid` (not `not_found`); `awardBadge` also
  returns `awardedAt` (the A-8 dialog shows "Ja la té des del …"). No i18n texts added.
- Prod risk: none beyond runbooks 6 and 8 (functions and ciphertext guard must be live).

### T10 — done (route: delegated)

- Commit: `feat(admin): Add leave and rejoin actions with membership e-mails` on `develop-users`
  (hash in `git log -- src/lib/admin/membership-actions.ts`).
- Test-first: RED observed with `tests/lib/admin-action-errors.test.ts` (new membership block,
  14 failing), `tests/lib/mail.test.ts`, `tests/lib/mail-membership-templates.test.ts`,
  `tests/server/actions/membership-actions.test.ts` and `tests/server/actions/leave-actions.test.ts`
  (all four failed to import the missing modules); GREEN after (296/296 with the contact and
  T11a action tests). `tests/integration/membership-actions.test.ts` was written right after the
  code and passed on its first run (8/8).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 78 files /
  1152 tests passed; `npm run test:integration` 25 files / 480 tests passed;
  `npx playwright test e2e/forms/contact.spec.ts` 10 passed (incl. setup/teardown).
- `src/lib/mail/` (`server-only`): `index.ts` holds the Workspace SMTP transport (moved verbatim
  from the contact route: `smtp.gmail.com:465`, TLS, timeouts 5 s / 5 s / 15 s, created once at
  import), `SENDER_EMAIL`, `CONTACT_EMAIL` and `sendMail(message, { logTag }): Promise<{ ok: true }
  | { ok: false; code: string | null }>`; `message = { to, subject, text?, html?, replyTo?,
  fromName? }` (text or html required; sender `"<fromName>" <no-reply@darkstone.cat>`, default
  name "Darkstone Catalunya"). Never throws; on failure logs only `[<logTag>] SMTP error { code,
  responseCode, command }`. `html.ts`: `escapeHtml` (same function the route had).
- Contact route refactor: uses `sendMail` with `fromName: "Web [darkstone.cat]"`, `logTag:
  "contact"` and the shared `escapeHtml`; same message, same `[contact] SMTP error` log, same
  500 `send_failed`. `tests/server/api/contact.test.ts` passes unchanged (its `nodemailer` mock
  applies to the module the route now imports). Only difference: a thrown non-object (string,
  null) no longer crashes the catch block.
- `src/lib/mail/templates/membership.ts` (pure): `boardLeaveEmail({ firstName, memberNumber,
  leftOn, reason })`, `rejoinEmail({ firstName, memberNumber })` → `{ subject, text, html }`.
  Catalan only (D-C). Every interpolation is HTML-escaped; the reason keeps its line breaks
  (`<br />`). No DNI/phone input. **No self-leave e-mail**: the spec (M-1) defines none.
- `src/lib/admin/membership-actions.ts` (`"use server"`), same pattern as T11a
  (`getAdminAccess('board')` first, UUID check → `invalid`, session client only, logs only
  `[admin-member] <action> failed code=<Postgres code>`; the e-mail address, name and reason are
  never logged):
  - `leaveMember(memberId: string, reason: string, leftOn?: string | null): Promise<{ ok: true;
    emailSent: boolean } | { error }>` (A-6). Reason trimmed: missing/blank → `reason_required`,
    not a string → `invalid`, > 500 code points → `reason_too_long`, all before the DB; the
    minimum (5) is left to the DB. `leftOn` omitted/null/"" → NULL (Madrid today in the DB); a
    real `YYYY-MM-DD` date otherwise, else `invalid_date` (no DB call). Codes: `unauthenticated,
    forbidden, invalid, reason_required, reason_too_long, invalid_date, not_found, self_target,
    not_active, role_held, failed`.
  - `rejoinMember(memberId: string, channel: 'form' | 'email' | 'in_person' | 'other', note?:
    string | null): Promise<{ ok: true; emailSent: boolean } | { error }>` (A-7). Unknown channel
    → `invalid_channel`, note > 500 → `note_too_long`, not a string → `invalid` (no DB call). The
    note is not in the e-mail. Codes: `unauthenticated, forbidden, invalid, invalid_channel,
    note_too_long, not_found, not_former, register_closed, no_login, failed`.
  - Both: after the DB call succeeds, revalidate `/[locale]/admin/members` and
    `/[locale]/admin/members/[number]` (`page`), then e-mail the returned address (skipped when
    NULL/empty → `emailSent: false`). An SMTP failure returns `{ ok: true, emailSent: false }`
    and logs only `[membership-mail] SMTP error { code, responseCode, command }`: the change is
    never rolled back or hidden. T20 must show a "the e-mail could not be sent" notice when
    `emailSent` is false (the board then writes to the member by hand).
- `src/lib/admin/action-context.ts` (`server-only`, not a server action): the guard + UUID step,
  the failure log and the revalidation, shared by `member-actions.ts` (T11a, now imports them;
  behaviour unchanged, its tests pass untouched) and `membership-actions.ts`.
- `src/lib/profile/leave-actions.ts` (`"use server"`): `leaveAssociation(reason?: string | null):
  Promise<{ ok: true } | { error: 'unauthenticated' | 'invalid' | 'role_held' | 'not_active' |
  'reason_too_long' | 'failed' }>` (M-1). Signed-in user required (`getUser`), optional reason
  (trimmed, > 500 → `reason_too_long`), `member_leave_self`, then `signOutCurrentSession()`
  (reused unchanged; its result is ignored because the DB already deleted every session, and
  supabase-js still clears the cookies), then revalidates the admin member pages. No e-mail.
  `membership:forbidden` → `unauthenticated`; other unexpected codes → `failed`. Logs only
  `[member-leave] failed code=<Postgres code>`. No UI wired and `deleteAccount` untouched (T26).
- `src/lib/admin/action-errors.ts`: new codes `self_target, role_held, invalid_date, not_former,
  register_closed, no_login, invalid_channel, note_too_long`; every `membership:<code>` prefix of
  T6 maps to the same name (`membership:forbidden` → `forbidden`). Boundary and own-key rules
  unchanged and tested for the new prefix (`membership:__proto__`, `membership:role_heldX` →
  `failed`).
- Integration (`tests/integration/membership-actions.test.ts`, only `createClient`,
  `revalidatePath` and `@/lib/mail` mocked): member session refused; DB rules mapped
  (`reason_required`, `invalid_date`, `self_target`, `not_active`, `not_former`); a board leave
  sets `left_on` = Madrid today / `left_by` board / trimmed reason, writes one `membership.leave`
  entry with the board actor, e-mails the account address with the reason and the member
  number, and the password stops working; rejoin with a failing SMTP answers `emailSent: false`,
  restores the row (same number, new card token), writes one `membership.rejoin` entry with the
  channel and note, and the old password works again; M-1 refuses a role holder (`role_held`),
  closes the caller's row with `left_by` self and actor = target, clears the client session and
  sends nothing.
- E-mail copy (Catalan, **for the user to review**; the mockups mark both templates as missing,
  only the rejoin subject comes from the spec). Text version; the HTML version has the same
  wording with the reason in a blockquote and links for `hola@darkstone.cat`, the profile and
  the site:
  - A-6 · subject "Baixa de Darkstone Catalunya":
    > Hola, {nom}:
    >
    > La junta de Darkstone Catalunya t'ha donat de baixa com a soci (número {número}) amb data
    > {d/m/aaaa}.
    >
    > Motiu de la baixa:
    > {motiu}
    >
    > Des d'ara ja no pots entrar a la zona de socis i el teu carnet deixa de ser vàlid. Hem
    > esborrat el teu telèfon, el codi postal i els usuaris de joc. El registre de soci es
    > conserva bloquejat durant 3 anys i després es destrueix.
    >
    > Si tens dubtes sobre aquesta decisió o vols tornar a ser soci, escriu-nos a
    > hola@darkstone.cat.
    >
    > Darkstone Catalunya
    > https://www.darkstone.cat
  - A-7 · subject "Tornes a ser soci de Darkstone Catalunya":
    > Hola, {nom}:
    >
    > Ens alegra tornar-te a tenir amb nosaltres. La junta t'ha reincorporat com a soci de
    > Darkstone Catalunya i mantens el mateix número de soci, {número}.
    >
    > Pots entrar a la zona de socis amb el mateix correu i la mateixa contrasenya que tenies:
    > https://www.darkstone.cat/profile
    >
    > - Tens un carnet nou a l'apartat «Carnet». L'anterior ja no funciona.
    > - El butlletí està desactivat. Si el vols rebre, activa'l des del teu perfil.
    > - El telèfon, el codi postal i els usuaris de joc es van esborrar amb la baixa. Els pots
    >   tornar a afegir des de «Completa el perfil».
    >
    > Si no recordes la contrasenya, la pots recuperar des de la pàgina d'inici de sessió.
    >
    > Per a qualsevol dubte, escriu-nos a hola@darkstone.cat.
    >
    > Darkstone Catalunya
    > https://www.darkstone.cat
- Size: ~1,414 authored lines (about 560 code, 850 tests), over the 400 heuristic; delivery
  strategy `exception-ok`.
- Deviations: no self-leave e-mail (spec defines none); blank leave reason refused before the DB
  (`reason_required`), length minimum still DB-only; the leave/rejoin returns `emailSent` and
  the M-1 action returns only `{ ok: true }`.
- Prod risk: needs runbook 5 (T6 functions) and `SMTP_USER`/`SMTP_PASSWORD` in Vercel (already
  set for the contact form). The "Si no recordes la contrasenya" line relies on recovery
  working for a reinstated member (T26 neutral reset must allow active members).
- Independent read-only verification (tier `high`): PASS, no defects (guards first, no callable
  helper exports, CRLF/HTML-safe mail, copy matches DB behaviour, contact route identical,
  mail failure never rolls back). Notes, folded into T12: `leaveAssociation` validates the reason
  before `getUser()` (authorise first); `sendMail` interpolates `fromName` unescaped (constant
  today; restrict or quote it). User review: the A-6 line "es conserva bloquejat durant 3 anys i
  després es destrueix" describes the T12 purge (D-H provisional).

### T11b — done (route: delegated)

- Commit: `feat(admin): Add access link, role and anonymise actions` on `develop-users` (hash in
  `git log -- src/lib/admin/superadmin-actions.ts`).
- Test-first: RED observed with the new block in `tests/lib/admin-action-errors.test.ts` (9
  failing) and `tests/server/actions/access-link-actions.test.ts` /
  `tests/server/actions/superadmin-actions.test.ts` (both failed to import the missing modules);
  GREEN after (12 files / 412 tests in `tests/lib/admin-action-errors.test.ts` +
  `tests/server/actions/`). The integration tests (`tests/integration/access-link-action.test.ts`,
  new block in `roles.test.ts`) were written right after the code and passed on their first run.
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 80 files /
  1237 tests passed; `npm run test:integration` 26 files / 493 tests passed (twice, after
  `npm run db:reset`; see the environment note below).
- `src/lib/supabase/magic-link.ts` (`server-only`): `sendMagicLinkOtp(email): Promise<{ ok: true }
  | { ok: false; throttled; code; status }>`, the sender moved out of `requestMagicLink`
  (cookie-less publishable client, `signInWithOtp({ email, options: { shouldCreateUser: false } })`,
  same "Magic link" template). `requestMagicLink` uses it with unchanged behaviour (its tests pass
  untouched). Callers must have checked the account is confirmed.
- `src/lib/admin/action-context.ts`: new `authoriseOnMember(min, memberId)` (`authoriseBoardOnMember`
  is now a wrapper) and `revalidateRolePages()` (`/[locale]/admin/roles`, `page`).
- `src/lib/admin/access-actions.ts` (`"use server"`): `sendAccessLink(memberId: string):
  Promise<{ ok: true } | { error: 'rate_limited'; retryAfter: number | null } | { error }>` (A-15).
  Steps: `getAdminAccess('board')` + UUID → id → member number with the service role (one column;
  since T7b a board session cannot read other rows) → `admin_get_member` with the SESSION client
  (no row: purged or unconfirmed sign-up, BR-22 → `not_found`) → `state` must be active
  (`not_active`), `has_login` and a non-blank e-mail (`no_login`) → shared limiter
  `allowRequestShared('access-link:<member uuid>', null, 1, 10 min)` (bucket = that literal
  string, no HMAC: a member id, not an IP) → `log_admin_event('member.send_access_link', target,
  {}, null)` with the SESSION client, fail closed (no entry, no mail) → send to the account
  e-mail. Never takes, returns or logs the address. `retryAfter` = seconds left from the last
  `member.send_access_link` entry for the member (board reads `audit_log`), null when unknown.
  The bucket is consumed before the entry is written, so a refused attempt never leaves an entry
  claiming a send; the cost is that a failed audit write blocks that member for 10 minutes. A
  sender failure after the entry → `send_failed` (entry kept as the record of the attempt);
  GoTrue's own throttle → `rate_limited` with `retryAfter: null`. Codes: `unauthenticated,
  forbidden, invalid, not_found, not_active, no_login, rate_limited, send_failed, failed`.
- `src/lib/admin/superadmin-actions.ts` (`"use server"`), `getAdminAccess('superadmin')` first,
  SESSION client for both T8 functions (the admin client is used only for `deleteUser`):
  - `setMemberRole(memberId: string, role: 'member' | 'board' | 'superadmin', reason?: string |
    null): Promise<{ ok: true; action: 'role.grant' | 'role.revoke'; role; roleSince: string |
    null } | { error }>` (S-1, S-2). Role checked before the DB (`invalid_role`, also for the
    legacy `admin`); reason trimmed, blank → null, > 500 → `reason_too_long`, not a string →
    `invalid`. Revalidates the member pages and `/[locale]/admin/roles`. Codes: `unauthenticated,
    forbidden, invalid, invalid_role, reason_too_long, not_found, role_unchanged (refresh the
    screen), self_role_change, last_superadmin, former_member_role, role_held, failed`
    (`admin:isolation` → `failed`).
  - `anonymiseMember(memberId: string, confirmNumber: string, reason?: string | null):
    Promise<{ ok: true; accountDeleted: boolean; alreadyAnonymised: boolean; purgeOn: string |
    null } | { error }>` (S-3). Confirmation trimmed; blank or > 32 characters →
    `confirm_mismatch` without a DB call; not a string → `invalid`. Then `admin_anonymise_member`,
    then `createAdminClient().auth.admin.deleteUser(id)`; 404 / `user_not_found` counts as deleted;
    any other failure → `{ ok: true, accountDeleted: false }` and logs only
    `[admin-member] anonymise_delete_account failed code=<code>`. Codes: `unauthenticated,
    forbidden, invalid, confirm_mismatch, reason_too_long, not_found, not_former, failed`.
  - Retry semantics (idempotent): `admin:already_anonymised` is not returned as an error. The DB
    raises it only after the superadmin, former-member and confirmation checks (a retry with a
    wrong number is still `confirm_mismatch`), so the action deletes the account again and answers
    `{ ok: true, alreadyAnonymised: true, purgeOn: null }`. T22: when `accountDeleted` is false,
    say the record is anonymised but the login account is not deleted yet and offer the same
    action again; the purge date comes from `purgeOn` (or the member file on a retry).
- `src/lib/admin/action-errors.ts`: new codes `rate_limited, send_failed, invalid_role,
  role_unchanged, self_role_change, last_superadmin, former_member_role, confirm_mismatch,
  already_anonymised`; prefixes `role_guard:{self_role_change,last_superadmin,former_member_role,
  role_held}`, `admin:{role_unchanged,confirm_mismatch,not_former,already_anonymised}` map to
  the same names; `audit:invalid_target` → `not_active` (only the access link logs with a
  target); `admin:isolation` stays `failed` (tested). Boundary and own-key rules tested for
  `role_guard:` (`role_guard:__proto__`, `role_guard:last_superadmins` → `failed`).
- Tests: unit (guard denial incl. board refused for both superadmin actions; validation without
  DB call; the session client used for `admin_get_member`, `log_admin_event`, `admin_set_role`,
  `admin_anonymise_member` and the admin client's `rpc` never called; exact step order limit →
  entry → send; fail closed on an audit error; limiter path with `retryAfter` from the last
  entry; former / no login / unconfirmed refusals; address never returned or logged; anonymise
  retry and deletion failure). Integration: `access-link-action.test.ts` (real board session;
  member refused; former → `not_active`, unconfirmed → `not_found`; one entry with the board
  actor and `{}` details; one `rate_limit_hits` row in bucket `access-link:<uuid>`; second call
  `rate_limited` with ~600 s; limit is per member). `roles.test.ts` new block "superadmin actions
  (S-1, S-2, S-3)" with real superadmin JWTs: board refused; grant/revoke with one entry each;
  `role_unchanged`; `self_role_change`; `last_superadmin` (count stays 2);
  `former_member_role`; anonymise `not_former` / `confirm_mismatch` / success (auth user gone,
  stub kept, badges gone, one entry) / idempotent retry.
- Environment note: the first `test:integration` runs failed in `createTestUser` with "Database
  error creating new user": the local `member_number_seq` had passed 999 after many test runs, and
  `generate_member_number()` uses `lpad(nextval, 3, '0')`, which TRUNCATES longer values
  (`1196` → `119`), so new numbers collided with `members_member_number_key`. `npm run db:reset`
  fixed it locally. **Prod risk (not in this task's surface)**: the same function will collide
  once the association reaches member 1000; fix it in a migration (e.g. no truncation past 3
  digits) before then (T27 or a separate fix).
- Deviations: the member id is resolved to a number with the service role (one column) because
  `admin_get_member` takes a member number; `retryAfter` is derived from the audit log (the shared
  limiter only answers allowed/refused); `anonymiseMember` also returns `alreadyAnonymised` and
  `purgeOn`; an unconfirmed sign-up is `not_found` (hidden by BR-22), not a separate code.
  No i18n texts added (T21/T22).
- Prod risk: needs runbooks 3, 4 and 7 (`log_admin_event`, `admin_get_member`, T8 functions)
  and the shared limiter migration (`20261001100000`); without the limiter table the per-member
  limit falls back to one instance's memory.

### T12 — done (route: delegated)

- Commits on `develop-users`: `fix(db): Stop member numbers from truncating past 999` (3770eea)
  and `feat(admin): Add the daily retention job` (hash in
  `git log -- supabase/migrations/20261006100100_retention.sql`).
- Test-first: RED observed for `tests/integration/member-number.test.ts` (6 of 7 failing:
  `member_number_format` missing), `tests/integration/retention.test.ts` (every test failing:
  functions missing), `tests/server/api/cron-retention.test.ts` (import of the missing route),
  the new `sender` cases in `tests/lib/mail.test.ts` (2 failing) and the authorise-first case in
  `tests/server/actions/leave-actions.test.ts` (1 failing); GREEN after `npm run db:reset`.
  `tests/lib/retention-workflow.test.ts` (static checks of the YAML text; no YAML parser is
  installed, `python3 yaml.safe_load` parsed it with `apply.default: False`) was written right
  after the workflow and passed on its first run.
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 82 files / 1249 tests passed; `npm run test:integration` 28 files /
  511 tests passed; `npx playwright test e2e/forms/contact.spec.ts` 10 passed (incl.
  setup/teardown).
- Member number (fix from the T11b environment note): `member_number_format(n bigint)`
  (IMMUTABLE, `search_path ''`, EXECUTE service_role + owner) = `'000-' || lpad(n,
  greatest(3, length(n)), '0')`: `000-007`, `000-999`, `000-1000`. `generate_member_number()`
  calls it (same grants). `member_number` has no length CHECK; the admin list sort key (digits
  padded to 20) orders `000-1000` after `000-999` (tested). The tests that matched
  `^000-\d{3}$` now accept `\d{3,}`. Tested through the format helper, not by moving the
  shared sequence (other files create users in parallel).
- `member_purge_on(p_left_on date) → date` (internal, no API grant): `left_on + 3 years` (D-H).
  `admin_get_member().purge_on` and `admin_anonymise_member()` keep the same expression inline
  (not redefined here).
- `run_retention(p_dry_run boolean DEFAULT true)` RETURNS TABLE `(dry_run boolean,
  members_purged int, unconfirmed_deleted int, audit_entries_deleted int)`: SECURITY DEFINER,
  `search_path ''`, EXECUTE service_role only (and postgres); anon/authenticated 42501 (tested).
  NULL → dry run. It calls the internal `retention_run(p_dry_run, p_only uuid[])` with
  `p_only` NULL; `p_only` limits every step to the given ids and exists for the integration
  tests (run as postgres on their own fixtures, since other files hold former members, unconfirmed
  sign-ups and 1999 audit rows of their own). One transaction, serialised by an advisory lock:
  1. Purge: former members (`left_on` set, `purged_at` NULL) with `member_purge_on(left_on) <=
     membership_today()` (Madrid), `FOR UPDATE`. Clears first/last name (to `''`, NOT NULL),
     DNI and phone ciphertext, postal code, usernames, newsletter, `leave_reason`; deletes the
     badges and the `auth.users` row (e-mail, identities, sessions cascade;
     `handle_deleted_user` keeps the former row); sets `purged_at`. Kept: member number,
     `membership_start_date`, `current_joined_on`, `left_on`, `left_by` (tied to `left_on` by
     `members_left_on_left_by_pair`; only self/board), `created_at`, `anonymised_at`, the
     (invalid) card token. One `member.purge` entry each, actor NULL, details
     `{"left_on","purge_on","badges_deleted","account_deleted"}` (dates, a count, a boolean:
     BR-15-safe). Already anonymised members purge with `account_deleted: false`.
  2. Unconfirmed sign-ups: `auth.users.email_confirmed_at IS NULL` and `created_at < now() - 30
     days`, whose member row is absent or active with role `member`; deleted from `auth.users`
     in the database (the member row goes with `handle_deleted_user`). **Audit shape: one
     aggregate `account.purge_unconfirmed` entry per run, no target, details
     `{"accounts_deleted": n}`**, only when n > 0 (spec §5.1: "number of accounts deleted (no
     e-mails)").
  3. `audit_log` rows with `created_at < now() - 3 years` deleted (the boundary of
     `audit_log_append_only()`); the deletion itself is not logged (spec says nothing).
  Dry run: the same selection counted; no write, no entry (tested on fixtures).
- Deviation (brief option taken): the database deletes the auth users itself instead of the route
  calling `auth.admin.deleteUser` per id: the deletion and its audit entry commit together, and
  the dry-run counts are exactly what an apply deletes. Needs `postgres` DELETE on
  `auth.users` in prod (runbook 12 step 1). So there is no per-id failure path: any failure
  rolls back the whole run and the route answers 502.
- Route `GET /api/cron/retention` (`src/app/api/cron/retention/route.ts`, logic in
  `src/lib/retention.ts` `runRetention({ apply }) → { ok: true; summary } | { ok: false; code }`,
  never throws): same auth as `/api/cron/refresh` (Bearer `CRON_SECRET`, constant-time; 500
  `not_configured`, 401 `unauthorized`), `no-store` on every answer, `force-dynamic`. Dry run
  unless the query string has exactly `apply=1`. 200 `{ ok: true, dryRun, membersPurged,
  unconfirmedDeleted, auditEntriesDeleted }`; DB error or unexpected shape → 502 `{ ok: false,
  error: "retention_failed" }` with one log line `[retention] failed code=<Postgres code>`;
  success logs one line `[retention] dry_run=<bool> members_purged=<n> unconfirmed_deleted=<n>
  audit_entries_deleted=<n>` (counts only).
- Workflow `.github/workflows/retention.yml`: daily `41 2 * * *` UTC + `workflow_dispatch` with
  input `apply` (boolean, default false). Manual run applies only when ticked; scheduled runs
  apply only when the repository variable `RETENTION_APPLY` is `true`. Job runs only on
  `refs/heads/main`, prints the mode, `curl -fsS --max-time 120` against production. T13
  (ops_job_runs) may record these runs.
- T10 follow-ups: `leaveAssociation` now calls `getUser()` before validating the reason
  (anonymous → `unauthenticated` whatever it sends; tested). `sendMail` takes `sender?:
  'association' | 'contact'` (fixed display names "Darkstone Catalunya" / "Web
  [darkstone.cat]") instead of a free-form `fromName`; unknown or forged values fall back to the
  association name (own-key lookup; tested with a CRLF value). The contact route passes
  `sender: "contact"`; its tests and the contact E2E pass unchanged.
- Prod risks: postgres DELETE on `auth.users` (runbook 12 step 1); a purge is irreversible, so
  D-H must be confirmed before `RETENTION_APPLY` (runbook 12 step 6); the first apply also
  deletes the whole backlog of abandoned sign-ups older than 30 days. A member number with 9+
  digits after `000-` could look like a phone to the BR-15 detector (far future).

### T13 — done (route: delegated)

- Commit: `feat(admin): Record cache refresh runs and add a manual refresh action` on
  `develop-users` (hash in `git log -- supabase/migrations/20261006100200_ops_job_runs.sql`).
- Test-first: RED observed with the new `tests/integration/ops-job-runs.test.ts` (setup failed:
  `ops_job_runs` missing), `tests/lib/ops-job-runs.test.ts` and
  `tests/server/actions/ops-actions.test.ts` (missing modules), and the new cases in
  `tests/lib/cache-refresh.test.ts` (7 failing: `durationMs`, `errorCode`, `refreshErrorCode`) and
  `tests/server/api/cron-refresh-route.test.ts` (1 failing: no recording call); GREEN after the
  migration (`npm run db:reset`) and the code (10/10 integration, 34/34 unit in those files).
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 84 files / 1274 tests passed; `npm run test:integration` 29 files /
  521 tests passed.
- `public.ops_job_runs(id bigserial pk, job text NOT NULL CHECK in ('ludoya','bgg'), ran_at
  timestamptz NOT NULL default now(), ok boolean NOT NULL, actor_id uuid NULL (NULL =
  automatic; no FK, a run outlives its actor), duration_ms int NULL CHECK >= 0, error_code text
  NULL CHECK `^[a-z0-9_]{1,40}$`, CHECK not (ok and error_code))`. RLS on, no policies; anon and
  authenticated no grant at all; service_role SELECT only (no INSERT/UPDATE/DELETE/TRUNCATE,
  sequence revoked).
- Functions (all SECURITY DEFINER, `search_path ''`; errors `ops:forbidden` 42501,
  `ops:invalid_argument` 22023 for an unknown job, NULL ok, negative duration, a code that is
  not a short code, or a code on a successful run):
  - `ops_job_run_insert(job, ok, duration_ms, error_code, actor)` internal, no API grant:
    validates, inserts, prunes.
  - `ops_record_job_run(p_job, p_ok, p_duration_ms = NULL, p_error_code = NULL) → bigint`:
    service_role only; actor NULL (the cron route).
  - `admin_record_job_run(same args) → bigint`: authenticated, `has_role('board')`; actor =
    `auth.uid()` (cannot be passed in). service_role/anon refused.
  - `admin_ops_status()` RETURNS TABLE `(job, last_run_at, last_ok, last_automatic,
    last_actor_member_number, last_actor_name, last_duration_ms, last_error_code,
    last_success_at)`: board+, STABLE; always one row per job in display order `ludoya`, `bgg`
    (all NULL but `job` when never run). Last = newest `ran_at`, then id. Actor number/name from
    the member row (NULL when automatic, or the row is gone or purged); `last_actor_name` =
    "first last" (added for the mockup's "Oriol Mas"; the board already sees names).
- Pruning (decision): on every insert, runs of the same job older than 90 days are deleted,
  except the newest successful run, so "last success" survives an outage. Not tied to the
  retention job.
- Retention runs are NOT recorded (decision): V-6 shows only the two cache jobs, and a retention
  apply already leaves `member.purge` / `account.purge_unconfirmed` entries; the GitHub Actions
  log holds the dry-run counts. Recording it later = widen the CHECK and the job list.
- V-1 does not show job status (spec V-1: stats, recent activity, shortcuts), so `admin_stats`
  keeps its shape; V-6 (T25) calls `admin_ops_status()`.
- `src/lib/cache-refresh.ts`: `RefreshJobResult` gains `durationMs` (whole ms, `Date.now()`
  around revalidate + warm-up) and, on failure, `errorCode` from the new
  `refreshErrorCode(error)`: the Ludoya client's own code (validated), `shape_changed`,
  `timeout`, `http_<status>`, `missing_api_key`, else `error`. `error` (the message) stays for
  the cron response only; it is never stored or shown in the panel.
- `src/lib/ops/job-runs.ts` (`server-only`): `recordAutomaticRuns(results)` (service role,
  `ops_record_job_run`) and `recordManualRuns(sessionClient, results)` (`admin_record_job_run`).
  Unknown job names are skipped; a non-integer/negative duration → NULL; a failed run without a
  valid short code → `error`. Never throw; a failure logs only `[ops] record_job_run failed
  job=<job> code=<Postgres code | exception>`.
- `GET /api/cron/refresh` records the automatic runs after the jobs; status and body unchanged
  (`{ ok, jobs }`, jobs now also carry `durationMs` / `errorCode`). A recording failure never
  changes the answer (tested for a failed and a throwing recorder).
- `src/lib/admin/ops-actions.ts` (`"use server"`): `refreshCaches(job: 'ludoya' | 'bgg' | 'all'
  = 'all'): Promise<{ ok: true; results: { job, ok, durationMs, errorCode: string | null }[] } |
  { error: 'unauthenticated' | 'forbidden' | 'invalid' | 'rate_limited' }>` (A-14). Steps:
  `getAdminAccess('board')` → job check (`invalid`) → shared limiter
  `allowRequestShared('cache-refresh:<actor uuid>', null, 1, 60 s)` (`rate_limited`; bucket is
  the literal string, like the access link) → `runRefreshJobs(selected)` → `recordManualRuns`
  with the SESSION client → `log_admin_event('ops.cache_refresh', NULL, {"jobs":[…],"ok":bool},
  NULL)` with the SESSION client → revalidate `/[locale]/admin/tools` (`page`). Results carry
  the short code only, never the upstream message.
- Deviation: the audit entry is written AFTER the run (it records the result), so it cannot
  fail closed; if it fails the action still returns the results and logs only
  `[admin-ops] cache_refresh_audit failed code=<code>` (a refresh discloses nothing and is
  harmless to repeat). The shared mapper (`adminDbErrorCode`) is therefore not needed: no DB
  error reaches the caller. No i18n texts (T25).
- Tests: integration (direct insert refused for anon/member/board/service_role; direct select
  only for service_role; `ops_record_job_run` service role only; `admin_record_job_run` and
  `admin_ops_status` refuse anon/member/service_role; invalid arguments; automatic vs manual
  actor; status rows, last run vs last success, never-run job all NULL; pruning keeps the newest
  success and drops it once a newer success exists, other jobs untouched). Unit (duration with
  fake timers, error codes, subset run; recorder args, skip/normalise, never throws, logs code
  only; cron route records and ignores recording failures; action guard, invalid job before the
  limiter, limiter args, step order, per-job results, audit details, failed job, audit failure,
  no message/e-mail in results or logs).
- Prod risk: needs runbook 13 before the code (otherwise only log noise). The per-member
  limiter falls back to one instance's memory without the shared limiter table (runbook of
  `20261001100000`, already applied for the contact form).

### T14 — done (route: delegated)

- Commit: `feat(admin): Add the admin panel shell, tabs and dialog` on `develop-users`
  (hash in `git log -- src/components/admin/AdminDialog.tsx`).
- Test-first: RED observed (4 new component suites failed to import, 8 guard tests failed);
  GREEN after. Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 88 files / 1303 tests passed; `npx playwright test e2e/admin` 24 passed.
- Shell: `src/app/[locale]/admin/layout.tsx` calls `requireRole("board")`, loads the member name,
  renders NavBar, `AdminHeader` (eyebrow, per-view title from the active tab, "Has entrat com a
  <name> · Junta|Superadmin"), `AdminTabs`, children and Footer, and sets `robots: noindex`.
  `/admin` and `/admin/members` pages dropped their own NavBar/Footer/AuthHero/main; later pages
  render only their content (`container mx-auto px-6 pt-16` inside the beige section).
- Tabs follow the mockup README order, not the task text: Resum `/admin`, Socis
  `/admin/members`, Activitat `/admin/activity`, Procediments `/admin/procedures`, Eines
  `/admin/tools`, Rols `/admin/roles` (superadmin only). `AdminTabs({ isSuperadmin })`;
  exports `ADMIN_TABS`, `visibleAdminTabs`, `activeAdminTab(pathname)` (nested paths belong to
  their section). Mobile: 3-column grid, two rows. Header title = the active tab label; a
  screen that needs another title (member file) must render its own heading below the header.
- Guard: `requireRole(min, returnTo = "/admin")` is memoised per request with `React.cache`
  (layout + page share one lookup). Next layouts cannot read the pathname, so the redirect
  to `/login?redirect=<localized returnTo>` uses `returnTo` (validated with `safeRedirectPath`,
  unsafe values fall back to `/admin`); pages pass their own path, the layout uses the default.
  `getAdminAccess` (API routes) is not cached.
- `AdminDialog` props: `open`, `onClose`, `onConfirm`, `title`, `target?` (line under the title,
  aria-describedby), `variant?: "neutral" | "danger"`, `superadminOnly?`, `procedure?` ("P-2" links
  to `/admin/procedures#p-2`), `confirmLabel`, `cancelLabel?`, `confirmDisabled?` +
  `confirmDisabledReason?` (visible text linked by aria-describedby), `busy?`, `error?`,
  `reason?: { label, value, onChange, minLength = 5, maxLength = 1000, help? }` (shows the
  "No escriguis DNI ni telèfons al motiu" hint; confirm stays disabled until the trimmed
  reason reaches `minLength`; export `isReasonValid`), `closeOnBackdrop?` (default true),
  children = body. Focus trap, Escape and backdrop ignored while `busy`, focus returns to the
  trigger, reduced motion respected (Motion `useReducedMotion`; the project hook needs
  `matchMedia`, absent in jsdom). Bottom sheet below `sm`. `ExportConfirmDialog` now uses it
  (same behaviour, its tests unchanged; the error is now a `role="alert"`).
- Shared: `StatusChip({ kind: active|left|valid|invalid|error|board|superadmin, label?, onDark? })`,
  `Notice({ kind: info|warning|blocked })` (blocked is `role="alert"`),
  `ReasonButton({ variant, reason, disabled, ... })`, and `adminButtonClass(variant)` in
  `adminButtons.ts` (primary / secondary / danger, 44 px).
- i18n (`admin`, ca/es/en): `tabs_label`, `header_*`, `tab_*`, `chip_*` (incl.
  `chip_superadmin_only`), `dialog_close|cancel|procedure|reason_hint|reason_min`.
- NavBar: `/admin/` added to the prefix list so every admin subpath gets the dark theme.
- The dashboard e2e spec's members link locator now uses `.first()` (tab and card both link).
- Not done / for later: no `SubpageTheme` per-route keys (prefix match instead); dialog is not
  portalled (fixed positioning is enough inside the layout).

### T15 — done (route: delegated)

- Commit: `feat(admin): Add the procedures page` on `develop-users` (hash in
  `git log -- src/components/admin/procedures/ProceduresContent.tsx`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 89 files /
  1309 tests passed; `npx playwright test e2e/admin` 27 passed.
- `/admin/procedures` (`requireRole('board', '/admin/procedures')`, noindex, `revalidate = false`,
  breadcrumb + WebPage JSON-LD, not in the sitemap). `ProceduresContent` (server-compatible, no
  client JS) renders the index `<nav aria-label>` (chips on mobile, titles from `lg`) and seven
  `<article id="p-n">` cards; structure in `procedures.ts` (nested items, legal refs, warning
  step), text in `admin.procedures.*` ca/es/en (rich tags `<b>`, `<p1>` cross-reference). Internal
  rule ids (BR-12, A-6, S-3...) are dropped from the user-facing copy. Footer "Acció al panell"
  links to `/admin/members` (`?state=former` for P-1 and P-4). New keys `metadata.admin_procedures_*`
  and `nav.admin_procedures`.
- From the coordinator (T14 verification): `AdminDialog` now portals to `<body>`, locks body scroll
  and makes `#main-content` inert while open (restored on unmount), has `data-lenis-prevent` on
  the panel and moves focus to the panel when `busy` turns true; 2 new test cases. The layout's
  `<main id="main-content">` wraps the page, so the dialog had to leave it to stay interactive
  (T14's "not portalled" note no longer holds). `shell.spec.ts` 404 test now uses
  `/admin/procedures` (member 404, board 200).
- Tests: `tests/components/ProceduresContent.test.tsx`; `e2e/admin/procedures.spec.ts`.

### T16 — done (route: delegated)

- Commit: `feat(admin): Rebuild the member list on the admin read function` on `develop-users`
  (hash in `git log -- src/lib/admin/members-list.ts`).
- Verification: `npm run lint` exit 0 (no warnings); `npx tsc --noEmit` exit 0; `npm run test:unit`
  90 files / 1340 tests passed; `npm run test:integration` 29 files / 521 tests passed;
  `npx playwright test e2e/admin` 33 passed (4 consecutive runs after waiting for hydration in
  the filter test, which submits from React `onChange` handlers).
- `/admin/members` is a server page: `searchParams` (a Promise) go through
  `parseMembersParams` (`src/lib/admin/members-list.ts`, pure): `state` active|former|all, `role`
  all|member|board|superadmin, `sort` the 8 whitelisted values, `q` (control characters removed,
  whitespace collapsed, 100 code points), `page` plain digits 1..100000, `pp` 12|24|48|96 (no UI
  yet); anything else falls back to the default, and `toListMembersArgs` maps to the RPC (role
  "all" and empty search become NULL). The RPC is called with the SESSION client; error → blocked
  notice + retry link (Postgres code logged only); an empty page past the end redirects to page 1.
  URL parameter names are `state`/`role` (English, task text), not the mockup's `estat`/`rol`.
- UI (`src/components/admin/members/`): `MembersFilters` (client GET form: search + "Cerca"
  button, state segmented radios, role select, mobile-only sort select driving a hidden `sort`
  field; state/role/sort submit on change, never sends `page`), `MembersList` (server-compatible:
  table from `md` with sortable Núm./Nom/Alta actual headers + `aria-sort`, cards below, whole row
  or card links to `/admin/members/<number>` (V-3 arrives in T18, 404 until then), `StatusChip`
  for state ("Baixa des de d/m/yyyy") and board/superadmin, "Mostrant a–b de n", prev/next,
  `role=status` empty state), `MembersLoadError`, `MembersExports`, and `loading.tsx` skeleton.
  No DNI/phone anywhere. Deviation: the header count line ("168 socis actius · 23 exsocis") is not
  shown (the layout header has no counts; it would need a second RPC call).
- Exports: "Exporta CSV" opens `ExportConfirmDialog`, which gained an optional `role` prop: the POST
  body is `{ role }` only when the list is filtered by a role, `{}` otherwise (state is never sent:
  A-10 is active-only, the dialog says so and names the role). DECISION for A-16 and S-4: both are
  rendered DISABLED with the visible reason "Properament" (via `ReasonButton`), S-4 and its
  "Només superadmins" hint only for superadmins; T17 replaces them with the real dialogs.
- Removed: `MembersTable`, its role test and `src/lib/admin/utils.ts` (admin `maskDni`/`maskPhone`),
  plus the old flat `admin.members_*`, `col_*`, `not_provided`, `export_button` keys. NOT removed:
  `listAllMembersForAdmin` (`src/lib/admin/members.ts`), still used by `/admin` until T24.
  CLAUDE.md still names `MembersTable` in the component list (not edited: it has uncommitted
  changes from another feature).
- Tests: `tests/lib/admin-members-list.test.ts` (sanitiser, args, href, round trip),
  `tests/components/MembersList.test.tsx` (table/cards, chips, links, sorting, pagination, empty,
  error, filters form, export buttons and role filter), `ExportConfirmDialog` role case,
  `e2e/admin/members-list.spec.ts` (list, search and filter round trips via URL, sort, invalid
  params, page past the end, CSV dialog, member 404).

### T17 — done (route: delegated)

- Commit: `feat(admin): Add the e-mail and register export dialogs` on `develop-users` (hash in
  `git log -- src/components/admin/members/EmailsExportDialog.tsx`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 91 files /
  1358 tests passed; `npx playwright test e2e/admin` 36 passed. (Integration is run once, before
  the T18 commit.)
- A-16 `EmailsExportDialog` (`src/components/admin/members/`): list radio cards (association /
  newsletter), the "Abans d'enviar" block, procedure link P-7. Both outputs are disabled until a
  list is chosen (visible reason). "Descarrega CSV" is the AdminDialog confirm (POST
  `{ list, format: "csv" }` -> download, `role=status` "CSV descarregat."); "Copia les adreces" is
  a body button (POST `format: "json"` -> `navigator.clipboard.writeText(addresses.join(", "))`,
  status "Copiades N adreces." with the real count). Clipboard failure -> `copy_failed` alert.
  Deviation: the mockup draws both outputs in the body and only "Tanca" in the footer; here the
  CSV button is the footer confirm and "Tanca" the cancel (AdminDialog has one confirm slot).
- No address counts (mockup's "168 adreces", "191 files") are shown: no read function returns
  them (`admin_stats` has active/newsletter totals but not "confirmed with an e-mail"), and
  calling the audited export just to count is not allowed.
- S-4 `RegisterExportDialog`: `superadminOnly` chip, warning with the legal purpose, the column
  list of the real file (D-B: includes DNI/NIE and "Baixa per", not the mockup's five), reason
  textarea (min 10, max 500, trimmed) in place of the mockup checkbox (T9b requires a reason);
  POST `{ reason }` -> download. Only rendered for superadmins in `MembersExports`; the route
  re-checks the role.
- Errors (`admin.members.export_errors.*`, ca/es/en) via `src/lib/admin/export-client.ts`
  (`classifyExportError`: `forbidden_origin`, `reason_required`, `reason_too_long`, else 401
  `unauthenticated`, 403 `forbidden`, anything else `failed`; `saveResponseAsFile`,
  `postExport`). Server text is never shown. `export_soon` key is now unused.
- Coordinator fix (T15/T16 verification): `AdminDialog` stops Lenis on mount (only if it was
  running) and restarts it on cleanup, copying `CardQrOverlay`; tests in `AdminDialog.test.tsx`
  with a mocked `useLenis`.
- Tests: `tests/components/AdminExportDialogs.test.tsx` (disabled until list/reason, POST bodies,
  download, clipboard, error mapping), `MembersList.test.tsx` (buttons enabled, superadmin-only
  register), `AdminDialog.test.tsx` (Lenis), `e2e/admin/export-dialogs.spec.ts` (A-16 CSV with
  `waitForResponse` header assertions for both lists; S-4 button absent for board). No superadmin
  e2e fixture exists, so the S-4 happy path is covered by component and route tests only.

### T18 — done (route: delegated)

- Commit: `feat(admin): Add the read-only member file` on `develop-users` (hash in
  `git log -- src/lib/admin/member-file.ts`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0 (after deleting two stale
  generated, gitignored `.next/**/types/validator.ts` files that still pointed at the moved list
  page); `npm run test:unit` 95 files / 1407 tests passed; `npm run test:integration` 29 files /
  521 tests passed; `npx playwright test e2e/admin` 40 passed.
- Route `/admin/members/[number]` (`src/app/[locale]/admin/members/[number]/page.tsx`,
  `force-dynamic`, noindex, generic title without name or number): number checked with
  `^[0-9A-Za-z-]{1,32}$` (`isValidMemberNumber`) BEFORE the guard or any DB call (else
  `notFound()`) -> `requireRole('board', '/admin/members/<n>')` -> `admin_get_member` with the
  SESSION client -> zero rows or an RPC error -> `notFound()` (error logs the Postgres code only)
  -> `admin_list_activity({ p_target: id, p_limit: 5 })` (an activity failure logs the code and
  renders an empty card). `canExportData` = active member, or superadmin (D-D provisional).
- STRUCTURE CHANGE: the list page and its `loading.tsx` moved to the route group
  `members/(list)/` (git mv). A `loading.tsx` at `members/` wrapped the `[number]` page in a
  Suspense boundary, so the status was already committed and `notFound()` answered 200; now the
  member file is a real 404. URLs are unchanged. CLAUDE.md's Pages table still lists
  `admin/members/page.tsx` (not edited: WIP from another feature) - T27.
- UI (`src/components/admin/member-file/`): `MemberFile` (server-compatible) renders, below the
  layout header (which keeps the "Socis" h1), a card with back link, `h2` name, "Núm. de soci …
  · Primera alta …", state chip ("Baixa des de d/m/yyyy" for former) and role; the blocked notice
  "Dades bloquejades fins al {purge_on}" for former members; "Dades personals" (active: e-mail,
  name, DNI/phone as "•••••• (oculta)" presence only, postal code, Ludoya, BGG, newsletter, login
  yes/no) or "Dades del registre" (former: only e-mail when present, name, masked DNI, footnote that
  phone/postal code/usernames were deleted: no placeholders for BR-20 fields); "Pertinença"
  (primera alta, alta actual, data de baixa; former: baixa per, motiu, "es destrueix el …");
  "Insígnies" ("Membre {year}" derived from primera alta, BR-6, plus awarded badges with date and
  awarder); "Carnet" (valid/invalid chip, issued date; former text) with the current role and
  `role_since` for board roles; "Activitat" (5 entries, link to `/admin/activity?target=<number>`,
  which 404s until T23 builds V-4).
- Activity sentences use a LOCAL map (`activityKeyOf` + `admin.member_file.activity.*`, ca/es/en;
  unknown action -> "ha fet l'acció «key»"). T23 builds the shared renderer and should replace it.
- Omitted (documented, not disabled): Edita, Accions menu (send access link, regenerate card,
  leave/rejoin, anonymise), Mostra (reveal), Atorga/Retira insígnia, the Rol card and the Historial
  timeline; T19-T22 add them. Not rendered either: the "Historial" of earlier cycles (needs the
  audit rows with details, T23 renderer).
- A-11 `MemberDataExport` (client): "Exporta dades" -> AdminDialog (P-3, mockup text and warning)
  POST `/api/admin/members/<number>/data`; active member: optional reason textarea, body `{}` or
  `{ reason }`; former member (superadmin only, chip "Només superadmins"): the dialog's `reason`
  slot, min 10, body `{ reason }`; errors reuse `admin.members.export_errors.*`.
- Back link: the list adds `?list=<its query string>` to each member link when the view is not the
  default (`listParamFor`); the page rebuilds it through `parseMembersParams`/`buildMembersHref`
  (`backToListHref`), so nothing but whitelisted list filters survives (no open redirect).
- Tests: `tests/lib/admin-member-file.test.ts`, `tests/components/MemberFile.test.tsx` (active vs
  former, no contact data, purge date, masked DNI, badges, card, back link, activity),
  `MemberDataExport.test.tsx`, `tests/server/admin-member-page.test.ts` (number validation ->
  notFound before guard/DB, zero rows, RPC error, export permission, back link),
  `MembersList.test.tsx` (list param), `e2e/admin/member-file.spec.ts` (open from the list and back
  to the same search, unknown and malformed number 404, plain member 404, A-11 download with
  header and body assertions). No former-member e2e: it needs the leave action (T20).

### T19 — done (route: delegated)

- Commit: `feat(admin): Add member editing and the reveal dialog` on `develop-users` (hash in
  `git log -- src/components/admin/member-file/RevealButton.tsx`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 97 files /
  1437 tests passed; `npx playwright test e2e/admin` 41 passed (incl. the new
  `e2e/admin/member-edit.spec.ts`). Integration not rerun (no server/DB code changed in T19).
- UI: `PersonalDataCard` (client) replaces the "Dades personals" section: inline edit mode
  (`MemberEditForm`) and the reveal buttons. `RevealButton` (client): AdminDialog; active member:
  optional reason in a plain textarea child (null sent when blank); former member (superadmin
  only, DNI only, chip "Només superadmins"): the `reason` slot, min 10; the value lives in
  component state, shown in an `aria-live` panel with a copy button, cleared on close. A board
  member sees no "Mostra" on a former member's DNI (a note says superadmins only). Page passes
  `canRevealFormerDni = isSuperadmin(actor.role)`.
- `MemberEditForm`: DNI and phone start EMPTY (placeholder "deixa-ho buit per mantenir l'actual");
  they are sent only when typed, so an untouched save writes no audit row. Names, postal code and
  usernames are always sent (the DB writes no entry for unchanged values). Client validation
  reuses `member-fields` + `normalizeUsername`; every server code maps to a field message
  (`invalid_*`) or a form-level `admin.member_file.errors.*` text. Success: "Dades desades." +
  `router.refresh()`.
- Deviations from the mockup: "Edita" sits in the "Dades personals" card header (not the page
  header) to keep the edit state local; a stored DNI/phone cannot be cleared from the form (empty
  = unchanged); the reveal is a dialog (optional reason) instead of an inline eye toggle for
  active members; the dialog footer shows "Copia" + "Tanca" after the reveal. D-E stays
  provisional (10 characters).
- Also (parent request): `EmailsExportDialog` "Copia les adreces" now starts
  `navigator.clipboard.write([new ClipboardItem({ "text/plain": promise })])` inside the click
  (one POST, so Safari accepts it and a retry no longer writes extra `export.emails` rows), with
  the previous await-then-`writeText` path as fallback when ClipboardItem is missing; same
  "a, b" output. `copied` is now an ICU plural (0/one/other) in ca/es/en. Two tests added with a
  mocked ClipboardItem.
- Tests: `MemberEditForm.test.tsx`, `RevealButton.test.tsx`, `MemberFile.test.tsx` (edit toggle,
  former-member reveal visibility), `admin-member-page.test.ts` (`canRevealFormerDni`),
  `AdminExportDialogs.test.tsx`; e2e edits names, rejects an invalid DNI, adds a DNI through the
  form and reveals it (so the ciphertext is created by the real action, no helper encryption).
- Messages added under `admin.member_file`: `edit`, `reveal`, `errors`, `reveal_former_note`
  (T20 adds `leave`, `rejoin`).

### T20 — done (route: delegated)

- Commit: `feat(admin): Add the leave and rejoin dialogs` on `develop-users` (hash in
  `git log -- src/components/admin/member-file/MembershipActions.tsx`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 99 files /
  1466 tests passed; `npm run test:integration` 29 files / 521 tests passed;
  `npx playwright test e2e/admin` 42 passed (incl. `member-membership.spec.ts`).
- `MembershipActions` (client, in the file header): active member: "Dona de baixa" (danger
  `ReasonButton`, disabled with visible text when the member holds a board role (`role_held`
  rule, BR-12) or it is the signed-in member's own file (`viewerId`, `self_target`)); dialog:
  P-2 link, `reason` slot (min 5, max 500, help "El soci el rebrà per correu"), "Què passarà"
  list, date input defaulting to today in Madrid with `min`/`max` from `leaveDateBounds`
  (`src/lib/admin/leave-dates.ts`: <= today, not before the current alta, <= 365 days back; an
  out-of-range value disables the confirm; the DB validates too). Former member: "Reincorpora"
  (primary `ReasonButton`, disabled for anonymised / no login); dialog: P-1 link, amber warning
  with date and reason when the last baixa was given by the board, the 4-item checklist (all
  required), channel radio group (form/email/in_person/other, required), optional note in a plain
  textarea, "Què passarà" list. Outcome notice (`role=status`) lives in `MembershipActions`, so it
  survives the `router.refresh()`; `emailSent === false` adds a warning telling the board to write
  to the member by hand. Every code maps to `admin.member_file.errors.*`.
- Deviations: the mockup's rejoin list says "avui (d/m/yyyy)" and the leave help names the
  default date; both say only "avui" (no date formatting on the client); channel is a radio group
  as in the mockup (the task text said select). The leave date input is always sent (pre-filled).
- Tests: `MembershipActions.test.tsx` (disabled states with reasons, reason minimum, date bound,
  checklist and channel gating, board-leave warning, `emailSent=false` notice, error mapping),
  `admin-leave-dates.test.ts`, `MemberFile.test.tsx` (trigger per state),
  `admin-member-page.test.ts` (`viewerId`), `e2e/admin/member-membership.spec.ts` (leave, then
  rejoin a throwaway member; the file switches Actiu -> Baixa -> Actiu).
- Messages added under `admin.member_file.membership` (ca/es/en).

### T21 — done (route: delegated)

- Commit: `feat(admin): Add badge, card and access link actions to the member file` on
  `develop-users` (hash in `git log -- src/components/admin/member-file/BadgesCard.tsx`).
- Test-first: component tests were written together with the components (no RED observed: the
  server actions they call already existed and were mocked); the e2e spec was run green.
- Verification (run with the T22 files already in the tree, so the T21 commit itself was
  linted and type-checked in its final form): `npm run lint` exit 0; `npx tsc --noEmit` exit 0;
  `npm run test:unit` 104 files / 1508 tests passed; `npx playwright test e2e/admin` 46 passed
  (the one failure, the T22 role-card e2e, needs T22's RoleCard and is not part of this commit).
  Integration is run once, before the T22 commit (no server code changed in T21).
- `BadgesCard` (client, replaces the inline badges section): A-8. Award dialog = radio list of the
  catalogue (`KNOWN_BADGE_KEYS`), held ones disabled with "Ja la té des del …", optional note in a
  plain textarea (null when blank), note "Membre és automàtica"; revoke = per-badge "Retira"
  button, confirm dialog with optional reason. "Membre {year}" has no button (derived, BR-6). For a
  former member the award button is disabled with a visible reason and no revoke buttons exist.
  When every badge is held the award button is disabled with a reason.
- `CardSection` (client, replaces the inline card section): chip, issued date, A-9 "Regenera el
  carnet" (confirm dialog, P-5, explains the old QR stops; success notice; the token is never
  shown) and A-15 "Envia enllaç d'accés" (P-6; enabled only for active members with a login; info
  list; success notice never names the address; `rate_limited` shows "Ja s'ha enviat; torna-ho a
  provar d'aquí a N min" from `retryAfter` (ceil minutes, generic text when null) and disables the
  confirm until the dialog is closed). The role line moved out of this card (T22 adds RoleCard).
- Outcome notices (`role=status`) live in the cards, so they survive `router.refresh()`.
- Errors: `errors.ts` knows the new codes (`badge_held, badge_not_held, invalid_badge, send_failed,
  invalid_role, role_unchanged, self_role_change, last_superadmin, former_member_role,
  confirm_mismatch`); texts in `admin.member_file.errors.*` (ca/es/en).
- Messages: `admin.member_file.badge_actions|card_actions|role_actions`, `admin.roles`,
  `nav.admin_roles`, `metadata.admin_roles_*` were all added in this commit (ca/es/en), so the T22
  texts are already here and unused until T22.
- Coordinator fix (T19/T20 verification): `PersonalDataCard` rendered the edit form after a leave
  done from the same screen. It now renders the form only when `editing && !former`; test in
  `MemberFile.test.tsx` (rerender from active to former closes the form).
- Tests: `tests/components/BadgesCard.test.tsx`, `CardSection.test.tsx` (catalogue filtering,
  disabled states for former members, rate-limited message, address never passed),
  `MemberFile.test.tsx`; `e2e/admin/member-badges-card.spec.ts` (serial: a board member awards,
  sees the badge disabled, revokes; regenerates the card and sees the notice, on a throwaway member).
  No access-link e2e: it sends a real e-mail and consumes the shared rate-limit bucket.
- Deviation: the A-11 export stays as T18 built it; "Atorga" note field says "Nota (opcional)" and
  carries the no-DNI hint in its help text instead of the dialog reason slot.

### T22 — done (route: delegated)

- Commit: `feat(admin): Add role management, anonymisation and the roles page` on `develop-users`
  (hash in `git log -- src/components/admin/member-file/RoleCard.tsx`).
- Test-first: component and page tests were written together with the code (no RED: the actions
  are already tested and mocked here).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 104 files /
  1508 tests passed; `npm run test:integration` 29 files / 521 tests passed;
  `npx playwright test e2e/admin` 47 passed (twice).
- `RoleCard` (client, "Rol" section of the member file, below badges and card; the page passes
  `canManageRoles = isSuperadmin(actor.role)` and the file `isSelf = viewerId === member.id`).
  Board: role and `role_since` read-only with "Només els superadmins poden canviar rols" and no
  buttons. Superadmin: "Canvia el rol" (S-1/S-2, disabled with a visible reason on the own file and
  for a former member); dialog with a radio group member/board/superadmin (never legacy admin),
  confirm disabled until a role other than the current one is chosen, grant warning, optional
  reason in a plain textarea; the notice (grant/revoke) lives in the card. Former members only:
  "Anonimitza" (S-3, danger, P-4, "Només superadmins"): lists what is deleted now and what stays
  locked until the purge date, typed member number (trimmed, must equal it exactly) before the
  confirm enables, optional reason; success notice with the purge date; when `accountDeleted` is
  false a warning with "Torna-ho a provar" re-runs the same action (idempotent; its answer keeps the
  first purge date because the retry returns `purgeOn: null`). Disabled with a reason once the
  member is anonymised AND has no login account (an anonymised member with a login can still retry).
- Errors: every code of `setMemberRole`/`anonymiseMember` maps to `admin.member_file.errors.*`
  (`self_role_change, last_superadmin, former_member_role, role_unchanged, role_held,
  confirm_mismatch, invalid_role`...).
- V-5 `/admin/roles` (`requireRole('superadmin', '/admin/roles')` first, so a board member or plain
  member gets the 404; `force-dynamic`, noindex, not in the sitemap): active superadmins and board
  (`admin_list_members` with `p_role`, SESSION client, limit 200, which includes the legacy
  `admin`), each with `role_since` and a link to the file, a "Tu" marker, the explanation card
  (chain, the three roles, minimum of two superadmins, former members cannot hold a role) and a
  load-error notice. The Rols tab already existed. Messages `admin.roles.*`, `nav.admin_roles`,
  `metadata.admin_roles_*` were added in the T21 commit.
- Deviations: the mockup's "Fes superadmin", per-row "Treu el rol" and "Afegeix a la junta" search
  are not on V-5 (read-only overview; roles change from the member file, whose server actions
  enforce BR-10..BR-12) because the task asked for lists, dates, links and the BR-10 explanation;
  `admin_list_members` has no `role_since`, so the page calls `admin_get_member` once per holder
  (a handful of people). The role dialog is a radio group (mockup), not a select.
- E2E: no superadmin fixture (not simple/safe: BR-10 needs two superadmins and teardown would
  need a forced demotion the helpers cannot do), so the superadmin happy paths are covered by
  component and page tests. `e2e/admin/roles.spec.ts`: board and member get 404 on `/admin/roles`,
  no Rols tab for the board, the role card is read-only for the board on a throwaway member.
- Tests: `RoleCard.test.tsx`, `RolesContent.test.tsx`, `tests/server/admin-roles-page.test.tsx`,
  `MemberFile.test.tsx`, `admin-member-page.test.ts` (`canManageRoles`).
- Correction after the T21/T22 verification (medium, separate commit `fix(admin): Send the typed member number when anonymising`): `RoleCard.runAnonymise` now sends the text the superadmin TYPED (kept in a ref so the retry button repeats the same call), so the database `confirm_mismatch` check is the real gate; `loadHolders` in `/admin/roles` logs only the Postgres code when an `admin_get_member` call fails. Tests: RoleCard asserts the raw typed string (with spaces) on submit, retry and mismatch; roles page test for the code-only log.
### T23 — done (route: delegated)

- Commit: `feat(admin): Add the activity log page and audit renderer` on `develop-users` (hash in
  `git log -- src/lib/admin/audit-format.ts`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 108 files /
  1593 tests passed; `npx playwright test e2e/admin` 50 tests (the only failure, `member-membership`,
  was a locator that now matched the reason twice because the Activitat card prints it; fixed with
  `exact: true`, 3/3 green on rerun, `e2e/admin/activity.spec.ts` 3/3).
- Renderer `src/lib/admin/audit-format.ts` (pure): `describeAuditEntry(row)` returns `{ actor, sentence,
  details, reason }`; sentence and details are `{ key, params }` under `admin.activity`, params may be
  text, number, `{ i18n }` (translated by the component) or lists. All 18 keys have their own sentence.
  Only whitelisted detail fields are read and type-checked (field names, badge, role, channel, list,
  state/role filter, dates `YYYY-MM-DD`, counts as safe non-negative integers, jobs); before/after only for
  first/last name; anything else is dropped. Unknown action, missing/unknown detail values fall back to a
  generic sentence (`unknown`, `unknown_target`, `*_generic`); malformed details never throw. Reason is
  plain text (React escapes it). `describeAuditTime` gives today/yesterday/date in Madrid time.
  `AdminActivityRow` now lives there (re-exported from `member-file.ts`); `activityKeyOf` and the local
  `admin.member_file.activity.*` map and `activity_system` were deleted.
- Query module `src/lib/admin/activity.ts`: `parseActivityParams` whitelists action (18 keys + `badge.*`,
  `role.*`), actor (`system`, `self`, UUID), member number, real days 2000-2100 (reversed range swapped) and an
  integer cursor; `toActivityArgs` asks `p_limit 26` (one extra row decides "load more"), converts
  "Fins a" to a half-open Madrid-midnight `p_to`; `buildActivityHref` round-trips.
- V-4 `/admin/activity` (`force-dynamic`, noindex, `requireRole('board', '/admin/activity')`, session
  client): info notice, GET filters form (Des de, Fins a, Qui = everyone / each board member and superadmin
  / Soci (ell mateix) / Sistema, Acció = all + 16 groups, Soci number, Aplica, Neteja), table with caption,
  actor chip, `<time>`, no links or buttons in it, mobile cards, count and keyset "Carrega'n més" (link to
  `?before=<last id>`) plus "Torna a les més noves", empty / filtered-empty / error states, `loading.tsx`.
  Member file "Activitat" card uses the same renderer. i18n ca/es/en (`admin.activity`, nav, metadata).
- Decisions vs the mockup: no default last-30-days range (the "Veure tot" link and the 3-year log read
  better unfiltered; the URL carries any range); "Soci" filters by member NUMBER only (the RPC has no name
  filter; placeholder says so); pagination is keyset (next / back to newest) instead of numbered pages, since
  `admin_list_activity` is keyset-only; "Detalls" shows details and the reason on one line joined with " · ".
- Tests: `tests/lib/audit-format.test.ts` (every key, i18n keys exist in the 3 locales, no DNI/phone value,
  malformed details, unknown), `tests/lib/admin-activity.test.ts` (sanitiser, Madrid day start incl. DST
  days, args, href), `tests/components/ActivityLog.test.tsx`, `tests/server/admin-activity-page.test.ts`,
  member file tests adapted, `e2e/admin/activity.spec.ts` (A-11 export, "Veure tot" link, group filter,
  empty state, malformed params, member 404).

#### T23 correction (T23/T24 verification, spec 5.3) — commit `fix(admin): Hide past names of anonymised members in the activity log`

- `member.update` audit details keep `changes.first_name/last_name` from/to, and `admin_list_activity`
  returned `details` verbatim, so the old names of an anonymised member showed in V-4, V-1 and V-3
  (and any board session could read them from the RPC). Two layers: migration
  `20261006100400_activity_hide_names.sql` returns `details - 'changes'` when the row has a target that
  is anonymised, purged or gone; `describeKnown('member.update')` adds the name-change detail only when
  `target_name !== null`. Tests: `tests/integration/activity-hide-names.test.ts` (active member shows
  the change; after anonymising, the RPC drops `changes` and no old/new name appears),
  `tests/lib/audit-format.test.ts` (target_name null, no `detail.change`).
- Not done: the optional generic sentence for unknown badge keys (`badgeParam` still shows the raw
  string, max 60 chars).

### T24 — done (route: delegated)

- Commit: `feat(admin): Rebuild the admin dashboard on admin_stats` on `develop-users` (hash in
  `git log -- src/lib/admin/stats.ts`).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 111 files /
  1621 tests passed; `npm run test:integration` 29 files / 521 tests passed; `npx playwright test e2e/admin`
  50 passed.
- `/admin` (`force-dynamic`, `requireRole('board', '/admin')`): `admin_stats()` and
  `admin_list_activity({ p_limit: 10 })` in parallel through the SESSION client; each failure logs only the
  Postgres code and renders its own notice (figures: with a retry link; activity: notice) without hiding the
  rest. `parseAdminStats` (`src/lib/admin/stats.ts`) validates the row (non-negative safe integers, unknown
  fields dropped; an unusable answer counts as a failure). Newsletter percent is computed in the app.
- UI `src/components/admin/overview/AdminOverview.tsx` (V-1): six figure cards in spec order (not links),
  "Activitat recent" with the shared audit renderer (`<ol>`, `<time>`, link "Veure tot el registre"), empty
  and error states, "Dreceres" dark card with four real links (Cerca un soci and Exporta both go to
  `/admin/members`, where the exports live; Eines `/admin/tools` 404s until T25; Procediments); shortcuts
  first on mobile. i18n `admin.overview` ca/es/en.
- Removed: `AdminDashboard.tsx`, `src/lib/admin/members.ts` (`listAllMembersForAdmin`; it had no other
  caller, the SQL function `get_all_members_for_admin` stays for T27 to drop) and the nine old admin message
  keys (`title`, `subtitle`, `stat_*`, `nav_*`). CLAUDE.md still mentions both (WIP file of another
  feature, not edited): T27.
- Deviation: the instruction said `p_limit 5`; spec V-1 and the mockup say the last 10, so 10 is used
  (`OVERVIEW_ACTIVITY_LIMIT`, one constant).
- Tests: `tests/lib/admin-stats.test.ts`, `tests/components/AdminOverview.test.tsx`,
  `tests/server/admin-overview-page.test.ts` (guard first, session client, no service-role import, per-failure
  flags), `e2e/admin/dashboard.spec.ts` rewritten (six figures with numbers, latest activity after an A-11
  export, shortcuts, guards), shared `e2e/helpers/admin-audit.ts`.

### T25 — done (route: delegated)

- Commits: `fix(db): Record manual cache refreshes only through the server`, `feat(admin): Add the tools
  page and move the event images tool` (hashes in `git log -- supabase/migrations/20261006100300_ops_record_actor.sql`
  and `git log -- src/components/admin/tools/ToolsContent.tsx`), plus the T23 correction above.
- Verification: `npm run db:reset` ok; `npm run lint` exit 0; `npx tsc --noEmit` exit 0 (after deleting the
  stale `.next-e2e/dev/types/validator.ts` that still imported the removed page); `npm run test:unit`
  114 files / 1639 tests passed; `npm run test:integration` 30 files / 524 tests passed;
  `npx playwright test e2e/admin` 56 passed.
- DB fix: `admin_record_job_run` is dropped; `ops_record_manual_job_run(job, ok, duration_ms, error_code,
  actor)` is service_role only and raises `ops:forbidden` (42501) for an actor that is not an active board+
  member. `recordManualRuns(actorId, results)` now records through the service-role client with the actor id
  `getAdminAccess` verified; `log_admin_event` still uses the SESSION client. `admin_ops_status` unchanged.
- V-6 `/admin/tools` (`force-dynamic`, `requireRole('board', '/admin/tools')`): `admin_ops_status()` through
  the SESSION client, parsed by `parseOpsStatus` (`src/lib/admin/ops-status.ts`); failure logs the code only and
  shows a notice (buttons still work). `ToolsContent` (client): event images card with link, cache card with a
  status line per job (chip, time via the audit time label, automatic or actor name/number, duration, short error
  code, last success), "Refresca ara" per job and "Refresca-ho tot", busy state (all buttons disabled), results
  notice per job, rate-limit/forbidden/unauthenticated/generic messages, `router.refresh()` on success.
- Deviation from the mockup: buttons read "Refresca ara" / "Refresca-ho tot" (task text) instead of "Actualitza
  Ludoya"; each is described by its job name. The mockup's design-note hint with the paths is not shipped.
- Event images tool moved to `/admin/tools/event-images` (D-G, provisional) under the admin layout: new page,
  old page and `EventImagesHero` deleted (the page renders a back link, `h2` and `EventImagesContent`). `next.config.ts`
  has 308 redirects for `/events/images`, `/ca/events/images` and `/es|en/events/images`; `/events/images` was
  removed from the proxy `ADMIN_ROUTES` (redirects run before the proxy) and from the NavBar themes (`/admin/` prefix
  covers the new path). The image API route stays at `/api/events/[eventId]/image`.
- Not touched (outside the allowed surface, for T27 docs/cleanup): `scripts/lighthouse/config.mjs` still audits
  `/events/images` (now an auth redirect), the comment in `src/app/sitemap.ts`, CLAUDE.md and README pages tables.
- E2E note: the manual refresh test cannot be retried within a minute (per-member limiter), so it has retries off.


### T26 — done (route: delegated)

- Commit: `feat(profile): Replace account deletion with leaving the association` on `develop-users`
  (hash in `git log -- src/components/profile/LeaveAssociationDialog.tsx`). One commit: the leave
  dialog, the neutral reset, the login help line and their translations share the three message files.
- Test-first: RED observed with the new `tests/integration/former-member-access.test.ts` (failed to
  import the missing `password-reset-actions`); GREEN after the action and the `left_on` check (5/5).
  The unit tests (`password-reset-actions`, `auth` former-member cases, `AccountActions`,
  `ForgotPasswordForm`, `LoginForm` banned/help/left cases) and `e2e/auth/leave.spec.ts` were written
  right after the code and passed on their first run, except two e2e selector fixes (the Next.js
  route announcer is also `role="alert"`; assertions are scoped to the form).
- Verification: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 117 files /
  1680 tests passed; `npm run test:integration` 31 files / 529 tests passed;
  `npx playwright test e2e/auth e2e/admin e2e/forms/contact.spec.ts` 94 passed; `npx playwright test
  e2e/profile` 42 passed (incl. the WIP `profile-details.spec.ts`, unchanged).
- M-1: `LeaveAssociationDialog` (reuses `AdminDialog`: focus trap, inert page, Escape, busy state)
  replaces `DeleteAccountDialog` (deleted) and `deleteAccount` (removed; it had no tests of its own;
  the `ProfileDetailsCards` AccountActions block moved to `tests/components/AccountActions.test.tsx`).
  Content per mockup 09 M-1: target "Soci {número}" (the props carry no name, the WIP details page is
  unchanged), "Què passarà" list, download button + privacy-policy link, "Entenc el que passarà"
  checkbox gating "Dona'm de baixa", plus an optional reason (≤ 500, "no DNI or phone" hint; the
  mockup has none, the task and `member_leave_self` take one). Errors: `role_held` → BR-12 text,
  `reason_too_long`, `unauthenticated` → session expired, others generic. Success: the action already
  signed the session out server-side; the dialog wipes the `sb-…-auth-token` cookies (same loop as the
  NavBar, duplicated because NavBar is outside the surface) and hard-redirects to `/login?left=1`.
- `AccountActions` keeps its props; it reads the role with `useAuthUser` and, for board/admin/superadmin,
  shows the "Si ets de la junta" chip, the BR-12 warning and a disabled "Dona't de baixa" described by
  it (mockup 07 §6). Display only: the database still refuses with `role_held`.
- Former members: `getCurrentMember` / `getProfileData` return null when `left_on` is set. Observed in
  the integration test: after the leave GoTrue already refuses the old access token (`getUser` 400,
  its session is gone), so the proxy sends the browser to `/login?redirect=…` (the neutral notice is
  the normal login page); the `left_on` check covers a token GoTrue would still accept. No redirect in
  the pages (they are WIP or outside the surface, and the repo forbids page redirects: loop risk).
- `requestPasswordReset(email)` (`src/lib/supabase/password-reset-actions.ts`, server action):
  throttles `password-reset-ip` 10 and `password-reset-email` 3 per 10 min (`allowRequestShared`),
  then `is_email_confirmed` (false for unknown, unconfirmed and former), then a cookie-less
  `resetPasswordForEmail` with `redirectTo = <request origin>/auth/callback` (Origin header, else
  host + x-forwarded-proto), same as the browser call. Unknown/unconfirmed/former/throttled/sent and
  GoTrue 429 → `{ error: null }`; lookup or send failure → `failed` (logs only codes, never the
  address). `ForgotPasswordForm` (now shows a generic retry error on `failed`) and "Canvia la
  contrasenya" use it. Integration: a former member's request answers `{ error: null }` and no mail
  reaches Mailpit.
- Login: `user_banned` (code, or a "banned" message) maps to the wrong-password text; that generic
  error always carries the help line "Si no pots entrar o t'has donat de baixa, contacta amb la junta."
  + "Contacta amb la junta" → `/contact?subject=Vull tornar a ser soci` (localized). `?left=1` shows the
  "T'has donat de baixa…" status notice.
- `/contact?subject=`: the page reads the param (string only, control characters → space, trimmed, 150
  code points) and passes `defaultSubject` to `ContactForm` (uncontrolled `defaultValue`, editable).
- Integration (`former-member-access.test.ts`): control (active member: magic link and recovery links
  verify), then after `leaveAssociation`: old token refused and member area null, password `user_banned`,
  generated magic link and recovery link refused at `verifyOtp`, neutral reset sends nothing. E2E
  (`e2e/auth/leave.spec.ts`, throwaway member): leave from `/profile/details`, notice, `/profile` →
  `/login`, sign-in shows the generic error + help line, the link prefills the contact subject; a wrong
  password shows the same; `adminPage` sees the disabled button and the BR-12 warning.
- Deviations from the mockups: after the leave the notice is on `/login?left=1`, not on `/` (the home
  page is outside this task's surface; T27 can move it); the M-1 dialog adds the optional reason; the
  help line shows only with the credentials error (not with unrelated failures such as a 500).
- Risks: the reset now depends on the request Origin/host (Supabase must allow `<origin>/auth/callback`,
  as before); a throttled reset looks sent; the post-leave cookie wipe is duplicated from NavBar.

### T27 — done (route: delegated)

- Commits on `develop-users`: `fix(profile): Refuse the card and calendar to former members`
  (062d54e, T26 verification follow-up), `feat(db): Retire the legacy admin role` (b24636c),
  `chore(admin): Document the admin routes and fix the scheduled workflows` (7052fb7), and
  `docs(admin): Add the production runbook and CLAUDE.md changes` (this document,
  `odd/tasks/admin-panel-claude-md.md`).
- Verification: `npm run db:reset` ok (applies `20261007100000_roles_contract.sql`); `npm run lint`
  exit 0; `npx tsc --noEmit` exit 0; `npm run test:unit` 117 files / 1682 tests passed;
  `npm run test:integration` 31 files / 521 tests passed; `npx playwright test e2e/admin e2e/auth`
  86 passed (incl. setup/teardown).
- Test-first: the T26 follow-up observed RED (2 new route tests failing on the old routes) then
  GREEN. M7: the contract tests (`roles-contract.test.ts`, the new CHECK/role_rank cases in
  `roles.test.ts`) were written with the migration; no RED run before it (a reset was needed to
  apply it).
- M7 (`20261007100000_roles_contract.sql`): precondition (two active superadmins unless the
  table is empty, so `db:reset`/CI pass), active `admin` → `board`, former `admin` → `member`,
  CHECK member/board/superadmin (NOT VALID + VALIDATE), `role_rank()` without `admin`,
  `get_all_members_for_admin()` + `admin_member_view` dropped. Probed locally in rolled-back
  transactions as `postgres`: with members and no superadmin step 0 raises; on a restored pre-M7
  shape (old CHECK and `role_rank`, the old function and type, an `admin` row with
  `role_since = 2020-01-01`) the migration gives `board` with the same `role_since`, NULL rank for
  `admin` and the function gone; the superadmin snippet promotes two members (one board, one
  member), writes two `role.grant` entries (actor NULL, details `{from,to}`), and M7 then runs.
- App role model: `src/lib/auth/roles.ts` keeps `admin` (rank 1) with "remove after M7 is applied
  in prod" comments, because the code ships before M7 (deploy window). Unit tests of `admin`
  stay for the same reason.
- Fixtures: `createTestAdmin` and the e2e `e2e-admin` user are `board`; the e2e helper now also
  sets the role on a reused user (a teardown that demoted but failed to delete left it a plain
  member). Integration files that used a "legacy" `admin` user now make it a second board member
  (titles and `actor_role` assertions adapted); `admin-rpc.test.ts` deleted and the
  `get_all_members_for_admin` blocks of `member-secrets-lockdown.test.ts` and `roles.test.ts`
  removed (the function is gone; `roles-contract.test.ts` asserts PGRST202, `to_regprocedure` /
  `to_regtype` NULL, the CHECK definition and no `admin` row); the `alias` admin→board
  `role_since` test moved to the local migration probe above (the CHECK no longer accepts the
  fixture).
- T26 follow-up: `/api/members/card` and `/api/profile/calendar` read `left_on` with the member
  row and answer 404 when it is set (route tests for both).
- Leftovers: README admin routes table (and `/events/images` rows removed); Lighthouse no longer
  audits `/events/images` (19 pages); comments in `sitemap.ts` and the event image route point to
  `/admin/tools/event-images`; `scripts/migrate-members.mjs` accepts `^000-\d{3,}$`;
  `retention.yml` and `cache-refresh.yml` have `permissions: {}` and a `concurrency` group
  (cancel-in-progress false).
- Finding: `.github/workflows/cache-refresh.yml` was **invalid YAML** (`run: curl … -H
  "Authorization: Bearer …"` as a plain scalar cannot hold `: `). GitHub rejected the file (every
  push shows a 0 s "failure" run on `develop-users`), so the scheduled refresh never ran. Fixed
  with a block scalar (checked with `yaml.safe_load`). The file is not on `main` yet, so
  production lost nothing; runbook phase 4 step 3 is its first run.
- Deviation: `supabase/snippets/` is owned by root (created by Supabase Studio) and not writable,
  so the superadmin snippet lives in the runbook (phase 6) instead of
  `supabase/snippets/promote-superadmins.sql`.
- Final verification (tier `high`): PASS. One low defect fixed by the parent: M7's header and
  precondition error pointed at the non-existent snippet file; both now point at runbook phase 6.
  Runbook note: apply migrations with the Supabase MCP `apply_migration` (or record their versions
  in `supabase_migrations.schema_migrations` by hand) — the SQL editor does not record them, so a
  later `db push` would re-apply them; never run M7 through psql outside a single transaction.
- CLAUDE.md: not edited (WIP of `zona-socis-mockups-v2`); every change is listed, ready to apply,
  in `odd/tasks/admin-panel-claude-md.md`.

### T28 — done (route: delegated)

- Bug 1 (`AdminDialog`): the page lock (body overflow, Lenis, `#main-content` inert) moved from
  panel mount/unmount to a module-level counter (`lockPage`) driven by `useIsPresent()`, so it is
  released the moment `open` turns false, not when the exit animation ends. The exiting backdrop gets
  `pointer-events-none` and the panel `inert`; the Escape/Tab listener and focus restoration run in the
  same cleanup. The counter keeps the page locked when a dialog opens while another closes, and
  restores the original overflow / inert state only when the last one releases.
- Bug 2 (`MemberFile`): rule: an outcome notice kept in a card's local state is cleared when
  `member.state` changes. Implemented with `key={`<card>-${member.state}`}` on `PersonalDataCard`,
  `BadgesCard`, `CardSection` and `RoleCard`; `MembershipActions` has no key because its leave/rejoin
  outcome is what changes the state and must stay visible after `router.refresh()`.
- Bug 3: new `e2e/helpers/hydration.ts` (`expectHydrated`: element attached and carrying a
  `__reactProps$` key) replaces every `waitForLoadState('networkidle')` in `e2e/admin/*` and
  `e2e/helpers/admin-audit.ts`.
- RED (before the fix): `AdminDialog releases the page as soon as it starts closing` (4 tests: un-inerts
  before the exit ends, exiting panel unclickable, focus returns on close start, stacked dialogs) and
  `MemberFile, outcome notices and state changes` (`Dades desades` and card notice cleared on state
  change) failed; the leave-outcome-persists test passed already (guard against the key rule).
- GREEN: `npm run test:unit` 117 files / 1690 tests; `npm run lint` and `npx tsc --noEmit` clean;
  `npx playwright test e2e/admin e2e/auth` 86 passed; `e2e/admin/activity.spec.ts --repeat-each=5`
  15 passed (17 with setup/teardown).

## Feature summary

The admin panel is complete on `develop-users` (T1–T27, about 35 commits, `exception-ok`
delivery, no PR slicing):

| Area | What shipped |
|---|---|
| Data model | Membership state (leave, rejoin, anonymise, purge), roles member/board/superadmin with BR-10/11/12 guards, append-only audit log with a BR-15 leak detector, `ops_job_runs` |
| Security | Board sessions read no other rows directly; DNI/phone ciphertext bound to its member (AES-GCM AAD, `v2:`) with a re-encryption script; every admin mutation is a SECURITY DEFINER function that writes its audit entry in the same transaction; exports are POST + same-origin and audited before data |
| Screens | V-1 summary, V-2 member list + exports, V-3 member file (edit, reveal, leave/rejoin, badges, card, access link, data export, role, anonymise), V-4 activity, V-5 roles, V-6 tools, V-8 procedures, M-1 member-side leave |
| Operations | Daily retention job (dry run by default), cache refresh runs recorded, leave/rejoin e-mails, final production runbook above |

## Open decisions and accepted residuals

- D-A (open): the two superadmins. Blocks phase 6 and M7 only.
- Provisional, enforced in one place each (change the function and its tests):
  - D-D: A-11 on a former member is superadmin only (`admin_member_data_former_min_role()`).
  - D-E: reason minimums 5 for a board leave (`membership_leave_reason_min_length()`), 10 for a
    former member's DNI reveal / data export / register (`admin_reveal_reason_min_length()`).
  - D-G: path `/admin/tools/event-images` (page folder, three redirects in `next.config.ts`, link).
  - D-H: purge = `left_on` + 3 years (`member_purge_on()`), board leave at most 365 days back;
    confirm before `RETENTION_APPLY` (phase 5).
- Accepted residuals (T26 verification):
  - GoTrue checks the ban before the password, so the raw Auth API answers `user_banned` for a
    former member's e-mail whatever password is sent: it reveals that an account is banned. The
    app shows the wrong-password text; the leak is inherent to blocking sign-in with bans
    (D-6 / spec §4.4).
  - Password reset and magic link requests: response timing differs between sent and not sent,
    and the per-address bucket (3 per 10 min) lets someone block a victim's resets for 10 minutes
    (same trade-off as the magic link).
  - Hardening idea, not done: build the reset `redirectTo` from a fixed configured origin instead
    of the request `Origin`/host headers (the Supabase allow-list already limits where it can go).
- Other known gaps carried from earlier tasks: the audit `reason` column is not scanned for
  DNI/phone (dialogs warn); the detector misses compound keys (`telefono_movil`); a 9-digit id
  starting 6–9 in audit details reads as a phone; PostgREST `max_rows` 1000 caps exports (they
  refuse instead of truncating); no superadmin e2e fixture (superadmin paths are covered by
  component, route and integration tests); `current_joined_on DEFAULT CURRENT_DATE` is the UTC
  date.

## Post-merge follow-ups

1. Run the final prod runbook (phases 0–7).
2. Remove the legacy decrypt fallback once a production dry run shows `legacy=0` (phase 8.1).
3. Remove `admin` from `src/lib/auth/roles.ts` and its tests once M7 is applied (phase 8.2).
4. Apply `odd/tasks/admin-panel-claude-md.md` to `CLAUDE.md` (phase 8.3).
5. User review of the Catalan leave/rejoin e-mail copy (T10) and of the provisional decisions.
6. Optional: move the post-leave notice from `/login?left=1` to the home page (T26 deviation);
   share the cookie wipe between NavBar and `LeaveAssociationDialog`.
7. DONE (T28). Minor UX from the manual check (below): the first click on the page right after closing an
   `AdminDialog` is swallowed (the page stays inert during the ~200 ms exit animation); a success
   notice of `PersonalDataCard` ("Dades desades.") stays visible after a leave/rejoin.
8. DONE (T28). `e2e/admin/activity.spec.ts:9` is flaky on a cold dev server (`waitForLoadState` 15 s);
   replace the networkidle wait with a hydration marker or URL assertion.

## Final verification (2026-10-06)

- Full E2E `npm run test:e2e` on 2bd28b7: 252 passed, 1 failed (`e2e/navigation/locale-routing.spec.ts`
  "language switcher is visible", known pre-existing failure), 1 flaky (`e2e/admin/activity.spec.ts:9`,
  passed on retry and on an isolated rerun); 2.4 min; the zona-socis WIP specs passed too.
- Manual check in Chrome against a local dev server (port 3200, local Supabase with the CI demo
  keys, LUDOYA_MOCK) with throwaway users (superadmin, board, member; deleted afterwards):
  superadmin dashboard figures and activity; members search; member file; edit with DNI, phone
  and postal code (only field names in the audit entry); reveal of the DNI (v2 ciphertext decrypts
  end to end, value only in the dialog); award a badge; leave (former view, purge date, `emailSent`
  false warning with the dummy SMTP) and rejoin (checklist gating, phone/postal code cleared, DNI
  kept); roles, tools and activity pages; board view: 5 tabs, `/admin/roles` 404, read-only role card.
  Findings: the two minor UX items in follow-up 7. Not covered manually: Safari clipboard,
  mobile layout, the member-side leave flow (covered by e2e).

## Next step

Feature closed. Next: decide D-A, then run the prod runbook after merging to `main`.
