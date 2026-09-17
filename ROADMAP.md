# Maintenance Roadmap

Plan to reach stable versions across the board with 0 lint errors and the
smallest honest number of warnings.

**Baseline at the time of writing** (develop, 8 commits ahead of origin):

| Check | State |
|---|---|
| `npm audit` | 0 vulnerabilities |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run build` | green, 38/38 pages |
| `npm run lint` | 0 errors, 11 warnings |
| `npm run lighthouse` | exit 0, 22/22 audits |
| `npm run ludoya:check` | all checks pass |
| Packages | 522 |

---

## Working protocol

Every phase follows the same loop. It is not ceremony: this session found two
long-standing bugs precisely because the baseline was measured first.

1. **Measure before touching anything.** Without a baseline, a failure after an
   upgrade is indistinguishable from a failure that was already there.
2. Apply **one** phase.
3. Run the full sweep: `npm run build` (after `rm -rf .next`), `npm run lint`,
   `npm run ludoya:check`, `npm run lighthouse`, `npm audit`.
4. Commit that phase alone, conventional commits.
5. If a phase goes wrong, it reverts on its own without dragging the others.

Phases are ordered by risk, lowest first. Each one is independent: stopping
after any phase leaves the repository in a consistent state.

---

## Phase 1 — Clear the 11 warnings

Zero dependency risk. Nothing here requires an upgrade, so it can land today
and it makes every later phase easier to read: after this, any new warning is
genuinely new.

The 11 warnings come from **4 root causes**, not 11 separate problems.

### 1.1 — `src/lib/event-image/composer.tsx` (8 of the 11)

Four `<img>` tags at lines 135, 195, 215 and 247, each raising two rules:
`@next/next/no-img-element` and `jsx-a11y/alt-text`.

This file feeds **Satori** through `next/og`. Satori renders JSX to a PNG and
does not run the browser DOM, so `next/image` cannot be used here. The
`no-img-element` rule is a false positive in this context.

- Add a scoped ESLint override for `src/lib/event-image/**` turning
  `@next/next/no-img-element` off, with a comment explaining the Satori
  constraint. Scope it to the directory, never globally.
- Add `alt=""` to the four tags to satisfy `jsx-a11y/alt-text`. The images are
  decorative inside a generated picture, so the empty string is correct.

Expected: 11 → 3 warnings.

### 1.2 — Unused bindings (2)

- `scripts/lighthouse/server.mjs:6` — `logError` imported and never used.
- `src/lib/bgg.ts:184` — `linkExpansionsByName` declared and never used.

Check `bgg.ts` before deleting: the name-based expansion heuristic is described
in `CLAUDE.md` as a fallback. If it is genuinely dead, remove it; if it was
meant to be wired up, that is a separate bug, not a lint cleanup.

Expected: 3 → 1 warning.

### 1.3 — Stale suppression (1)

`src/app/[locale]/opengraph-image.tsx:64` has an `eslint-disable` for
`@next/next/no-img-element` that no longer suppresses anything. Auto-fixable
with `npm run lint -- --fix`.

Expected: **1 → 0 warnings.**

### 1.4 — Documentation drift

- `CLAUDE.md:29` claims "all 8 pages (16 audits total)".
- `README.md:146` claims "across all 8 pages".

Verified against `scripts/lighthouse/config.mjs`: `PAGES` has **11** entries and
`DEVICES` has 2, so the real figure is **22 audits**. Update both.

### 1.5 — Declare `engines`

`package.json` has no `engines` field. Nothing currently constrains the Node
version used to build. Local development runs Node 24. Declare a floor so a
mismatched CI or deploy fails loudly instead of silently.

---

## Phase 2 — Low-risk majors

Peer ranges verified as compatible, and the API surface the project actually
touches is tiny.

| Package | From | To | Surface in this repo |
|---|---|---|---|
| `@vercel/speed-insights` | 1.3.1 | 2.0.0 | one import, `<SpeedInsights />` in `layout.tsx` |
| `@vercel/analytics` | 1.6.1 | 2.0.1 | one import, `<Analytics />` in `layout.tsx` |
| `@types/node` | 20.19.43 | 22.20.3 | types only |

Both Vercel packages declare `next >= 13` and `react ^18 || ^19`, which this
project satisfies. They are used as bare components with no props, so a major
bump has almost nothing to break against.

`@types/node` 22 is arguably more correct than 20 already, since the runtime is
Node 24.

Read each package's release notes before bumping, and verify the two Vercel
integrations still report in the dashboard after deploy — a build passing does
not prove telemetry still arrives.

---

## Phase 3 — React 19.2.1 → 19.3.0

`react` and `react-dom` are pinned to exact versions in `package.json`, which
is why `npm update` left them alone. That pin is a deliberate choice, so
changing it is a decision, not maintenance.

`next@16.3.5` accepts `^19.0.0`, so 19.3.0 is allowed. Decide whether to keep
pinning exactly (bump both to `19.3.0`) or relax to a caret range.

---

## Phase 4 — ESLint 9.39.5 → 10.10.0

`eslint-config-next@16.3.5` declares `eslint >= 9.0.0`, so ESLint 10 is
permitted by the peer range. The config is already flat
(`eslint.config.mjs` with `defineConfig` + `globalIgnores`), which removes the
usual migration pain.

Risk is moderate and concentrated in plugin compatibility rather than in the
config format. Expect new rules to surface findings, as happened this session
when `eslint-plugin-react-hooks` 7.0.1 → 7.1.1 turned up two real errors in
`NavBar.tsx` that had been hidden behind an `exhaustive-deps` suppression.

Budget time for fixing what it finds, not just for the bump.

---

## Phase 5 — Motion 12.43.0 → 13.4.0

**The widest change in this roadmap.** Measured surface:

- **39 files** import from `motion`
- `motion/react` in 38 of them, `motion/react-client` in 2
- APIs in use: `motion` (36), `useScroll` (5), `useTransform` (4),
  `AnimatePresence` (4), `useInView` (2), `useAnimate`, `MotionConfig`,
  `useReducedMotion`, `type MotionValue`

Peer requirements are satisfied (`react ^18 || ^19`), so this will install
cleanly — which is exactly the trap. Animation regressions do not fail a build
and do not fail a lint. They only show up on screen.

This phase needs visual verification, not just a green sweep:

- Hero entrance spring on `/`
- Scroll-pinned sections: About cards, Activities desktop parallax
- Activities on mobile, which is a completely separate implementation from
  desktop (see `CLAUDE.md`)
- `AnimatePresence` transitions: cookie banner, direction-aware slides
- `prefers-reduced-motion: reduce` still disables everything

Do this phase alone, never bundled with another.

---

## Phase 6 — TypeScript 5.9.3 → 7.0.2

TypeScript 7 is the Go-based compiler rewrite. The codebase runs `strict: true`
with `moduleResolution: "bundler"` and `target: "ES2017"`, so the whole surface
is exposed to any checker behaviour change.

`eslint-config-next` only requires `typescript >= 3.3.1`, so nothing blocks it,
but "nothing blocks it" is not "nothing breaks". Treat this as its own project:
read the migration notes, run the build, and expect type errors that the old
checker let through.

Lowest urgency in this roadmap. TypeScript 5.9 is stable and supported.

---

## Separate track — Mobile menu focus restoration

Not a dependency issue, and not introduced by any upgrade in this roadmap.

`closeMobileMenu` in `src/components/NavBar.tsx` calls
`requestAnimationFrame(() => hamburgerRef.current?.focus())` after a 500 ms
timeout, but focus does not end up on the hamburger. Verified in a browser at
mobile width against both the current and the previous version of the file, so
it predates the React Compiler fix.

Escape does close the menu correctly. What fails is returning focus to the
trigger, which is a real accessibility defect for keyboard users: after closing
the menu, focus is lost to `body` and tab order restarts from the top.

Worth noting that the browser check for this was contaminated by the cookie
banner, and setting `darkstone_cookie_consent` in `localStorage` did not
suppress it. Whoever picks this up should first work out how to put the app in
a consented state for testing, or the measurement will be as noisy as it was
here.

---

## Optional — Squash the dependency churn

`ab009e1` (bump puppeteer) and `e571f2d` (bump @unlighthouse/cli) are undone by
`1e752e4`, which removes both packages. The history is accurate — the bumps were
needed to measure the tools before deciding to drop them — but the three
commits can be squashed into one removal if a cleaner log is preferred.

This is cosmetic. Nothing depends on it.

---

## Definition of done

- `npm audit` and `npm audit --omit=dev` both report 0
- `npm run lint` reports 0 errors and 0 warnings
- `npm run build` green, 38/38 pages
- `npm run lighthouse` exit 0, 22/22 audits, no orphaned processes
- `npm run ludoya:check` passes
- `npm outdated` empty, or every remaining entry deliberately pinned with a
  recorded reason
