# CLAUDE.md changes for the admin panel (ready to apply)

`CLAUDE.md` holds uncommitted work of `zona-socis-mockups-v2`, so the admin panel (T1–T27)
did not edit it. Apply the changes below once that work is committed. Each item names the
section, what to replace and the new text. Commit them as
`docs: Document the admin panel in CLAUDE.md`.

## Quick path

1. Pages table: replace the `/admin` and `/admin/members` rows, delete `/events/images`, add the rows in §1.
2. API routes: replace the export bullet and the `/api/events/[eventId]/image` caller text, add the bullets in §2.
3. Component Structure: replace the `src/components/admin/` and `src/components/events/` bullets (§3).
4. Authentication: replace the `isAdmin()` mention and add the roles block (§4).
5. Supabase: add the migrations/production block (§5); Environment Variables: one change (§6).
6. Encryption, Translation Key Namespaces, Gotchas, Commands (§7–§10).

---

## 1. Pages table

Delete these rows:

- `/events/images` (`events/images/page.tsx`): the tool moved.
- `/admin` and `/admin/members`: replaced below.

Add (after `/profile/card`):

| Route | Page file | Description |
|---|---|---|
| `/admin` | `admin/page.tsx` | V-1 summary: `admin_stats()` figures, last 10 audit entries, shortcuts — board route (`force-dynamic`, `noindex`). The layout `admin/layout.tsx` guards every admin page with `requireRole("board")` and renders NavBar, `AdminHeader`, `AdminTabs`, Footer |
| `/admin/members` | `admin/members/(list)/page.tsx` | V-2 member list: server search/filters/sort/pagination through `admin_list_members` (URL params `state`, `role`, `sort`, `q`, `page`, `pp`, sanitised by `parseMembersParams`), exports (A-10 CSV, A-16 e-mail lists, S-4 register for superadmins) — board route. The `(list)` route group keeps its `loading.tsx` from wrapping the member file, so an unknown number is a real 404 |
| `/admin/members/[number]` | `admin/members/[number]/page.tsx` | V-3 member file: number checked (`^[0-9A-Za-z-]{1,32}$`) before the guard; edit (A-4), reveal DNI/phone (A-5, audited), leave/rejoin (A-6/A-7), badges (A-8), card (A-9), access link (A-15), data export (A-11), role (S-1/S-2), anonymise (S-3), last 5 audit entries — board route (`force-dynamic`, `noindex`) |
| `/admin/activity` | `admin/activity/page.tsx` | V-4 audit log: filters (dates, who, action group, member number), keyset "Carrega'n més" (`?before=<id>`) — board route |
| `/admin/procedures` | `admin/procedures/page.tsx` | V-8 written procedures P-1 … P-7 (`revalidate = false`) — board route |
| `/admin/tools` | `admin/tools/page.tsx` | V-6: cache refresh status per job (`admin_ops_status()`) and manual refresh (A-14), link to the event image tool — board route |
| `/admin/tools/event-images` | `admin/tools/event-images/page.tsx` | Internal tool: preview/download shareable event images — board route. `/events/images`, `/ca/events/images`, `/es|en/events/images` redirect here with a 308 (`next.config.ts`) |
| `/admin/roles` | `admin/roles/page.tsx` | V-5: active superadmins and board with `role_since`, rules (two superadmins minimum) — superadmin route (board and members get the 404) |

Every admin page is `noindex` and not in the sitemap. A signed-in member without a board role
gets the 404 page (not a "restricted" card); without a session the guard redirects to
`/login?redirect=<path>`.

Also update the `/profile/details` row: the "Compte" card now offers **"Dona't de baixa"**
(M-1, `LeaveAssociationDialog`, server action `leaveAssociation`), not account deletion.

## 2. API routes

Replace the bullet `src/app/api/admin/members/export/route.ts — GET endpoint for CSV export …`
with these four bullets:

- `src/app/api/admin/members/export/route.ts` — **POST** CSV export of active members (A-10).
  Body `{ role?: "all"|"member"|"board"|"superadmin", state?: "active" }`; any other key, value or
  a query string → 400 `invalid_filter`. Reads through `admin_export_members()` with the
  SESSION client (the function writes the `export.members_csv` audit entry before returning
  rows). Columns `Número, Nom, Cognoms, Email, Telèfon, DNI/NIE, CP, Ludoya, BGG, Rol,
  Newsletter, Primera alta, Alta actual, Creat`; DNI/phone decrypted with the row id; UTF-8 BOM;
  `escapeCsv` (`src/lib/csv.ts`) on every cell; a response capped by PostgREST `max_rows` (1000)
  → 500 instead of a partial file. Logs `[admin-export] user=<uuid> rows=<n>`.
