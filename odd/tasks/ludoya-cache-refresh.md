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
- [ ] **T3 — Schedule and docs.** `.github/workflows/cache-refresh.yml` (twice a day UTC + `workflow_dispatch`, `curl -fsS` with the secret, short timeout); CLAUDE.md (API routes list, env var `CRON_SECRET`, workflow note), README if applicable. Route: delegated (same writer).

## Acceptance criteria

- `GET /api/cron/refresh` without or with a wrong token → 401; without `CRON_SECRET` configured → 500; with the right token → 200 and the Ludoya entries refreshed.
- A Ludoya failure during the warm-up reports the job as failed and leaves the previous cached data in place.
- Unit tests, lint and typecheck pass.

## Applicable checks

`npm run test:unit`, `npm run lint`, `npx tsc --noEmit`.

## Progress

- 2026-10-01: document created after exploration. Nothing implemented yet.

## Next step

T1 + T2 + T3 through one delegated writer.
