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

## Phase 1 — Clear the 11 warnings ✅ COMPLETED

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

### Result (measured)

| Check | Before | After |
|---|---|---|
| `npm run lint` | 0 errors, 11 warnings | **0 errors, 0 warnings** |
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 |
| `npm run ludoya:check` | pass | pass |
| `npm audit` / `--omit=dev` | 0 / 0 | 0 / 0 |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphans |
| Packages | 522 | 522 |

Notes:

- **1.2 `linkExpansionsByName` was genuinely dead, and `CLAUDE.md` was wrong
  about it.** It was never a fallback chained after the thing-based linker. In
  `e9a5a50` it was the *mock-branch* linker while the live branch already used
  `linkExpansionsByThing`; `7394c8f` migrated the mock branch to the thing-based
  linker too (mock `things.xml` was added in that commit) and left the function
  orphaned. Removed together with its only helper, `normalizeForMatch`.
  `CLAUDE.md:142` updated to stop describing a fallback that never existed.
- **1.5 floor chosen: `node >=22.13.0`.** It clears every current dependency
  floor (`next` needs `>=20.9.0`) *and* the one Phase 4 introduces: ESLint 10
  declares `^20.19.0 || ^22.13.0 || >=24`. Covers Node 22 LTS and local Node 24.
  `package-lock.json` was resynced with `npm install --package-lock-only`: it
  added the `engines` field plus the bundled wasi deps of
  `@tailwindcss/oxide-wasm32-wasi`, with **zero version changes or removals**.
  **Superseded (2026-09-18) by `^22.19.0 || ^24.0.0`.** The floor was too low:
  it was checked against only four packages, but `lighthouse` requires
  `>=22.19`, and 22.19.0 is the lowest 22.x that satisfies every non-optional
  dependency in the lockfile. The range is also capped at 24. Vercel ignores
  `.nvmrc` and deploys the highest available major that satisfies
  `engines.node`, overriding the dashboard, so an open `>=` range would move
  production to Node 26 silently as soon as Vercel offered it. Moving to 26
  is now a deliberate one-line change here and in `.nvmrc`.

---

## Phase 2 — Low-risk majors ✅ COMPLETED

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

### Result (measured)

Bumped to `@vercel/analytics@2.0.1`, `@vercel/speed-insights@2.0.0`,
`@types/node@22.20.3`. Ranges in `package.json` moved to `^2.0.1`, `^2.0.0`,
`^22.20.3`.

| Check | Before | After |
|---|---|---|
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| `npm run ludoya:check` | pass | pass |
| `npm audit` / `--omit=dev` | 0 / 0 | 0 / 0 |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphans |
| Packages | 522 | 522 |

API surface verified rather than assumed:

- The `./next` subpath is still exported by both v2 packages, and both still
  export the named `Analytics` / `SpeedInsights` components. Every prop on both
  is optional, and `layout.tsx` passes none — so there is no surface to break.
- **CSP checked explicitly.** v2 loads `/_vercel/insights/script.js` and
  `/_vercel/speed-insights/script.js` (covered by `'self'`) and falls back to
  `https://va.vercel-scripts.com`, which `next.config.ts:42` already allows in
  `script-src`. No CSP change needed. Had v2 moved hosts, the scripts would have
  been blocked silently with a green build.

**Not verified:** that telemetry still arrives in the Vercel dashboard. That
needs a deploy, and nothing was pushed. Confirm both integrations report after
the next deploy.

---

## Phase 3 — React 19.2.1 → 19.3.0 ✅ COMPLETED

`react` and `react-dom` are pinned to exact versions in `package.json`, which
is why `npm update` left them alone. That pin is a deliberate choice, so
changing it is a decision, not maintenance.

`next@16.3.5` accepts `^19.0.0`, so 19.3.0 is allowed. Decide whether to keep
pinning exactly (bump both to `19.3.0`) or relax to a caret range.

### Result (measured)

**Decision: bump both, keep the exact pin.** `react` and `react-dom` are now
exactly `19.3.0` in `package.json` — the deliberate-pin policy is preserved, so
future patches stay a conscious choice rather than an `npm update` side effect.
Installed with `--save-exact`. `next@16.3.5` accepts `^19.0.0`, so 19.3.0 is
inside the peer range.