- `src/app/api/admin/members/[number]/data/route.ts` — **POST** member data JSON (A-11). Body
  `{ reason?: string|null }`; a former member needs a superadmin and a reason of 10+ characters
  (`admin:reason_required`). The reason is never logged.
- `src/app/api/admin/members/emails/route.ts` — **POST** e-mail list (A-16). Body
  `{ list: "association"|"newsletter", format?: "csv"|"json" }`; `json` returns
  `{ list, count, addresses }` for "Copia les adreces". Every call is audited (`export.emails`).
- `src/app/api/admin/members/register/route.ts` — **POST** llibre de socis (S-4), superadmin
  only, body `{ reason }` (10+). Includes former members' decrypted DNI: the most sensitive file
  of the panel.

Shared rules for the four exports (add after them):

- Order of checks: same-origin `Origin` (`src/lib/http/origin.ts`, `SITE_ORIGINS` =
  `darkstone.cat`, `www.darkstone.cat`; any `http://localhost:<port>` outside production) → 403
  `forbidden_origin`; `getAdminAccess("board"|"superadmin")` → 401/403; body (JSON object, > 4096
  bytes → 413) → database. GET answers 405. Every answer is `no-store`; database errors log
  the Postgres code only. **Exports never work on `*.vercel.app` previews**, and the origin
  list must change with the production domain (like the contact form).

Replace the `src/app/api/events/[eventId]/image/route.ts` sentence "its only caller is the admin
tool `/events/images`" with "its only caller is the admin tool `/admin/tools/event-images`".

Add:

- `src/app/api/cron/retention/route.ts` — GET daily retention job (same Bearer `CRON_SECRET`
  auth and errors as `/api/cron/refresh`, `no-store`, `force-dynamic`). **Dry run unless the query
  string is exactly `apply=1`.** Calls `run_retention(p_dry_run)` (service role) through
  `src/lib/retention.ts`: purges former members 3 years after `left_on` (D-H provisional), deletes
  sign-ups unconfirmed for 30 days, deletes audit entries older than 3 years. 200 `{ ok, dryRun,
  membersPurged, unconfirmedDeleted, auditEntriesDeleted }`, 502 `retention_failed`. Called by
  `.github/workflows/retention.yml` (daily; applies only on a manual run with `apply` ticked or
  when the repository variable `RETENTION_APPLY` is `true`).
- `/api/cron/refresh` (existing bullet): add "records one `ops_job_runs` row per job (automatic,
  actor NULL) after the jobs; a recording failure never changes the answer".

In the `api/members/card` and `api/profile/calendar` bullets add: "answers 404 to a former
member (`left_on` set), even with a still-valid access token".

## 3. Component Structure

Replace the `src/components/admin/` bullet with:

- `src/components/admin/` — Admin panel. Shell: `AdminHeader`, `AdminTabs` (Resum, Socis,
  Activitat, Procediments, Eines, Rols for superadmins; `activeAdminTab(pathname)`),
  `AdminDialog` (shared dialog: portal, focus trap, inert page, Lenis stopped, optional reason
  slot with the "no DNI or phone" hint, `superadminOnly` chip, procedure link, bottom sheet on
  mobile), `StatusChip`, `Notice`, `ReasonButton` (disabled button with a visible reason),
  `adminButtons.ts`, `ExportConfirmDialog` (A-10).
  - `overview/AdminOverview` (V-1); `members/` (V-2: `MembersFilters`, `MembersList`,
    `MembersExports`, `EmailsExportDialog`, `RegisterExportDialog`);
  - `member-file/` (V-3: `MemberFile`, `PersonalDataCard` + `MemberEditForm` + `RevealButton`,
    `MembershipActions` (leave/rejoin), `BadgesCard`, `CardSection` (card + access link),
    `MemberDataExport`, `RoleCard` (roles + anonymise), `Field`, `errors.ts` (action code → text));
  - `activity/` (V-4: `ActivityFilters`, `ActivityList`, `AuditParts`); `procedures/`
    (`ProceduresContent` + `procedures.ts`); `tools/ToolsContent` (V-6); `roles/RolesContent` (V-5).
  - Server-side helpers in `src/lib/admin/`: `guard.ts` (`requireRole`, `getAdminAccess`),
    server actions `member-actions.ts` (A-4/A-5/A-8/A-9), `membership-actions.ts` (A-6/A-7),
    `access-actions.ts` (A-15), `superadmin-actions.ts` (S-1/S-2/S-3), `ops-actions.ts` (A-14),
    `action-context.ts` + `action-errors.ts` (shared guard, DB prefix → code), pure modules
    `members-list.ts`, `member-file.ts`, `activity.ts`, `audit-format.ts` (the one audit
    renderer), `stats.ts`, `ops-status.ts`, `leave-dates.ts`, `exports.ts`, `export-client.ts`.
    Mail in `src/lib/mail/` (Workspace SMTP transport shared with the contact form,
    `templates/membership.ts`, Catalan only, D-C).

