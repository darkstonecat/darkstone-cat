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

- [ ] T1 — Trivial bumps: `@supabase/ssr` 0.12, `csv-parse` 7, `dotenv` 18, `@testing-library/jest-dom` 7 + `@testing-library/dom` 10, in-range patches. Route: inline (mechanical, package files only).
- [ ] T2 — `vitest` 5 + `jsdom` 30; replace dead `environmentMatchGlobs` with `test.projects` so server tests run under Node; rename config to `vitest.config.mts`. Route: inline unless test fixes spread over 2+ non-trivial files (then delegate one writer).
- [ ] T3 — CI: actions to latest majors, `node-version-file: .nvmrc`. Route: inline (one file).
- [ ] T4 — `supabase/config.toml`: `[inbucket]` → `[local_smtp]`. Route: inline (one file).

## Acceptance criteria

- `npm audit` 0 vulnerabilities.
- `npx tsc --noEmit` 0 errors, `npm run lint` 0/0, `npm run build` passes.
- `npm test` all green, with server/lib/integration tests running under the Node environment.
- `npx playwright test` all green.

## Progress / evidence

_(updated per task)_

## Next step

T1.