| Check | Before | After |
|---|---|---|
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| `npm run ludoya:check` | pass | pass |
| `npm audit` / `--omit=dev` | 0 / 0 | 0 / 0 |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphans |
| Packages | 522 | 522 |

---

## Phase 4 — ESLint 9.39.5 → 10.10.0 ✅ COMPLETED (with a caveat)

`eslint-config-next@16.3.5` declares `eslint >= 9.0.0`, so ESLint 10 is
permitted by the peer range. The config is already flat
(`eslint.config.mjs` with `defineConfig` + `globalIgnores`), which removes the
usual migration pain.

Risk is moderate and concentrated in plugin compatibility rather than in the
config format. Expect new rules to surface findings, as happened this session
when `eslint-plugin-react-hooks` 7.0.1 → 7.1.1 turned up two real errors in
`NavBar.tsx` that had been hidden behind an `exhaustive-deps` suppression.

Budget time for fixing what it finds, not just for the bump.

### Result (measured)

**The premise in this phase was incomplete, and a first attempt failed.**
`eslint-config-next@16.3.5` does declare `eslint >=9.0.0`, but three transitive
plugins cap at ESLint 9, and **no published version of any of them supports 10**
— all three are already at their latest release:

| Plugin | Version | Declared `eslint` peer |
|---|---|---|
| `eslint-plugin-import` | 2.32.0 | `^2 \|\| … \|\| ^9` |
| `eslint-plugin-jsx-a11y` | 6.10.2 | `^3 \|\| … \|\| ^9` |
| `eslint-plugin-react` | 7.37.5 | `^3 \|\| … \|\| ^9.7` |

Only `eslint-plugin-react-hooks@7.1.1` allows `^10.0.0`.

npm 11 installs ESLint 10 **without an ERESOLVE error**, which is the trap: the
incompatibility only surfaces when lint actually runs, with exit 2:

```
TypeError: Error while loading rule 'react/display-name':
contextOrFilename.getFilename is not a function
  at resolveBasedir (eslint-plugin-react/lib/util/version.js:31:100)
  at detectReactVersion (.../version.js:85)
```

ESLint 10 removed `context.getFilename()`; the plugin still calls it.

**Fix applied (user decision):** declare the React version explicitly in
`eslint.config.mjs` — `settings: { react: { version: "19.3.0" } }` — which skips
`detectReactVersion` entirely. **This must be kept in sync with the `react` pin
in `package.json`.**

| Check | Before | After |
|---|---|---|
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings (113 files) |
| `npm run ludoya:check` | pass | pass |
| `npm audit` / `--omit=dev` | 0 / 0 | 0 / 0 |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphans |
| Packages | 522 | **516** |

A clean lint run proves nothing on its own, so rule coverage was verified
against a deliberately broken probe file rather than assumed. All five plugin
families still fire under ESLint 10, and 86 rules are enabled:

- `react/display-name`, `react/jsx-key`, `react/no-unescaped-entities`
- `import/no-anonymous-default-export`
- `@typescript-eslint/no-unused-vars`
- `@next/next/no-img-element`
- `jsx-a11y/alt-text`

**Standing risk:** three plugins now run outside their declared peer range. A
future ESLint 10 minor could break them again, and the `settings.react.version`
pin only covers the one code path that broke here. Revisit when
`eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y`
publish ESLint 10 support.

---

## Phase 5 — Motion 12.43.0 → 13.4.0 ✅ COMPLETED

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

### Result (measured)

| Check | Before | After |
|---|---|---|
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| `npm run ludoya:check` | pass | pass |
| `npm audit` / `--omit=dev` | 0 / 0 | 0 / 0 |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphans |
| Packages | 516 | 516 |

**The only breaking change in 13.0.0 does not apply here.** It drops the
optional `@emotion/is-prop-valid` dependency. That package was never installed,
so motion 12 was already running on its built-in prop filter. A DOM scan on `/`,
`/about` and `/ludoteca` found zero Motion props leaked as HTML attributes, on
both versions. 13.1–13.4 only add features (Reorder, effects, `AnimateView`) and
make performance changes.

**The visual checklist above was partly stale**, so the real Motion surfaces
were verified instead:

- The hero entrance spring is a **CSS** animation (`animate-hero-logo-spring`),
  not Motion. Motion only drives the hero's scroll-linked scale and opacity.
