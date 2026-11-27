# Member backup — functional specification

Status: **draft for board review**. This document describes what the board gets, how it is kept up to date, who can read it, and how the member list is rebuilt from it. It is not an implementation plan; route, table and variable names are only there to make the behaviour unambiguous.

## 1. Why

The member list lives only in the production Supabase database, on free plans of external services (Supabase, Vercel, GitHub), and one person maintains the whole site. The board asked for two things:

1. **Read the member data without the website**: if the site, the database or the maintainer is gone, the board can still open the list.
2. **Rebuild the member list** on a new database from that same copy.

One weekly Google Sheet in the association's Google Workspace covers both. A full database dump (`pg_dump`) was considered and **dropped by the board**: the site is rebuilt from the repository and its migrations, and the members from this Sheet (§7).

## 2. Scope

In scope:

- A Google Sheet with every member row the database holds (active and former members), with DNI/NIE and phone decrypted.
- Generated automatically every week; old copies deleted automatically.
- A restore path: the import script reads the Sheet into an empty database.
- A continuity kit held by the board (§8) and the privacy policy changes (§9).

Out of scope, not in the backup:

- The audit log, sessions, passwords (members sign in again with the magic link or "Forgot password", as imported members do today), card tokens (new ones are generated on restore, so printed or saved cards from before the restore stop verifying).
- The badge catalogue and the member benefits: board-managed content with a handful of rows, re-created by hand from the admin panel. The Sheet keeps each member's badge keys, so badges are re-awarded once the catalogue exists.
- Members already purged by the retention job: they are not in the database, so they are not in the Sheet.

## 3. What the board gets

One Google Sheet per run, named `Darkstone · Socis · YYYY-MM-DD` (date of the run, Madrid time), in the backup folder of the shared drive (§5). One header row, one row per member, sorted by member number. Dates are `YYYY-MM-DD`.

| Column | Content |
|---|---|
| Número | Member number (`000-001`) |
| Estat | `Actiu` or `Exsoci` |
| Nom / Cognoms | First and last name |
| Email | E-mail |
| Telèfon | Decrypted phone; empty if not given or deleted on leaving |
| DNI/NIE | Decrypted DNI/NIE; empty if not given |
| CP | Postal code |
| Ludoya / BGG | Usernames |
| Rol | `member`, `board` or `superadmin` |
| Newsletter | `Sí` / `No` |
| Primera alta / Alta actual | First and current *alta* |
| Data de baixa / Baixa per / Motiu de baixa | Empty for active members |
| Anonimitzat | Date, if a superadmin anonymised the member |
| Insígnies | Badge keys with their award date: `key@YYYY-MM-DD; key@YYYY-MM-DD` |
| Creat | Row creation date |

Rules:

- A former member's row holds what the database still holds after the *baixa* (admin panel spec §4.2): contact and profile fields are already empty there.
- Every cell goes through the existing `escapeCsv` (`src/lib/csv.ts`), so a value starting with `=`, `+`, `-` or `@` is never run as a Sheets formula.
- If a DNI or phone cannot be decrypted, the cell says `(illegible)` and the run is still a success; the count is reported (§6).
- The file description says when and how it was generated and that it must not be shared outside the backup folder.

## 4. Schedule and retention

- **Weekly**, Monday at 03:00 UTC, plus a manual run from GitHub (`workflow_dispatch`).
- After a successful upload, the run **permanently deletes** every older backup file in the folder except the newest **4** (the trash is skipped). Only files the job created are touched (marked with a Drive app property), never a file someone else put there.
- So a person who leaves or asks for erasure disappears from every copy in **at most 5 weeks**. That figure goes in the privacy policy (§9).
- A copy someone downloads or duplicates outside the folder is outside this guarantee; the folder settings in §5 make that harder, and the procedure says not to do it.

## 5. Where it lives and who reads it

