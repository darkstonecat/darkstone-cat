# develop-users dependency update

## Objective

Bring the dependencies and tooling that only exist on `develop-users` (Supabase, testing stack, CI) up to the same standard `main` reached in its update pass.

## Why

`main` already upgraded the shared stack (Next, React, ESLint, TypeScript, Motion, Vercel) and that arrived with merge `9649a7a`. The branch-specific packages were still on older majors, `csv-parse` carries a moderate advisory, and server tests silently run under jsdom because Vitest 4 dropped `environmentMatchGlobs`.

## Scope

- In: `@supabase/ssr`, `csv-parse`, `dotenv`, `@testing-library/jest-dom` (+ `@testing-library/dom` peer), in-range patches, `vitest` 5, `jsdom` 30, Vitest config, `.github/workflows/ci.yml`, `supabase/config.toml`.
- Out: TypeScript 7 and `@types/node` 26. `main` pins `typescript ~6.0.3` because `typescript-eslint` declares `<6.1.0`, and keeps `@types/node` on 22 to match the `engines` floor.

## Constraints

- Keep versions shared with `main` identical.
- One work-unit commit per task, conventional commit messages, no push.
- TDD: off (no project/session configuration enables it). Ordinary functional checks apply.

## Tasks

- [x] T1 (ea295ce) — Trivial bumps: `@supabase/ssr` 0.12, `csv-parse` 7, `dotenv` 18, `@testing-library/jest-dom` 7 + `@testing-library/dom` 10, in-range patches. Route: inline (mechanical, package files only).
- [x] T2 (13b96cd) — `vitest` 5 + `jsdom` 30; replace dead `environmentMatchGlobs` with `test.projects` so server tests run under Node; rename config to `vitest.config.mts`. Route: inline unless test fixes spread over 2+ non-trivial files (then delegate one writer).
- [x] T3 (59d630e) — CI: actions to latest majors, `node-version-file: .nvmrc`. Route: inline (one file).
- [x] T4 (4f4ed83) — `supabase/config.toml`: `[inbucket]` → `[local_smtp]`. Route: inline (one file).

## Acceptance criteria

- `npm audit` 0 vulnerabilities.
- `npx tsc --noEmit` 0 errors, `npm run lint` 0/0, `npm run build` passes.
- `npm test` all green, with server/lib/integration tests running under the Node environment.
- `npx playwright test` all green.

## Progress / evidence

- Extra fix found during T1: ESLint linted `.next-e2e/` after E2E runs (~11k problems). Ignored in `9ef37a5`.
- T1: route inline. `npm audit` 0 (csv-parse advisory fixed).
- T2: route inline (only config + references changed, no test fixes needed). Server/lib/integration tests verified under Node (`typeof window` is undefined).
- T3: route inline. Also found `-x storage` was not a valid container name (the CLI calls it `storage-api`), so storage was started anyway; fixed and verified locally.
- T4: route inline. No deprecation warning; Mailpit answers on 54324.
- Final checks after T4: tsc 0, lint 0/0, build ok, vitest 161/161, playwright 164 passed + 1 flaky (`profile › displays member name`, first test on /profile; passes on retry, flaky before this work too), npm audit 0.
- Remaining outdated, on purpose: `typescript` 7 and `@types/node` 26 (aligned with main).
- RDD: off (global), no review ran.

## Next step

Done. Optional follow-up: investigate the flaky profile E2E test. Push is the user's decision.
