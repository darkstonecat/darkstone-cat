# Admin panel mockups — design the views and dialogs of the spec

## Objective

Design the admin panel described in `docs/admin-panel/spec.md` (views V-1 to V-8 and the
action dialogs) in a design canvas, with the format and look of `docs/mockups/zona-socis/`,
and save it in `docs/mockups/admin-panel/` so implementation works from the repo.

Canvas (private, owner only): https://claude.ai/artifact/CoUMutSrKCAMnj3DXFCLhA

## Problem / why

The spec is functional only. Implementation needs a visual target per screen and per dialog
that reuses the member-area patterns already built (dark `MemberHeader`, tabs, white cards).

## Scope

- Desktop 1280 px boards for V-1 to V-8 and every action dialog.
- Mobile 390 px boards for V-2 (rows become cards) and V-3 (member file).
- V-3 in two states: active member and former member (blocked register).
- Drawn as a superadmin (every control visible); board-only differences noted in the specs.
- Export: `source/*.dc.html` + `canvas.json`, `assets/`, `screenshots/`, `screens/*.md`, README.
- Docs only: no application code. `/docs/` is gitignored, so the folder stays local.

## Constraints

- Catalan UI copy, taken from the spec where it gives it. Technical text in English.
- Tokens and building blocks of `docs/mockups/zona-socis/README.md` §4; header = current
  `MemberHeader` (eyebrow, h1, line, equal-width pill tabs).
- No invented stats beyond obvious sample data; sample data listed in the README as never-ship.
- Accessible as drawn: real buttons/inputs/labels, 44 px targets, contrast ≥ 4.5:1.

## Tasks

- [x] T1 — Canvas index + V-1 Resum (sets the shared look) — route: inline (one board, look decisions)
  - Evidence: canvas v2 published with canvas.json (27 boards planned) + Main.dc.html; logo uploaded as asset.
    Shared writer brief in the session scratchpad (`briefs/common.md`): tokens, chips, dialogs, sample data.
- [x] T2 — Views V-2 to V-8 (+ mobile V-2, V-3, former-member V-3) — route: delegated (writer trigger: 10+ files)
  - Evidence: 12 boards written by two writers (member views; admin views) and published in canvas v4.
- [x] T3 — Action dialogs (A-4..A-16, S-1..S-4, M-1) — route: delegated (writer trigger: 10+ files)
  - Evidence: 14 dialog boards published in canvas v4. Not rendered yet: pending the user's review on the canvas.
- [x] T3b — Review round on the canvas (user) and fixes
  - User approved the canvas as is (2026-10-05). After export: board heights fitted to content, sample member numbers unified; canvas v5.
- [x] T4 — Export to `docs/mockups/admin-panel/`: source, assets, screenshots, screens/*.md, README — route: delegated
  - Evidence: 27 sources + canvas.json (logo `../assets/`, no `/_blob/`), 32 PNGs rendered locally with the canvas runtime (Chromium, no board errors), 9 screen specs, README.
- [x] T5 — Structural check: every board has a screenshot and a spec, links resolve — route: inline
  - Verified: 142 relative links/images/anchors, 0 broken; every board has a PNG and a spec; spot-checked 02-socis.png and 03-fitxa-exsoci.png.
  - Not committed: `/docs/` is gitignored, the folder stays local-only (same as zona-socis).

## Acceptance criteria

- Every view V-1..V-8 and every dialog named in the spec has a board.
- Board-specific rules (BR-10/11/12, BR-21) are visible where the spec puts them inline.
- README lists boards, routes, building blocks added on top of zona-socis, and sample data.

## Checks

- Structural readback of the folder and README links. No app checks (docs only).

## Progress

- Created 2026-10-05. Decision: desktop + mobile for V-2 and V-3 only (user, 2026-10-05).
- All tasks done 2026-10-05. Next: implementation feature document for the admin panel (spec still needs the data model plan).