- A **shared drive** of the darkstone.cat Google Workspace (e.g. `Darkstone · Còpies de socis`), not a personal "My Drive" folder: a shared drive belongs to the association and survives any one account.
- Members of the shared drive: the named accounts chosen by the board (decision D-1), each with 2-Step Verification, plus the service account (§6) as **Manager** (needed to delete files permanently).
- Shared drive settings: no sharing outside the domain, no access for non-members; viewers cannot download, print or copy (decision D-3).
- Google keeps the data encrypted at rest; access control is the drive membership. There is no extra password on the file (board decision).

## 6. How it runs

```
GitHub Actions (member-backup.yml, weekly)
  → GET https://www.darkstone.cat/api/cron/backup   (Authorization: Bearer $CRON_SECRET)
      → read every member row (service role) + badges
      → decrypt DNI/phone (ENCRYPTION_KEY, already in Vercel)
      → build the CSV
      → Google Drive API: upload, converted to a Google Sheet, into the backup folder
      → delete older backup files beyond the newest 4
      → record the run (ops_job_runs, job 'member_backup')
```

Why the work runs on Vercel and not in the GitHub runner: the database key and `ENCRYPTION_KEY` stay where they already are. GitHub keeps holding only `CRON_SECRET`, as for the cache refresh and retention jobs.

Route `GET /api/cron/backup`:

- Same auth and errors as `/api/cron/refresh`: 500 `not_configured` without `CRON_SECRET` or the Google settings, 401 on a wrong secret, `no-store`, `force-dynamic`.
- 200 `{ ok: true, rows, illegible, deleted }`; 502 `{ ok: false, error: "backup_failed" }` when the read, the upload or the clean-up fails. A failed clean-up after a successful upload still answers 502, so an old copy that outlives the 4-copy limit is noticed.
- Logs counts and Google error codes only: never names, e-mails, DNIs, phones or the file contents.
- Reads with the service role: there is no user (admin panel gotcha 17 allows the service role for cron jobs).

Workflow `.github/workflows/member-backup.yml`: `permissions: {}`, a `concurrency` group, production only, runs from `main` (like `cache-refresh.yml`).

Google access:

- One service account in a Google Cloud project owned by the association's Workspace, Drive API enabled, one JSON key.
- New Vercel env (Production): `GOOGLE_BACKUP_SERVICE_ACCOUNT` (the JSON key, base64) and `GOOGLE_BACKUP_FOLDER_ID` (the backup folder in the shared drive). Neither is added to `assertProductionEnv`: a missing value makes the backup answer `not_configured`, it does not block deploys.
- Calls: Drive v3 `files.create` (multipart, `mimeType: application/vnd.google-apps.spreadsheet`, so the CSV is converted), `files.list` and `files.delete`, all with `supportsAllDrives=true`. Token from a JWT signed with the key (Node `crypto`, no `googleapis` dependency). Scope: `drive.file` if it can write into the shared folder, otherwise `drive` (to confirm during implementation).

Monitoring:

- `/admin/tools` (V-6) shows the last run and the last success of `member_backup`, next to the cache jobs. This needs the `ops_job_runs` job CHECK and `admin_ops_status()` widened (a migration).
- A failed workflow run e-mails the repository owner. The board's procedure (§10) includes a monthly look at the folder date, so a silent stop is noticed even without the maintainer.

## 7. Restore

`npm run migrate -- --from-backup <file.csv>` (the Sheet downloaded as CSV), against a new database with the migrations applied:

