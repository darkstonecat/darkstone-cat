# Badge catalogue managed by the board

Objective: the board creates, edits, archives and deletes badges, and awards them to members, without migrations or deploys.
Branch: `feat/badge-catalogue` (from `develop`). Delivery: `ask-on-risk`, chain `feature-branch-chain` (user, 2026-11-03: "Todo en la rama, al final"): one work-unit commit per task on this branch, merged into `develop` when T1-T3 are done. Test runner: Vitest (`npm run test:unit`, `npm run test:integration` with local Supabase), Playwright for UI.

## Specs

- **S1 Catalogue in the database.** User: "seria requerido hacer que los admins pudieramos crear nuevas, eliminar y gestionarlas en los usuarios." A table `public.badges` replaces the hard-coded list (`member_badges` CHECK, `admin_badge_keys()`, `STORED_KEYS`, `BADGE_ORDER`, `KNOWN_BADGE_KEYS`, audit `BADGES`, `ICONS`, i18n `badge_*`). Columns: `key` (immutable slug, primary key), `name`, `earned_text`, `locked_text` (`{ca, es, en}`, `ca` required, the others fall back to `ca`), `icon` (one of a closed list of `react-icons/md` icons, no uploads), `sort_order`, `show_locked`, `archived_at`/`archived_by`, `created_by`, `created_at`, `updated_at`. `member_badges.badge_key` becomes a foreign key to it (the existing rows already use valid keys: no data migration). The two current badges are seeded with today's texts. Members read the catalogue except archived badges; API roles cannot write it.
- **S2 Board functions.** SECURITY DEFINER `admin_*` functions called with the session client, one audit entry per change: list (with holder counts), create, update (the key never changes), archive, restore. Delete is superadmin-only and only for a badge that was never awarded ("Borrar de verdad: solo superadmin, y solo si nunca se ha concedido").
- **S3 Archiving.** User, asked whether holders keep an archived badge: "Desaparecen para todos". An archived badge is hidden from every member (earned or locked) but its `member_badges` rows are kept, so restoring it is lossless. It cannot be awarded or revoked (`admin:badge_archived`). The member file shows it greyed as "Arxivada". The member data export (A-11) and the register (S-4) still include it.
- **S4 Awarding.** `admin_award_badge` / `admin_revoke_badge` validate against the non-archived catalogue. A bulk award gives one badge to several active members at once, one audit entry per member, skipping members who already hold it.
- **S5 Audit snapshot.** Every badge audit entry stores the Catalan name at that moment, so the activity log stays readable after a rename or a delete. New actions `badge.create`, `badge.update`, `badge.archive`, `badge.restore`, `badge.delete` (no target member), all inside the existing `badge.*` filter group.
- **S6 App reads the catalogue.** Member home, member file and activity log read names, texts, icons and order from the catalogue; nothing visible changes for members after the switch.
- **S7 Admin UI.** A new admin tab "Insígnies": catalogue with holder counts, create and archive; one page per badge to edit texts and icon (with a preview), see holders and bulk-award. The archive dialog says how many members stop seeing it ("N socis la deixaran de veure").
- **S8 Tenure badge (done).** User: "Deberia ser automatica, contando desde la fecha de la actual alta, por cada año que pase cambiar la insignea a \"X años con Darkstone\", y que solo sea una que va cambiando de nombre." and "Sustituye" (it replaces "Membre {year}"). Derived in code, never in the catalogue.
- Out of scope (user: "estas insigneas las dejamos descartadas"): badges for sessions attended or plays, because the Ludoya public API has no attendees.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T0 | S8 | inline | done | `570ad79` (on `develop`) |
| T1 | S1-S5 | inline (no writer trigger: one unit, sequential); high risk (items 1-3) → independent verifier | checks green, verifier running | RED 22/22 failed before the migration; GREEN integration 545/545 (32 files) |
| T2 | S6 | inline | pending | |
| T3 | S7 | inline | pending | Carry over: map `audit:sensitive_details` on badge names to a clear message; render the new `badge.*` actions in `audit-format.ts` |

Forecast: T1 about 700 authored lines (migration + integration tests), T2 about 300, T3 about 900. Above the 400-line budget: ask for the chain strategy before the T1 commit. Actual T1: about 1560 lines (migration 958, tests 567, CLAUDE.md).

## Log

- L1 (2026-11-02) User: "Para los usuarios se hizo un mecanismo de insignias, se diseño con una idea futura, pero seria requerido hacer que los admins pudieramos crear nuevas, eliminar y gestionarlas en los usuarios. Analiza como se podria hacer esto y propón un diseño para ello."
- L2 (2026-11-02) Archiving: "Desaparecen para todos".
- L3 (2026-11-03) Logic badges asked ("X años en la asociación, X sesiones jugadas, X partidas jugadas"). Verified live against `https://api.ludoya.com/public/v1/openapi.json` and the club key: no public GET lists attendees (only `participantCount`; 1110 past events; 0 campaigns). User: "estas insigneas las dejamos descartadas y solo se hace la lógica de tiempo desde que es socio".
- L4 (2026-11-03) Tenure redesigned as one yearly badge from the current sign-up, replacing "Membre {year}". T0 done and committed on `develop` (`570ad79`): unit 1701/1701, integration member-admin-mutations 93/93, e2e profile + member-badges-card 19/19.
- L5 (2026-11-03) User: "continua". T1 started on `feat/badge-catalogue`.
- L6 (2026-11-03) T1 written: migration `20261103100000_badge_catalogue.sql` applied to local Supabase (`supabase migration up --local`), tests `tests/integration/badge-catalogue.test.ts` (22) + superadmin delete block in `roles.test.ts` (2). Decision: `member_badges_select_own` stays unchanged, because the member's own data export (`src/lib/profile/actions.ts`) must keep archived badges; archived badges are hidden through the catalogue RLS and the app. One fix during GREEN: `text[] || 'literal'` parsed the literal as an array (22P02), replaced by `array_append`. Checks: integration 545/545, tsc and eslint clean. RDD is off (global), so no native review. Independent verifier launched (high risk: persisted constraint, SECURITY DEFINER guards, admin_get_member contract).
- L7 (2026-11-03) Delivery chain chosen by the user: "Todo en la rama, al final (Recommended)".
- L8 (2026-11-03) Independent verifier: S1-S5 met, no blockers; probed the grants, the archived-badge award races (two psql sessions) and the regressions. Advisory 1 fixed: `service_role` loses INSERT/UPDATE/DELETE on `public.badges` (test cleanup now runs as the owner via `runSqlAsPostgres`), new test added. Advisories 4 (BR-15 on board-typed names) and 6 (audit renderer) carried to T3; 3 and 5 accepted (pre-existing / fine at club size). Integration 546/546, tsc and eslint clean.
