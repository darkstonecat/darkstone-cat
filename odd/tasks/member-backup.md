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
- **S7 Restore.** `npm run migrate -- --from-backup <csv>` (spec §7) + runbook `docs/operations/member-restore.md`.
- **S8 Privacy.** Privacy policy and data protection texts in ca/es/en name Google as processor for the backup and the 5-week bound; procedure P-8 (spec §9, §12).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S2, S4, S6 | inline: `src/lib/backup/` (rows, CSV, Drive client), route `/api/cron/backup`, unit tests | pending | — |
| T2 | S6 | inline: migration `member_backup` in `ops_job_runs` CHECK + `admin_ops_status()`, recorder, V-6 label ca/es/en, integration test | pending | — |
| T3 | S5, S6 | inline: `.github/workflows/member-backup.yml` + workflow test | pending | — |
| T4 | S3, S7 | inline: `migrate-members.mjs --from-backup`, tests, runbook | pending | — |
| T5 | S8 | inline: privacy / data protection texts, procedure P-8 | pending | — |
| T6 | all | inline: docs (spec status and D-1, `CLAUDE.md`, README), full suite | pending | — |

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