- Insert-only, like today's import: it skips a member whose e-mail already exists, and starts with a dry run.
- Keeps the member number, first and current *alta*, role, newsletter, usernames, the *baixa* fields (a former member's auth user is created banned, as a *baixa* leaves it) and the anonymised date.
- Re-awards badges whose key exists in the catalogue; reports the missing keys so the board creates them and runs the import again.
- Creates confirmed auth users without a password, encrypts DNI/phone with the new database's row ids, and moves `member_number_seq` past the highest number.
- Roles: the database guards (BR-10, BR-11) must accept the inserted roles on an empty database; confirm during implementation and document the order if they do not.

Runbook: `docs/operations/member-restore.md` (new), written so a developer who has never seen the project can follow it with the continuity kit.

## 8. Continuity kit

Held by the board **outside Google Drive and outside the repository** (a shared password manager or a sealed envelope), reviewed once a year:

- `ENCRYPTION_KEY` (without it, a restore can rebuild the list from the Sheet but not read old DNI/phone values from any other source).
- Owner access to: Supabase, Vercel, GitHub repository, the domain registrar, Google Workspace (super admin) and the Google Cloud project.
- Links to the repository, `docs/README.md` and the restore runbook.
- One page: "what to give a new developer".

## 9. Privacy and legal

- **Privacy policy** and **data protection document**, in `ca`, `es` and `en`: add Google (Workspace) as a processor of member data for backups, the purpose (continuity of the association's register), and the retention of the copies (at most 5 weeks after a change or erasure).
- The Workspace admin accepts Google's data processing terms (Cloud Data Processing Addendum) in the admin console, if not done already.
- Former members' DNI: the admin panel spec (§4.5, "Blocked") hides it from the board and lets only a superadmin reveal it, with a reason. A Sheet readable by the board breaks that rule unless D-1 restricts the access or leaves that column out for former members.

## 10. Open decisions for the board

| ID | Question | Recommendation |
|---|---|---|
| D-1 | Who can open the backup folder? | The superadmins only (2 people). If the whole board needs it, leave former members' DNI out of the Sheet. |
| D-2 | Frequency and number of copies? | Weekly, 4 copies (5-week erasure bound). |
| D-3 | Can readers download, print or copy the Sheet? | No (shared drive setting). The superadmins export by hand if a restore is needed. |
| D-4 | Who holds the continuity kit? | Two board members, not the maintainer alone. |

## 11. Prerequisites (Google Workspace admin, not code)

1. Create the shared drive and the backup folder; set the sharing restrictions of §5.
2. Create a Google Cloud project under the Workspace organisation, enable the Drive API, create the service account and one JSON key. If the organisation policy blocks key creation (`iam.disableServiceAccountKeyCreation`), the Workspace admin allows it for this project.
3. Add the service account to the shared drive as Manager.
4. Add the named accounts (D-1) and require 2-Step Verification for them.
5. Hand the key and the folder id to the maintainer, who stores them in Vercel; delete any local copy of the key afterwards.

## 12. Delivery and acceptance

Code changes:

- `src/app/api/cron/backup/route.ts` and a backup module in `src/lib/` (build rows, CSV, Drive client).
- Migration: `member_backup` in the `ops_job_runs` CHECK and in `admin_ops_status()`; V-6 label in the three locales.
- `.github/workflows/member-backup.yml`.
- `scripts/migrate-members.mjs`: `--from-backup`.
- Privacy policy and data protection texts (§9), procedure P-8 "Còpia de seguretat de socis" in `/admin/procedures`.
- Docs: this spec, `docs/operations/member-restore.md`, `CLAUDE.md` (route, env, workflow, migration).

Acceptance:

1. A manual workflow run creates one Sheet in the folder with one row per member in the database and the columns of §3; DNI and phone match the admin panel's revealed values for two sample members.
2. With 5 backup files present, a run leaves exactly the newest 4 plus the new one minus the oldest (4 in total); a file not created by the job is untouched.
3. A wrong or missing secret answers 401 / 500 without touching Drive; a Drive failure answers 502 and records a failed run in V-6.
4. Restoring the latest Sheet into a fresh local Supabase gives the same member numbers, roles, states and badge holders as the source, and a dry run afterwards reports 0 to create.
5. No log line, response body or workflow output contains a name, e-mail, DNI or phone.
