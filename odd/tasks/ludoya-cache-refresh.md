# Ludoya cache refresh (scheduled)

## Objective

Guarantee that the Ludoya data shown on the site (member area "La meva zona" and `/events`) is never more than about one day old, even when nobody visits the site.

## Problem

Ludoya fetches use the Next.js data cache with stale-while-revalidate: an expired entry is served as-is and refreshed in the background by the request that reads it. With low traffic (members mostly use Ludoya directly), the first visitor after days without visits sees data from the last visit, which can be several days old. `/events` keeps 24 h, the member area 60 s, but neither bounds the age without traffic.

## Why

The member area exists to give the site content; stale seat counts are acceptable, but not older than a day (user decision, 2026-10-01).

## Scope

- Tag the Ludoya `fetch` calls with cache tags.
- A route handler `GET /api/cron/refresh`, protected by `CRON_SECRET` (Bearer), that marks the tags stale (`revalidateTag(tag, "max")`) and immediately re-reads the same requests the pages use, so the refresh runs without waiting for a visitor. Built as a small registry so other caches (BGG) can be added later.
- A GitHub Actions workflow that calls it on production (`https://www.darkstone.cat`) twice a day, plus `workflow_dispatch`.
- Docs: CLAUDE.md (API routes, env vars), README if it lists env vars.

Out of scope: preview deployments (protected by Vercel Authentication; user decision: production only), BGG tagging (later, same registry), changing the 60 s / 24 h lifetimes.

## Constraints