- The cookie banner uses **no Motion at all**.
- Mobile Activities uses `whileInView`, not `AnimatePresence`. `AnimatePresence`
  actually lives in the FAQ accordion, the collaborator modal, the ludoteca game
  modal and mobile filter drawer, and the contact form.

**Method: an A/B numeric probe in headless Chrome, not eyeballing.** The same
script ran against a motion 12 build and a motion 13 build. It scrolls each
section to fixed fractions, samples every inline `transform`/`opacity` Motion
writes, and records the `AnimatePresence` curves frame by frame. It checks
`requestAnimationFrame` first: a background browser tab ran at **0 fps**, which
would have made every reading meaningless. Headless ran at 62 fps.

| Surface | Result |
|---|---|
| Hero scroll scale/opacity/translate | identical at every sample |
| About sticky cards (scroll-pinned scale) | identical |
| Activities desktop horizontal track + meeple | identical (track to −2835px, meeple 0→360°) |
| Activities mobile `whileInView` cards | identical (`translateY(30px)`/0 → none/1) |
| FAQ accordion open/close (`height: auto`) | same frame count and end state |
| Collaborator modal, game modal (open/Escape) | same curve length, same end state |
| Mobile filter drawer (−100% → 0 → −100%) | same curve, same end state |
| Spring solver, `stiffness 300, damping 20` | **bit-identical**: max per-frame diff 0, same 10.8% overshoot, 656 ms settle |
| Activities desktop card spring, live on 13 | runs: peak 1.1077, matching the solver |
| Social icon hover (`useAnimate`), live on 13 | runs: scale 1.3 + shake; unhover springs 1.3 → 0.968 → 1 |
| Contact form `mode="wait"`, live on 13 | never both on screen; success enters 0→1, 10px→0 |

The contact form was checked with `POST /api/contact` intercepted and answered
locally, so no email was sent. The form itself has no `exit` prop, so its
instant removal is intentional.

**Only checked on 13, not A/B:** social hover and the contact form. They behave
as the code specifies, and the spring they share is proven identical.

Pre-existing findings, identical on both versions and **not caused by this
bump**:

- **Reduced motion does not stop scroll-linked transforms.** With
  `prefers-reduced-motion: reduce` emulated, the About cards' scroll scale is
  identical to the normal run. `MotionConfig reducedMotion="user"` only
  suppresses *animations*, not motion values driven by `useScroll`. That
  contradicts the `CLAUDE.md` claim that "all animations disable". What reduced
  motion does do: the FAQ height jumps straight to its final value instead of
  animating.
- **React error #418** (hydration text mismatch) on `/` in the production build.

---

## Phase 6 — TypeScript 5.9.3 → 7.0.2 ✅ COMPLETED as 6.0.3 (7 blocked upstream)

TypeScript 7 is the Go-based compiler rewrite. The codebase runs `strict: true`
with `moduleResolution: "bundler"` and `target: "ES2017"`, so the whole surface
is exposed to any checker behaviour change.

`eslint-config-next` only requires `typescript >= 3.3.1`, so nothing blocks it,
but "nothing blocks it" is not "nothing breaks". Treat this as its own project:
read the migration notes, run the build, and expect type errors that the old
checker let through.

Lowest urgency in this roadmap. TypeScript 5.9 is stable and supported.

### Result (measured)

**TypeScript 7 is blocked upstream, not just risky.** Its main entry point
exports only `./lib/version.cjs` plus `unstable/*`; the classic compiler API that
tools load with `require("typescript")` is gone. `typescript-eslint@8.70.0`, the
latest release, declares `typescript >=4.8.4 <6.1.0` and parses through that
API, so TS 7 would break linting.

**Decision (user): bump to TypeScript 6.0.3**, the newest stable release inside
the `typescript-eslint` range. It is declared as `~6.0.3`, not `^6.0.3`, so
`npm update` cannot drift into 6.1, which that range excludes.

