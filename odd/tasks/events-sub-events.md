# Events sub-events (`/events`)

Objective: show every published sub-event of a Ludoya event (direct plays, plays inside meetups, tournaments, activities, always-open demos) inside its `/events` card, with one family of card variants for every event, time slots above a threshold, and one collapsible section per day.
Branch: `feat/events-sub-events` (from `develop`). Delivery: `ask-on-risk`, `feature-branch-chain` (assumption, same as earlier features): one work-unit commit per task, merged into `develop` when the user says so. Test runner: Vitest (`npm run test:unit`), Playwright (`npm run test:e2e`, `LUDOYA_MOCK=1`).

## How to start or resume (new session)

Prompt: **"Continúa la feature events-sub-events (odd/tasks/events-sub-events.md): siguiente tarea pendiente."**

1. `mem_context`, then `mem_search` "events-sub-events" (project `darkstone-cat`), then read this file to the end of `## Log`.
2. `git switch feat/events-sub-events` (create it from `develop` if missing, carrying this file and the mockup folder).
3. Take the first task in `## Tasks` that is not `done`, implement it test-first, run its checks, commit it, set its status and commit here, append a Log line, update the Engram mirror `odd/events-sub-events/tasks`.

Design reference (approved, L6): `odd/tasks/events-sub-events-mockup/`. The boards are `Main.dc.html` (desktop, two-day special), `Mobile.dc.html`, `Session.dc.html` (weekly sessions under and over the threshold) and `Pieces.dc.html` (card variants and mapping rules). The canvas is https://claude.ai/artifact/1BnEqwD6GKPBUpG4kJD8hF (private). Covers in the mockup are coloured blocks. The texts are Catalan; production copy goes to `src/messages/{ca,es,en}.json`.

API evidence (live, 2026-11-11): `GET /events?includeSubEvents=true` already returns the whole tree, at most 2 levels deep (root, child, grandchild), with no orphans. Child `type` is `MEETUP`, `PLANNED_PLAY` or `TOURNAMENT`. Useful fields: `parentId`, `slug`, `alwaysOpen`, nullable `startsAt`/`endsAt`, `game`, `imageUrl`, `capacity`, `participantCount`, `minParticipants`, `attendanceMode` (`RSVP|NONE|EXTERNAL|LUDOYA_TICKETS`), `tournament.format` (`SWISS|MIXER|SINGLE_ELIM|DOUBLE_ELIM|TABLE_KNOCKOUT`), `draft`, `canceled`, `visibility`. Today `normalize.ts:190-194` keeps only `PLANNED_PLAY` children of a root. No new request is needed.

## Specs

