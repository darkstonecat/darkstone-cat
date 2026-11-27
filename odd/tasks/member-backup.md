# Member backup: weekly Google Sheet in the Workspace shared drive

Objective: implement `docs/features/member-backup/spec.md` (weekly Sheet with every member row, retention of 4 copies, restore through the import script, privacy texts).
Branch: `feat/member-backup` (from `develop`). Delivery: `ask-on-risk`, `feature-branch-chain`: one work-unit commit per task, merged into `develop` when done. Forecast ~900 authored lines. Test runner: Vitest (`npm run test:unit`, `npm run test:integration` with local Supabase). One migration (`ops_job_runs` job list).

## Specs

- **S1 Purpose.** User (L1): "Desde la junta requieren tener un backup de la lista de socios con todos sus datos en google drive." User (L2): "si algun dia la web dejamos de tenerla o se va la bd [...] quieren poder acceder a los datos o tenerlos de alguna forma."
- **S2 Format.** User (L3): "Prefieren un google sheet directo de leer." No password on the file. Columns, order and rules: spec §3.
- **S3 No database dump.** User (L3): "El punto 2 no lo veo necesario, dado que se puede reconstruir como hacemos actualmente". Rebuild from the Sheet with the import script (spec §7).
- **S4 Access (D-1).** User (L5): "Solo superadmins (Recommended)": only the superadmins read the shared drive; the Sheet carries every column, former members' DNI included.
- **S5 Schedule and retention.** Assumption (spec D-2 recommendation, not answered): weekly, keep the newest 4 job-made files, permanent delete of older ones (spec §4).
- **S6 Runner.** Spec §6: GitHub workflow → `GET /api/cron/backup` (Bearer `CRON_SECRET`) on Vercel; env `GOOGLE_BACKUP_SERVICE_ACCOUNT` (JSON key, base64) and `GOOGLE_BACKUP_FOLDER_ID`, already set in Vercel Production (L4); run recorded in `ops_job_runs` as `member_backup`, shown in V-6.
- **S7 Restore.** `npm run restore -- <csv>` (separate script, L6 b; spec §7) + runbook `docs/operations/member-restore.md`.
- **S8 Privacy.** Privacy policy and data protection texts in ca/es/en name Google as processor for the backup and the 5-week bound; procedure P-8 (spec §9, §12).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S2, S4, S6 | inline: migration `backup_member_rows()`, `src/lib/backup/` (sheet cells, Drive + Sheets client, job), route `/api/cron/backup`, tests | done (integration 5, unit 25) | ac63a6f |
| T2 | S6 | inline: migration `member_backup` in `ops_job_runs` + `admin_ops_status()` (manual backup run refused), route records runs, V-6 status card ca/es/en | done (RED: 2 integration, 3 component; GREEN) | 870484c |
| T3 | S5, S6 | inline: `.github/workflows/member-backup.yml` + workflow test | done (RED: file missing; GREEN 3) | 378832e |
| T4 | S3, S7 | inline: separate `scripts/restore-members.mjs` (`npm run restore`, see L6) + migration `restore_raise_member_number_seq()`, round-trip integration test, runbook | done (RED: 3 integration; GREEN 13) | 942d9ea |
| T5 | S8 | inline: privacy / data protection texts (both update dates), procedure P-8 (warning + link to Eines) | done (RED: 1 document, 3 procedures; GREEN) | d4c0a48 |
| T6 | all | inline: spec to delivered behaviour, `CLAUDE.md`, README, docs index; db:reset + full suite; independent verifier | done (suite L7; verifier L8) | 6a2188b + fix commit |

Route evidence: tasks share the backup module and docs; no parallel units with disjoint surfaces of several minutes each, so no writer trigger. Expected Risk: item 1/2 for T1 (decrypted member data leaves the database; credentials), item 1 for T2 (migration), item 5 for T3 (CI).

## Log