| Check | Before | After |
|---|---|---|
| `npx tsc --noEmit` | — | exit 0, no errors |
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 (Next's own type-check ran on 6.0.3) |
| `npm run lint` | 0 errors, 0 warnings | 0 errors, 0 warnings, 113 files, no unsupported-TS warning |
| `npm run ludoya:check` | pass | pass |
| `npm audit` / `--omit=dev` | 0 / 0 | 0 / 0 |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphans |
| Packages | 516 | 516 |

No type errors surfaced, and Next did not rewrite `tsconfig.json`. **Revisit TS 7
when `typescript-eslint` publishes a range that includes it.**

---

## Separate track — Mobile menu focus restoration ✅ NOT A BUG (measurement artifact)

The original report: after closing the mobile menu, focus was lost to `body`
instead of returning to the hamburger.

**Re-measured on 2026-09-18 and not reproducible.** The setup was a production
build in headless Chrome at 390×844, with the cookie banner suppressed
correctly (see below). Every `focusin`/`focusout` event and every programmatic
`.focus()`/`.blur()` call was logged with timestamps:

| Close path | Final focus |
|---|---|
| Escape on `/` | hamburger (~510 ms, after the 500 ms close animation) |
| Escape on `/faq` | hamburger |
| Close button (Enter) | hamburger |
| Hamburger toggle (Enter) | hamburger |
| Nav link (Enter, navigates) | `body` of the new page, which is correct |

On the nav-link path, `NavBar` is rendered per page, so the old instance
unmounts on navigation (at about 67 ms) and its pending refocus has no target.
Focus starts from the new page, which is how a normal page load behaves.

**Most likely cause of the original report:** it was measured in a Claude in
Chrome extension tab. Those tabs can sit in the background with
`document.visibilityState === "hidden"`, which throttles
`requestAnimationFrame` to 0 fps. That was observed directly during Phase 5.
`closeMobileMenu` restores focus inside `requestAnimationFrame`, so in such a
tab the refocus never runs. This is an inference: the original measurement
could not be re-run.

**Cookie banner in tests:** `useCookieConsent` does `JSON.parse` on the stored
value and reads `.status`, so a bare `"accepted"` string throws, is swallowed,
and the banner still shows. Store
`JSON.stringify({ status: "rejected", date: new Date().toISOString() })`
instead. `rejected` also keeps Google Analytics from loading during tests.

**Rule for future browser checks:** measure `requestAnimationFrame` frames per
second first. If it is 0, every animation and focus measurement is invalid.

---

## Optional — Squash the dependency churn

`ab009e1` (bump puppeteer) and `e571f2d` (bump @unlighthouse/cli) are undone by
`1e752e4`, which removes both packages. The history is accurate — the bumps were
needed to measure the tools before deciding to drop them — but the three
commits can be squashed into one removal if a cleaner log is preferred.

This is cosmetic. Nothing depends on it.

---

## Final sweep (2026-09-18, from scratch)

The sweep ran on the final tree (`5bb83b4`), starting with `npm ci` from the
lockfile, then `rm -rf .next` and every check.

| Check | Baseline (2026-09-17) | Final | |
|---|---|---|---|
| `npm ci` from lockfile | — | exit 0, reproduces 516 packages | ✅ |
| `npm audit` | 0 | 0 | ✅ |
| `npm audit --omit=dev` | 0 | 0 | ✅ |
| Isolated prod tree (`npm ci --omit=dev --ignore-scripts` in a copy) | — | 76 packages, 0 vulnerabilities | ✅ |
| `npm run build` (clean) | exit 0, 38/38 | exit 0, 38/38 | ✅ |
| `npm run lint` | 0 errors, **11 warnings** | **0 errors, 0 warnings** (113 files) | ✅ |
| `npm run ludoya:check` | pass (failed 2 of 7 runs, upstream) | pass | ✅ |
| `npm run lighthouse` | exit 0, 22/22 | exit 0, 22/22, no orphaned `next-server` | ✅ |
| Packages | 522 | **516** | — |
| `npm outdated` | 8 entries | 2 entries, both with a recorded reason | ✅ |

Lighthouse, baseline run `2026-09-17_172723` against final run `2026-09-18_072209`:
Accessibility, Best Practices and SEO are **identical on all 22 audits**.
Performance moved between −1 and +2 everywhere except `events` mobile, 94 → 89.
That drop is a step change starting at the first post-Phase-1 run, not noise.
The cause is data, not code: the page's LCP element changed from a text
paragraph to a live Ludoya event photo ("Divendres de jocs!") that appeared in
the feed, adding about 600 ms to LCP. None of Phase 1's runtime changes are
imported by the events page.

### Remaining `npm outdated` entries

| Package | Pinned at | Latest | Reason |
|---|---|---|---|
| `typescript` | `~6.0.3` | 7.0.2 | Blocked upstream: TS 7 drops the classic compiler API, and `typescript-eslint@8.70.0` supports `<6.1.0` only. The tilde prevents drift into 6.1. |
| `@types/node` | `^22.20.3` | 26.x | Deliberate: the types track the lowest supported runtime (`engines.node ^22.19.0 || ^24.0.0`). Newer types would type-check APIs that don't exist on Node 22. |

### Open items found along the way (not fixed, out of scope)

- ✅ **Fixed (2026-09-18).** `scripts/ludoya/check.mjs` `head()` had no
  `try/catch`, so a transient network error aborted the whole run with
  `Unexpected error: fetch failed`. It now never throws: a failed `HEAD` is
  retried once as a 1-byte ranged `GET`, because the OVH image host hangs
  intermittently on `HEAD` (about 1 in 8) while `GET` succeeds. Anything still
  failing is recorded as a failed check. Verified by injecting faults into
  `fetch`: HEAD hangs → pass via the GET fallback; host down → every section
  runs, 5 failures listed, exit 1; 404 → reported as failures.
- `prefers-reduced-motion` does not stop scroll-linked `useScroll`/`useTransform`
  transforms (see Phase 5). `CLAUDE.md` claims all animations are disabled.
- React error #418 (hydration text mismatch) on `/` in the production build.
- ✅ **Fixed (2026-09-18).** In `CLAUDE.md`, "Animation Patterns" now says the
  hero spring is CSS `@keyframes`, lists the real Motion springs and the real
  `AnimatePresence` users, and gives the correct container heights. The
  reduced-motion line now names what is and isn't disabled, the Lenis duration
  is 1.0 s (not 1.2 s), and mobile Activities is described as `whileInView`
  fade/slide.
- ESLint 10 runs `eslint-plugin-import`, `-jsx-a11y` and `-react` outside their
  declared peer ranges. Their latest releases (2.32.0, 2025-06-20; 6.10.2,
  2024-10-26; 7.37.5, 2025-04-03) predate ESLint 10.0.0 (2026-02-06), so their
  `peerDependencies` stop at `^9`. `package.json` `overrides` pins their
  `eslint` peer to `$eslint`, which silences the `ERESOLVE overriding peer
  dependency` warnings `npm install` printed. The resolved tree is unchanged.
  **Remove those overrides once the plugins declare ESLint 10 support**, or a
  real future conflict will be silenced too. At the same time, drop the
  `settings.react` block in `eslint.config.mjs`. It now reads the installed
  React version, so it no longer needs manual syncing with the pin.
- `allowScripts` in `package.json` explicitly denies the install scripts of
  `@parcel/watcher`, `@swc/core` (both via `next-intl`) and `unrs-resolver`
  (via the ESLint import resolver). npm 11 already skipped them by default;
  each ships a prebuilt binary for the platform, and the scripts are only
  source-build or binding-check fallbacks. Verified with the scripts skipped:
  all three native bindings load, and build, lint, `next dev` and lighthouse
  pass. If a platform without a prebuilt binary ever fails, review and
  approve that package with `npm install-scripts approve <pkg>`.
- ESLint 9 is not a fallback: it reached end of life on 2026-08-06.
- Package count went from 516 to 522 after `npm update` (2026-09-18), with no
  version changes in the plugins. Once the overrides resolved the peer
  conflict, npm hoisted `eslint-plugin-import`, `-jsx-a11y` and `-react` out of
  `eslint-config-next/node_modules/`. Each now carries its own copy of
  `minimatch@3` / `brace-expansion@1` / `balanced-match@1`, because the top
  level holds the v10/v5/v4 versions that ESLint 10 uses. `npm dedupe` would
  only save 4 packages by downgrading top-level `zod`, `postcss` and
  `@eslint-community/eslint-utils`, so it was not applied.
- Vercel Analytics / Speed Insights v2 telemetry is not verified until the next
  deploy.

---

## Definition of done

- `npm audit` and `npm audit --omit=dev` both report 0
- `npm run lint` reports 0 errors and 0 warnings
- `npm run build` green, 38/38 pages
- `npm run lighthouse` exit 0, 22/22 audits, no orphaned processes
- `npm run ludoya:check` passes
- `npm outdated` empty, or every remaining entry deliberately pinned with a
  recorded reason
