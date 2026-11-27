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
| T6 | all | inline: spec to delivered behaviour, `CLAUDE.md`, README, docs index; db:reset + full suite; independent verifier | in progress (suite: 2800 passed, 1 pre-existing race, L7) | — |

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