- **L1** (2026-11-19) User: "Desde la junta requieren tener un backup de la lista de socios con todos sus datos en google drive.
Analiza si esto es posible"
- **L2** (2026-11-19) User: "Son las dos cosas, si algun dia la web dejamos de tenerla o se va la bd, ahora dependemos de servicios externos gratuitos y nunca se sabe, tambien estoy yo como único desarrollador y mantenimiento de todo.
Por ello quieren poder acceder a los datos o tenerlos de alguna forma."
- **L3** (2026-11-19) User: "Prefieren un google sheet directo de leer.
El punto 2 no lo veo necesario, dado que se puede reconstruir como hacemos actualmente". Spec drafted (`docs/features/member-backup/spec.md`).
- **L4** (2026-11-27) User: "Ya estan las variables de entornos creadas en vercel, la carpeta de google drive y demás creado."
- **L5** (2026-11-27) D-1 answered: "Solo superadmins (Recommended)". Branch `feat/member-backup` created.
- **L6** (2026-11-27) Decisions during T1-T4: (a) the Sheet is created empty through Drive and filled with the Sheets API `valueInputOption=RAW`, because a CSV converted by Drive parses values (postal code 08221 → 8221, "+34" phones → numbers); the Google Cloud project needs the **Sheets API enabled** (user action). (b) The restore is its own script, not `migrate-members.mjs --from-backup`: the Form import cleans names, merges by e-mail and renumbers, the opposite of an exact restore. (c) `restore_raise_member_number_seq()` raises (never lowers) the sequence: without it the sign-up trigger hands out numbers the backup assigns to other members (unique violation). (d) A not-configured backup call records a failed `member_backup` run (`not_configured`) so V-6 shows it. RDD is off globally: no native review; one independent verifier at the feature end (Risk items 1, 2, 5).
- **L7** (2026-11-27) `npm run db:reset` applied the 3 new migrations from scratch; `npm test`: 196/197 files, 2800/2801 tests. The one failure (`ops-job-runs.test.ts` › `admin_ops_status` saw a `ludoya` run by "Ops Action") is a pre-existing race: `tests/integration/ops-action.test.ts` writes `ludoya`/`bgg` runs into the shared `ops_job_runs` while `ops-job-runs.test.ts` expects them empty. Proof: the `develop` version of the test fails the same 5-6 cases when run beside `ops-action.test.ts`; alone it passes (12/12). Not fixed (out of scope), reported.
- **L8** (2026-11-27) Independent verifier (whole document, baseline `develop`): S1-S7 pass, 2 blockers. (1) Restore undo could not remove a half-restored superadmin (BR-10/BR-12 refuse the demotion and the delete; supabase-js returned the errors silently), e.g. a repeated badge key failing the insert. Fixed: the role is written as the last step, repeated badge keys are an invalid row, undo checks every error and reports `NOT UNDONE`; also names default to "" and both alta dates are required (NOT NULL; found while writing the regression test). (2) Privacy texts promised that "a baixa disappears" in 5 weeks, but former members stay in the Sheet until the 3-year purge; the site privacy policy lacked processor and bound. Fixed in ca/es/en, P-8 s3 and spec §4/§9. Regression tests: `restore-members.test.ts` (repeated key, missing dates), `member-restore.test.ts` (superadmin with failing badge insert is removed, re-run restores it with its role), `member-backup-texts.test.ts`. Advisories applied: per-call Google timeout 8 s (6 calls < 60 s), stale comment, honest sequence-race comment. Advisories left: orphan file if Drive's create response is not JSON, fallback codes `google_failed`/`cleanup_failed` (now listed nowhere else), no Drive pagination (≤ 5 files), English "disclosure" wording applied.
- **L9** (2026-11-27) User (Google side, step 1): Google Cloud project `darkstone-backups`; service account matches the key in Vercel; Drive API and Sheets API enabled (Sheets today); no org restriction found or changed (`gcp.restrictServiceUsage` inactive; no domain-wide delegation, so Workspace API controls do not apply). Next: push the 3 migrations to production (dry run first), then merge and deploy, then a manual workflow run.
- **L10** (2026-11-27) Step 2: the user reset the production DB password (unknown), ran `npx supabase db push --linked --dry-run` in their own terminal (listed exactly the 3 `20261127100*` migrations), then `npx supabase db push --linked`: all 3 applied. After: `/` and `/events` answer 200; `/api/cron/backup` 404 (code not deployed yet, expected). Next: merge and deploy, then a manual run of the "Member backup" workflow.
- **L11** (2026-11-27) Step 3 (user: "Si, hazlo"): `feat/member-backup` fast-forwarded into `develop` (branch deleted), `develop` and `main` pushed (bcc24e8). CI run 45985845432 failed E2E: `e2e/admin/procedures.spec.ts` still expected 7 procedures (caused by P-8; E2E had not been run before the merge, a process miss) and `e2e/auth/login.spec.ts` magic=error (2 alerts; untouched by the diff, passed locally with the 5 affected specs, 40/40). Fixed in 0f6cbd4; CI run 45987488581 green (5/5 jobs, login passed: flaky), Vercel success. Production: `/` and `/events` 200, `/api/cron/backup` 401 `unauthorized` without the secret (route live). Next: manual run of the "Member backup" workflow, then check the Sheet and V-6.