Replace the `src/components/events/` bullet's "event images tool (EventImagesHero,
EventImagesContent)" with "event images tool content (`EventImagesContent`, rendered by
`/admin/tools/event-images`)".

In the `src/components/profile/` bullet replace `DeleteAccountDialog` with
`LeaveAssociationDialog` (M-1) and mention that `AccountActions` disables "Dona't de baixa" for
role holders (BR-12).

Remove `MembersTable` and `AdminDashboard` wherever they are still named.

## 4. Authentication and roles

Replace "Server-side helpers in `src/lib/supabase/auth.ts`: `getCurrentUser()`,
`getCurrentMember()`, `isAdmin()`" with "`getCurrentUser()`, `getCurrentMember()` (null for a
former member)". Add this block after the Authentication bullets:

- **Roles** (`members.role`): `member`, `board` ("Junta"), `superadmin`. Hierarchical
  (`role_rank()`: 0/1/2; `has_role(min)` true only for an ACTIVE member). Pure TS mirror in
  `src/lib/auth/roles.ts` (`toRole`, `hasRoleAtLeast`, `isBoardRole`, `isSuperadmin`,
  `roleLabelKey`). It still accepts the legacy `admin` as board until migration M7
  (`20261007100000_roles_contract.sql`) is applied in production; remove it then.
- **Guards**: pages call `requireRole("board"|"superadmin", returnTo)` (React-cached; no session →
  `/login?redirect=…`, anyone else → `notFound()`); API routes and server actions call
  `getAdminAccess(min)` (401/403). The proxy only checks for a session on `/admin` (prefix).
- **Rules in the database** (never only in the UI): BR-10 at least two superadmins (a demotion is
  refused while fewer than two OTHER active superadmins remain; promote first), BR-11 nobody
  changes their own role, BR-12 a former member holds no role and a role holder can neither
  leave nor delete their account. Enforced by `members_role_guard` / `members_role_delete_guard`
  (`role_guard:*` errors). Roles change only through `admin_set_role` (superadmin).
- **Membership state**: `left_on`, `left_by` (`self`|`board`), `leave_reason`,
  `current_joined_on`, `anonymised_at`, `purged_at`. A leave (`member_leave_self` M-1,
  `admin_member_leave` A-6) bans the auth user (`banned_until`), deletes its sessions and refresh
  tokens and rotates the card token in the same transaction; rejoin (`admin_member_rejoin`)
  lifts the ban. Former members cannot sign in (GoTrue `user_banned` is shown as the
  wrong-password text plus a "contacta amb la junta" help line), get no magic link
  (`is_email_confirmed` false) and no reset mail.
- **Password reset** goes through the server action `requestPasswordReset`
  (`src/lib/supabase/password-reset-actions.ts`), never `resetPasswordForEmail` from the
  browser: throttled per IP (10) and per address (3) per 10 min, sends only to confirmed active
  members, always answers `{ error: null }` (no enumeration). Its `redirectTo` is
  `<request origin>/auth/callback`: Supabase's redirect allow-list must contain it.
- **Audit log** (`public.audit_log`): append-only (trigger refuses UPDATE/TRUNCATE and DELETE of
  entries younger than 3 years), readable by board+, written only by SECURITY DEFINER functions
  through `audit_write()` (one entry per admin mutation, same transaction) and by
  `log_admin_event()` for the app-side events (`member.send_access_link`, `ops.cache_refresh`).
  Details never hold DNI/phone values (BR-15 detector `audit_details_leak()`, also a CHECK); the
  free-text reason is not scanned, so dialogs tell people not to type them.
- Remove the old `isAdmin()` and `deleteAccount` mentions from the Authentication section
  (the "Known gap: pre-registration …" paragraph stays).

## 5. Supabase (add a "Migrations and production" block)