- Next 16: `revalidateTag(tag, profile)` two-argument form; `"max"` keeps serving stale data while refreshing, so a Ludoya outage never empties the cache (`{ expire: 0 }` would). Docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`.
- The fetch cache key is URL + headers (not `revalidate`), so the warm-up must request exactly the same URLs as the pages: member area `/events?includeSubEvents=true&pastLimit=200` (60 s), `/events` page `/events?includeSubEvents=true` (24 h), and `/locations`.
- Fail closed: missing `CRON_SECRET` → 500 (no work), wrong/missing token → 401; constant-time comparison; `Cache-Control: no-store`; never log the secret or the Ludoya key.
- `/api/*` is excluded from the proxy matcher (`src/proxy.ts:73`), so no i18n/auth interference.
- Vercel Hobby crons are limited to once a day (±59 min) and run on production only; GitHub Actions schedules run from the default branch (`main`), so the workflow only starts after the merge. GitHub may delay scheduled runs, hence twice a day.
- Requires the `CRON_SECRET` secret in Vercel (Production) and in GitHub (repository secret).

## Configuration

- **TDD**: off (source: no project/session TDD configuration; same as previous ODD documents). Runner: Vitest (`npm run test:unit`).
- **Delivery strategy**: ask-on-risk (default). Forecast ~250 authored changed lines, under the 400-line budget: one branch, work-unit commits on `develop-users`.
- **RDD**: per user-owned switch; assess after each work-unit commit.

## Tasks

- [x] **T1 — Tag Ludoya fetches.** `ludoyaGet` accepts and forwards `next.tags`; a shared tag constant (e.g. `LUDOYA_CACHE_TAG` in `src/lib/ludoya/config.ts`) applied to the events and locations requests. Unit test that the tag reaches `fetch`. Route: delegated (writer, with T2).
- [x] **T2 — Refresh route.** `src/lib/cache-refresh.ts` registry (tag + warm function; Ludoya entry warms the member-area and `/events` requests) and `src/app/api/cron/refresh/route.ts` (Bearer `CRON_SECRET`, 500/401/200 JSON with per-job result, `no-store`). Unit tests for auth outcomes and that `revalidateTag(tag, "max")` runs before the warm-up. Route: delegated (writer, 2+ non-trivial files).
- [x] **T3 — Schedule and docs.** `.github/workflows/cache-refresh.yml` (twice a day UTC + `workflow_dispatch`, `curl -fsS` with the secret, short timeout); CLAUDE.md (API routes list, env var `CRON_SECRET`, workflow note), README if applicable. Route: delegated (same writer).
- [x] **T4 — BGG collection job.** Tag `bgg` on the club collection requests (both subtypes, used by `fetchBggCollection` and `fetchBggCollectionCount`, which share the base URL) and on the thing-enrichment batches of the collection (`fetchThingData`), NOT on per-game search/thing (`fetchBggThings`, `game-matching`). New registry job `bgg` warming `fetchBggCollection()`; it must throw on failure so the job reports `ok:false` (today `fetchBggCollection` may swallow errors — check and expose a throwing variant if needed, keeping page behaviour unchanged). Tests and docs (CLAUDE.md Ludoteca + API route, workflow header). Added 2026-10-01 after an inventory of the server fetch caches: BGG collection is the only other cache worth refreshing (96 + 2 items, 126 KB, ~1 s per call measured live); per-game lookups, user lookups and image assets are not. Route: delegated (writer).

## Acceptance criteria

- `GET /api/cron/refresh` without or with a wrong token → 401; without `CRON_SECRET` configured → 500; with the right token → 200 and the Ludoya entries refreshed.
- A Ludoya failure during the warm-up reports the job as failed and leaves the previous cached data in place.
- Unit tests, lint and typecheck pass.

## Applicable checks

`npm run test:unit`, `npm run lint`, `npx tsc --noEmit`.

## Progress

- 2026-10-01: document created after exploration.
- 2026-10-01: T1 a53f55e, T2 6037482, T3 1da9f5f (delegated writer). Checks: `npm run test:unit` 52 files / 537 tests passed; `npm run lint` clean; `npx tsc --noEmit` clean.
- Background refresh: after `revalidateTag(tag, "max")` the warm-up read is served stale while the refetch runs in the background. Checked in Next's source: background fetch revalidations go to `workStore.pendingRevalidates`, which the route handler hands to `waitUntil` (`next/dist/server/route-modules/app-route/module.js:242-244`), so Vercel keeps the invocation alive until they finish. Still worth confirming the data age after the first manual workflow run.
- Known limitation (accepted): a background refetch failure is not visible in the route's response (the job reports ok while stale data stays); a failed `/locations` call is tolerated as before (only the usual-venue flag). Both show up in the Vercel logs.
- 2026-10-01: parent spot check re-ran `npm run test:unit` (537 passed) and `npx tsc --noEmit` (clean). RDD off (global); assessment tier `high` → independent read-only verifier: PASS, no blocking defects (auth fail-closed and constant-time, cache keys identical to the pages' requests, mock mode and username search unchanged, workflow valid; 6 files / 59 targeted tests passed).
- 2026-10-01: T4 9af55a1 (delegated writer). `fetchBggCollectionOrThrow()` is the throwing core, `fetchBggCollection()` wraps it unchanged; `bgg` tag on collection, count and thing-enrichment requests only; registry job `bgg` after Ludoya (mock mode re-reads local fixtures, harmless). Checks: `npm run test:unit` 62 files / 687 tests passed; `npm run lint` clean; `npx tsc --noEmit` clean.
- 2026-10-01: parent review of T4: diff read (mostly re-indentation into `fetchBggCollectionOrThrow`); spot check re-ran `npm run test:unit` (687 passed), `npx tsc --noEmit` and lint (clean). Workflow `curl --max-time` raised 60 → 120 s: on a cold cache the route waits for Ludoya (~5 s) plus the BGG collection, ~5 sequential enrichment batches and possible 202 retries (2+4+8+16 s), which could exceed 60 s and fail the run although the refresh completes. Known (accepted): enrichment batch failures stay swallowed by `fetchThingData`, so only a failed collection request fails the `bgg` job.
- 2026-10-01: RDD off (global); assessment of T4 (`ab0c220..e2a22af`) tier `high` → independent read-only verifier: PASS, no blocking defects (`fetchBggCollection` behaviour identical per `diff -w`, `bgg` tag on all three collection call sites and the enrichment batches only, job throws on collection failure, docs/workflow accurate; 3 files / 14 targeted tests passed).

## Next step

Merge, set `CRON_SECRET` in Vercel (Production) and GitHub, run the workflow once with `workflow_dispatch`.
