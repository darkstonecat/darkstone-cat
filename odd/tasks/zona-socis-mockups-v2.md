# Zona de socis mockups v2 — save the final design in the repo

## Objective

Replace the phase-1 mockups in `docs/mockups/zona-socis/` with the final v2 design
(canvas https://claude.ai/artifact/9SFGi2m6K7ZR9Vz3FrwTHH, version 27), so implementation
sessions work from the repo and not from a private external canvas.

## Scope

- Delete the phase-1 files (specs 01–05, `.dc.html`, screenshots).
- Add the v2 source (`.dc.html` + `canvas.json`), local image assets, screenshots of every
  screen and state, one layout spec per screen, and a README with rules, tokens and the
  data/backend gaps found in the review.
- Docs only: no application code changes.

## Constraints

- Screenshots are the source of truth; specs and `.dc.html` follow them.
- Sample data (Laia Serra, 000-203, games, organisers, [BOTIGA AMIGA]) must never reach code.
- Technical artifacts in English; UI copy stays Catalan as designed.

## Tasks

- [x] T1 — Render screenshots of every artboard (desktop 1280 @1x, mobile 390 @2x, key interactive states) — route: delegated (writer trigger: 20+ files, preparation read of 10 artboards)
  - Evidence: 12 PNGs in docs/mockups/zona-socis/screenshots/ rendered with Chromium via a static renderer and visually inspected (images load, no raw holes).
- [x] T2 — Replace folder contents: source, assets, per-screen specs, README — route: delegated (same worker)
  - Evidence: phase-1 files removed; 10 sources + canvas.json (no /_blob/ left), 12 assets, 7 specs, README; link/path check: 65 links, 0 broken.
- [x] T3 — Verify links, image paths and screenshot coverage — route: inline
  - Verified: 12 screenshots cover all 10 artboards (01-login.png and 04-perfil.png inspected), 65 links resolve, no /_blob/ left.
  - Not committed by user decision: `/docs/` is gitignored on purpose ("Docs not included by default", 8f0b931); the folder stays local-only.
- [x] T4 — Copy fixes requested after review (canvas v27 + local source + specs; 02-alta, 02-alta-mobil, 04-perfil screenshots re-rendered) — route: inline
  - Sign-up "On jugues" intro no longer implies a member directory; profile BGG helper no longer promises a collection match; required consent checkboxes start unchecked; profile hero reads "Membre des del"; board renamed "4 · Perfil i compte".

## Acceptance criteria

- No phase-1 file remains.
- Every artboard has at least one screenshot and one spec.
- `.dc.html` image references resolve to files inside the folder.
- README lists screens, rules, tokens, responsive patterns, open decisions and data gaps.

## Checks

- Structural readback of the folder and README links.
- `npm run lint` is unaffected (docs only).

## Progress

- Created 2026-09-30. All tasks done 2026-09-30. Next: open decisions in README section 8, then the implementation feature document.