- **S1 Every sub-event.** User (L1): "Analiza que datos podemos obtener con la api pública de ludoya para poder poner dentro de cada evento general todas las partidas directas y subeventos de este". User (L2): "Estaria bien poder contar con las partidas de dentro de MEETUP". Every published descendant of a root event (children and grandchildren) belongs to that event's card. A `MEETUP` with children is a **zone**: it is not a card; its title names its children (subtitle on play and tournament cards, group title in the always-open block).
- **S2 Drafts hidden.** User (L2): "Los borradores no hace falta mostrarlos." A `draft` or `canceled` node is hidden together with all its descendants. The public page keeps showing `PUBLIC` nodes only; an `ONLY_GROUP` node hides its subtree too.
- **S3 Always open.** User (L2): "las demos allways open se deben mostrar indicandolo". User (L5): "SI, haz plegable la sección todos los dias." User (L6): "Si, deberia ir con los de siempre abiertos, con ese grupo que propones". A node goes to the always-open block when it has `alwaysOpen: true`, has no dates, or covers the whole event (starts at or before the event start and ends at or after its end). The block:
  - is collapsible and open by default;
  - is titled "Tot l'esdeveniment" for a multi-day event and "Tot el dia" for a one-day event (assumption: the mockup's "Tot el cap de setmana" made generic);
  - carries the pill "Sempre obert · sense hora";
  - groups its items by parent zone ("Demostracions de 2tomatoes");
  - puts items with no parent zone in the group "Altres activitats" (for example A Risk Cat);
  - shows square tiles with the badge "Demo" (a child of a zone) or "Activitat" (no zone).
- **S4 Covers.** User (L2): "Intentar buscar portado y sino poner un placeholder o algo." Order:
  - a node with `game`: the BGG cover (existing name + year matching), else `game.imageUrl`, else the node `imageUrl`;
  - a node without `game`: the node `imageUrl`, else a BGG lookup by title, else the existing dice placeholder ("Sense portada").
  - The BGG lookups keep `COVER_BUDGET_MS`.
- **S5 Tournaments.** User (L2): "Los torneos deberian indicarse que son torneos y el tipo." A `TOURNAMENT` card carries an orange badge "Torneig · <format>" (no format → "Torneig"). The format labels for ca / es / en are in `Pieces.dc.html`: SWISS "Sistema suís", SINGLE_ELIM "Eliminació directa", DOUBLE_ELIM "Doble eliminació", TABLE_KNOCKOUT "Eliminatòria per taules", MIXER "Taules rotatives". The button reads "Entrada" when `attendanceMode` is `LUDOYA_TICKETS`, otherwise "Inscriu-t'hi". The seat pill works as on plays.
- **S6 One card family for every event.** User (L4): "La forma de variantes tarjetas debe ser para todos, no solo para eventos especiales o que usen esta forma de eventos por tiempos." Sessions and specials use the same variants:
  - play: today's `PlayCard`, plus a zone subtitle;
  - tournament: S5;
  - activity: a `MEETUP` without children that has a time, or a leaf with no game; it shows the event image, no seat pill, the badge "Activitat" and the button "Més info";
  - demo / always-open tile: S3;
  - placeholder cover: S4.
- **S7 Time slots above a threshold.** User (L4): "Este sistema de marcas por horas y demás debe funcionar para toda clase de evento cuando se detecten mas de X partidas." User (L5): "Me parece correcto el umbral." When an event has more than `PROGRAM_SLOT_THRESHOLD = 8` timed items, they are grouped by start time (Madrid "HH:mm"), one row per start time. At 8 or fewer, the grid stays as today, sorted by start. Always-open items never count.
- **S8 Every day visible, collapsible.** User (L4): "Se deben mostrar todos los dias directamente, no con filtros, en todo caso, desplegables que se puedan colapsar o extender." User (L3) first chose "Por día". An event that spans more than one Madrid day shows one collapsible section per day that holds items, all open by default. Each section has a title ("Dissabte 28 de novembre") and a summary ("4 partides · 3 tornejos · 2 activitats"). Inside each day, S7 applies to that day's items. An item belongs to the day it starts on. There are no tabs or filters.
- **S9 Event summary.** The open special card shows count chips ("8 partides · 3 tornejos · 13 demos · 3 activitats"). The collapsed session summary and the week summary count plays and tournaments, and their free seats. The cover stack uses the first items with covers.
- **S10 Unchanged.**
  - The admin event images (`fetchUpcomingEvents`, `LudoyaEvent.plannedPlays`) keep direct plays only.
  - The calendar, day strip, banners, countdown and usual-venue rules stay as they are.
  - The "Proposa una partida" tile stays at the end of the grid (of the last day when there are day sections).
  - Organizer names never reach the browser.
- **S11 Architecture.** User (L7): "Ten en cuenta de hacer un diseño clean code, modular y reutilizable, con separación de dependencias." Layers, each depending only on the one below:
  1. **Adapter** (`src/lib/ludoya/`): the only code that knows raw shapes; outputs a typed tree.
  2. **Covers** (`src/lib/member-sessions.ts` + `game-matching.ts`): walks the tree through two pure helpers (`collectCoverRequests`, `applyCovers`); knows nothing of the UI.
  3. **Program domain** (`src/lib/events/program/`, pure, no React, no `server-only`): classify the tree into items, then lay them out. Fed by a minimal input type, not by Ludoya types.
  4. **View model** (`agenda-view.ts`, `agenda-format.ts`): server-side formatting of times and labels.
  5. **UI** (`src/components/events/program/`): presentational components that print the view model, plus one client component for collapse state.

  Each module is small with one reason to change. Shared state goes through the existing helpers (`seatCounter`, `SeatPill`, `PlayCard` cover markup, `toPlace`, the `madridDay`/`clock` formatters); none of them is re-implemented.

## Architecture (reference for every task)

```
Ludoya JSON ─▶ normalize.ts ─▶ LudoyaSession { plannedPlays (direct, unchanged), subEvents: LudoyaSubEvent[] (tree) }
                                   │
member-sessions.ts withCovers ─────┤  collectCoverRequests(tree) → resolvePlayCovers → applyCovers(tree, covers)
                                   ▼
events/program/classify.ts  tree ─▶ ProgramItem[]  (kind: play | tournament | activity | demo; zone; placement: timed | alwaysOpen)
events/program/layout.ts    items + event range ─▶ ProgramLayout { days: [{ day, mode: grid|slots, groups }], alwaysOpen: [{ zone, items }] }
events/agenda-view.ts       session ─▶ AgendaEvent { items, layout }      (PUBLIC filter recursive, no organizer)
events/agenda-format.ts     AgendaEvent ─▶ EventView { program: ProgramView } (time ranges, day titles, summaries)
components/events/program/  EventProgram → DaySection* → ProgramGrid | ProgramSlots → ItemCard (variants)
                            AlwaysOpenSection → AlwaysOpenTile
```

Key types (names indicative):

- `LudoyaSubEvent { id, kind: "play"|"tournament"|"meetup", title, startsAt|null, endsAt|null, alwaysOpen, game: { name, yearPublished, imageUrl, slug }|null, imageUrl, place, participantCount, capacity, minParticipants, attendance: "rsvp"|"none"|"external"|"tickets", tournamentFormat|null, visibility, ludoyaUrl, children }`.
- `ProgramItem` is a discriminated union on `kind`. The fields every kind shares are `id, title, zone|null, coverUrl|null, startsAt|null, endsAt|null, ludoyaUrl`. Seat fields exist only on `play` and `tournament`, `format` and `tickets` only on `tournament`.
- `ProgramLayout` holds no strings. Texts come from `agenda-format.ts` (dates and times) and from `next-intl` in the components (labels).

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1, S2, S10 | inline. Adapter: `LudoyaSubEvent` in `types.ts`; `normalize.ts` builds the tree from `parentId` (any depth, roots = today's sessions), skips draft/canceled nodes and therefore their subtree, reads `alwaysOpen`, nullable dates (without the "no start date" skip for children), `attendanceMode`, `tournament.format`, `game`. `plannedPlays` stays exactly as today (direct `PLANNED_PLAY` children). A sanitized fixture of the Egara tree goes in `public/mock/ludoya/v1/events.json` (zone + plays, zone + tournaments, demo zones, always-open leaf, draft subtree, timed activity). Tests in `tests/lib/ludoya/normalize.test.ts`. | done | `94c4a2c` |
| T2 | S1, S2, S3, S6, S7, S8, S11 | inline. Program domain `src/lib/events/program/`: `types.ts`, `classify.ts` (tree → items: zone = nearest meetup ancestor, kind rules, always-open rule, recursive PUBLIC filter, zone-less always-open → group null), `layout.ts` (`PROGRAM_SLOT_THRESHOLD = 8`, Madrid day split, per-day grid or slots, always-open groups in source order with the zone-less group last, per-day counts). Pure, fed by a minimal input type. Unit tests for every rule with the Egara fixture and a 10-item session. Risk: item 2 (the visibility and draft filter decides what reaches the public page), so an independent verifier runs. | done | `759b17f` |
| T3 | S4 | inline. Covers over the tree: `collectCoverRequests` / `applyCovers` (pure) and `withCovers` walks `subEvents`. Order of S4: a node without game tries its image first, then a BGG lookup by title (year 0, accepted only on an exact normalised name match), then null. Budget unchanged. Tests in `tests/lib/member-sessions.test.ts` and `tests/lib/sub-event-covers.test.ts`. | done | `706aa62` |
| T4 | S6, S7, S8, S9, S10 | inline. View model: `AgendaEvent.items` and `layout` replace `plays` (all callers: `summarizeEvent`, `weekSummary`, `SessionSummary`, calendar and strip if they read plays); `selectAgendaSessions` filters recursively through T2; `agenda-format.ts` adds `ProgramView` (item time ranges "10:00 – 14:00", slot times, day titles, per-day and event counts). No organizer in the view model. Update `events-agenda-view` / `events-agenda-format` tests. | done | `64c963f` |
| T5 | S3, S4, S5, S6 | inline. UI blocks in `src/components/events/program/`: `CoverFrame` (cover / placeholder + top slot + bottom strip, extracted from `PlayCard`), `ItemBadge`, `ItemCard` (play / tournament / activity, reuses `SeatPill`), `AlwaysOpenTile`; `PlayCard` becomes a thin wrapper or is replaced (no duplicated markup). Messages ca/es/en for badges, formats, CTAs. Component tests per variant (aria, CTA text, tickets, placeholder). | done | `64c963f` |
| T6 | S3, S7, S8, S9, S10 | inline. Layout UI: `CollapsibleSection` (client, `aria-expanded` / `aria-controls`, default open), `ProgramGrid`, `ProgramSlots`, `DaySection`, `AlwaysOpenSection`, `EventProgram` (picks by layout). `SessionCard` and `SpecialCard` replace `PlaysGrid` with `EventProgram`; the special gets the count chips; propose tile per S10. Mobile: 2-column grid, 3-column tiles. Component tests (days open, toggle, slots above 8, grid at 8). | done | `64c963f` |
| T7 | all | inline. E2E `e2e/pages/events.spec.ts` on the new fixture (day sections, slots, tournament badge, always-open block collapse, draft absent, A Risk Cat under "Altres activitats"); `scripts/ludoya/check.mjs` checks the new fields (`alwaysOpen`, `tournament.format`, `attendanceMode`); docs: `docs/features/events/spec.md`, `docs/integrations/ludoya-api.md` (sub-event tree), CLAUDE.md (Events section, Component Structure); Lighthouse on `/events`. | done | `a175fdf` |

Forecast: about 1,800-2,200 authored lines. That is above 400, so `ask-on-risk` asks the chain question before the second commit.

## Log

- L1 (2026-11-11, user): "En la nueva vista events tenemos los eventos con sus partidas, pero en ludoya no todo son partidas directas dentro de un evento. Por ejemplo en el evento \"Egara Juga 2026\" hay subeventos dentro que no se muestran, actualmente solo se muestra el evento: [Arkham] Pero hay otros como: [Blood on the Clocktower, Demostracions de 2Tomatoes, Torneig Crokinole]. Analiza que datos podemos obtener con la api pública de ludoya para poder poner dentro de cada evento general todas las partidas directas y subeventos de este"
- L2 (2026-11-11, user): "Sí, arma la propuesta de diseño. A tener en cuenta: - Los borradores no hace falta mostrarlos. - las demos allways open se deben mostrar indicandolo - Intentar buscar portado y sino poner un placeholder o algo. - Estaria bien poder contar con las partidas de dentro de MEETUP - Los torneos deberian indicarse que son torneos y el tipo."
- L3 (2026-11-11, user choice): grouping "Por día" (over "Zonas de Ludoya + filtro" and "Solo por tipo").
- L4 (2026-11-11, user): "- Este sistema de marcas por horas y demás debe funcionar para toda clase de evento cuando se detecten mas de X partidas. - La forma de variantes tarjetas debe ser para todos, no solo para eventos especiales o que usen esta forma de eventos por tiempos. - Se deben mostrar todos los dias directamente, no con filtros, en todo caso, desplegables que se puedan colapsar o extender."
- L5 (2026-11-11, user): "- Me parece correcto el umbral. - SI, haz plegable la sección todos los dias." (X = 8; the always-open block is collapsible.)
- L6 (2026-11-11, user, on A Risk Cat): "Si, deberia ir con los de siempre abiertos, con ese grupo que propones". The invented "Estand" variant is dropped and the group "Altres activitats" added. Design approved.
- L7 (2026-11-11, user): "Si, haz la planificación. Ten en cuenta de hacer un diseño clean code, modular y reutilizable, con separación de dependencias."
- L8 (2026-11-11): plan written. Open assumptions: the always-open title "Tot l'esdeveniment" / "Tot el dia" instead of "Tot el cap de setmana"; the event images keep direct plays only; JSON-LD `subEvent` stays out of scope. Next step: T1.
- L9 (2026-11-11): T1 done (`94c4a2c`). The fixture's Egara end moved to the live value (29 Nov 14:00Z) so whole-event demos match. T2 decision: the "covers the whole event" rule applies to meetups only, because a play spanning a whole weekly session must stay in the grid. Undated plays go to the always-open block. `madridDay` moved to `src/lib/events/madrid-day.ts`. The independent verifier for item 2 runs after T4, when the filter reaches the browser.
- L10 (2026-11-11): T3. The pure `src/lib/sub-event-covers.ts` (`collectCoverRequests`, `applyCovers`) reuses `resolvePlayCovers` unchanged: a node without game is sent with its title and year 0, so only an exact name match is accepted, and only when it has no image of its own. Direct plays keep their own capped lookup and are not asked twice.
- L11 (2026-11-11): T4, T5 and T6 go in one commit: the view-model change (`AgendaEvent.program` replaces `plays`) breaks the UI contract, so no slice of it type-checks alone (about 1,000 lines). Decisions:
  - `PlayCard` is replaced by `program/ItemCard` on top of a shared `CoverFrame`. The game name still leads, and a play's own title and zone go below it.
  - Program items carry no place; no component showed a play's place.
  - The E2E card toggle now targets `button[aria-controls$="-panel"]`, because the program sections have toggles too.
  - Mobile: titles clamp to 2 lines and subtitles to 1; the collapsible insets are smaller.
  - Checked visually on the real Ludoya data through the developer's own server on port 3000 (Egara: days, slots, tournaments, always-open block) and on a weekly session.
  - Checks: unit 2084/2084, E2E `events.spec.ts` 15/15, tsc and eslint clean.
- L12 (2026-11-11): T7. E2E `events.spec.ts` covers the program: chips, day sections, slots, zone subtitle, tournament badge and tickets, the always-open block with "Altres activitats", drafts absent, folding. `ludoya:check` gains section 3b (sub-event types, depth, `alwaysOpen` / `attendanceMode` / nullable dates, tournament formats); the live run passed (58 sub-events, depth 2, 8 tournaments). Docs updated: events spec, Ludoya API reference, CLAUDE.md. Pending: Lighthouse and `next build`, not run because the developer's own dev server holds `.next` and port 3000.
- L13 (2026-11-11): closing checks.
  - Independent verifier for risk item 2: no blockers. Probes ran the whole chain from the raw feed to the serialized view model and calendar. Hidden nodes (draft, canceled, `ONLY_GROUP`, `ONLY_FRIENDS`, `PRIVATE`, unknown or missing visibility) at depth 1 and 2 never reach it, and no organizer data does. The admin `plannedPlays` output is identical to `c2d4eae`.
  - Advisory 1 fixed in `98e057e`: `collectCoverRequests` no longer sends non-public nodes or their subtree to BGG.
  - Advisory 2 not changed, by user decision: a sub-event with a malformed shape (missing `title`, wrongly typed date) keeps throwing `LudoyaShapeError`, the adapter convention pinned by `normalize.test.ts`.
  - `next build` passed. Lighthouse (`audits/lighthouse/2026-11-11_205334`) on `/events`: desktop 99 / 100 / 96 / 92, mobile 91 / 96 / 96 / 92, CLS 0.
  - The mobile accessibility 96 comes from `label-content-name-mismatch` on the `EventsDayStrip` links (their `aria-label` does not contain the visible text). That file is not touched by this feature; it is a follow-up.
  - Unit tests 2085/2085.
  - Next step: the user decides the merge into `develop`.