- Admin panel migrations, in order: `20261005100000_membership_state` (M1),
  `20261005100100_roles_expand` (M2), `20261005100200_audit_log` (M3),
  `20261005100300_admin_read_rpcs` (M4), `20261005100400_membership_lifecycle`,
  `20261005100500_member_admin_mutations`, `20261005100600_roles_and_anonymise`,
  `20261005100700_lock_down_member_secrets` (apply + deploy together),
  `20261005100800_admin_exports`, `20261005100900_admin_exports_more`,
  `20261006100000_member_number_width`, `20261006100100_retention`,
  `20261006100200_ops_job_runs`, `20261006100300_ops_record_actor`,
  `20261006100400_activity_hide_names`, and last `20261007100000_roles_contract` (M7: only after
  the deploy and the superadmin bootstrap; it refuses to run without two active superadmins).
  The ordered production runbook lives in `odd/tasks/admin-panel.md` ("Prod runbook").
- Admin reads and writes go through SECURITY DEFINER `admin_*` functions (`search_path ''`,
  EXECUTE for `authenticated` only, role checked inside, actor = `auth.uid()`), called with the
  user's SESSION client — never the service role, or the audit actor and BR-11 are lost. Errors
  carry stable prefixes (`admin:*`, `membership:*`, `role_guard:*`, `audit:*`, `ops:*`) that
  `src/lib/admin/action-errors.ts` maps to codes.
- Board sessions cannot read other members' rows or badges directly (no `admins_select_all`);
  `get_all_members_for_admin()` no longer exists (M7).
- `ops_job_runs`: cache refresh runs (automatic via `ops_record_job_run`, manual via
  `ops_record_manual_job_run`, both service role); `admin_ops_status()` for V-6.
- `member_number_format(n)`: numbers keep 3 digits up to 999 and grow past it (`000-1000`).
- Test helpers: `createTestAdmin` creates a `board` member; superadmins are created only in
  `tests/integration/roles.test.ts` (it asserts the global count); `deleteTestUser` demotes
  first and `forceDemoteForTests` handles the last two superadmins.
- `supabase/snippets/` is owned by root (Studio), so the superadmin bootstrap SQL lives in the
  runbook text, not in that folder.

## 6. Environment Variables

- `CRON_SECRET`: "Bearer secret of `GET /api/cron/refresh` **and `GET /api/cron/retention`**".
- Add a repository **variable** (not a secret) row: `RETENTION_APPLY` — `true` makes the
  scheduled retention runs apply; anything else (or unset) keeps them dry runs.
- `SMTP_USER` / `SMTP_PASSWORD`: "also send the leave/rejoin e-mails (`src/lib/mail/`)".

## 7. Encryption (replace the `ENCRYPTION_KEY` description tail)

`encrypt(plain, memberId)` writes `v2:<member uuid>:<iv>:<tag>:<data>` (AES-256-GCM, AAD
`member:<uuid>`); `decrypt(value, memberId)` needs the owner to match. A stored value must name
its own row (`members_ciphertext_guard` trigger, `members:ciphertext_unbound`). Legacy
`iv:tag:data` values still decrypt (fallback) until production is re-encrypted with
`node scripts/reencrypt-member-secrets.mjs --dry-run` / `--apply` (exit codes 0 clean, 1 errors,
2 usage/environment, 3 duplicates); remove the fallback once a production dry run shows
`legacy=0`.

## 8. Translation Key Namespaces

No new top-level namespace. Add to the list a note: `admin` has sub-namespaces `members`,
`member_file`, `activity`, `overview`, `procedures`, `roles`, `tools`; `metadata` has
`admin_{,members_,procedures_,roles_,activity_,tools_}{title,description}`; `nav` has `admin`,
`admin_members`, `admin_procedures`, `admin_roles`, `admin_activity`, `admin_tools`.

## 9. Gotchas (add)

17. **Admin data never through the service role** — admin pages, routes and actions call the
    `admin_*` functions with the SESSION client after `requireRole` / `getAdminAccess`. The
    service role is used only for what has no user (cron, `auth.admin.deleteUser`, recording a
    manual refresh with a verified actor).
18. **Exports are POST + same-origin** — they fail on Vercel previews and on any origin missing
    from `src/lib/http/origin.ts`.
19. **Role holders cannot leave or delete their account** (BR-12): remove the role first, and
    with two superadmins promote the replacement before demoting anyone (BR-10).
20. **Legacy `admin` role** — accepted by `src/lib/auth/roles.ts` only until M7 is applied in
    production; old audit entries keep `actor_role = 'admin'` and render as "Junta".
21. **The audit log is append-only** — tests cannot delete their entries (filter by their own ids;
    `db:reset` clears them).

## 10. Commands / Lighthouse

- Lighthouse audits now cover 19 pages (`/events/images` removed: admin only, `noindex`); update
  "all 20 pages … 40 audits" to "all 19 pages … 38 audits".
- Add to Testing: `.github/workflows/retention.yml` and `cache-refresh.yml` run with
  `permissions: {}` and a `concurrency` group.
