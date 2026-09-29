# Ludoya API — Reference

Base URL: `https://api.ludoya.com` (Ktor server)

Authentication: **not required** for the public endpoints we use.

Images: `https://ludoya-images.s3.eu-west-par.io.cloud.ovh.net` (OVH object storage). Objects are served as `application/octet-stream`, not `image/*`.

> **Undocumented API.** Everything here was discovered by reading the Ludoya Angular SPA bundle (`app.ludoya.com`). It can change without notice, and it did in September 2026. Contact: `app@ludoya.com`.

Last verified: **2026-09-14**. Run `npm run ludoya:check` to re-verify.

---

## How the site uses it

Code lives in `src/lib/ludoya/`. Only two files know about Ludoya's raw API:

| File | Owns |
|---|---|
| `config.ts` | Hosts, group identity, endpoint paths, public URL builders. Env overrides. |
| `client.ts` | `fetch` with timeout, retry, typed `LudoyaApiError`, mock mode, group-id rediscovery. |
| `normalize.ts` | Raw JSON → `LudoyaEvent`. Every field is read through a guard that throws `LudoyaShapeError` naming the exact path that changed. |
| `types.ts` | Public types consumed by components. Independent from Ludoya's shapes. |
| `index.ts` | `fetchUpcomingEvents()`, the only function the pages call. |

### Fetch flow

```
1. GET /users/{groupId}/events?displayAllRecurring=true
   → futureEvents.elements[]  (skip canceled, classify regular/special)
   ↳ on 404: GET /groups/search?nameFilter=darkstone, match username
     "darkstonecat", retry with the discovered id and log it

2. For each event with childEventCounts.games > 0 (in parallel):
   GET /events/{eventId}/children
   → list[] where game != null  → planned plays
```

Event images (`/events/images`) add one more step, see [Event images and BGG](#event-images-and-bgg):

```
3. For each planned game with a slug (6 in parallel, cached 30 days):
   GET /boardgames/{slug}  → bggUrl → BGG id
```

A failure fetching one event's children only drops that event's games. A failure in step 1 returns `error: "api_error" | "timeout"` and the page shows its error state.

### Resilience

- **Retries.** 3 attempts with exponential backoff (1s, 2s) on timeouts, network errors and 408/425/429/5xx. Other 4xx fail immediately.
- **Last good data.** Requests use `next: { revalidate: 86400 }`. Next.js only caches 200 responses, and when an entry is stale it serves it and refetches in the background. A failed refetch keeps the old entry, so a Ludoya outage keeps showing the last good events instead of the error state. The error state only appears when there is no cached entry at all.
- **Shape changes.** A renamed field fails loudly in the logs, e.g. `Ludoya response shape changed at "events.futureEvents.elements[0].title": expected non-empty string, received object{id, name, startsAt, endsAt}`.
- **Monitoring.** `.github/workflows/ludoya-check.yml` runs `scripts/ludoya/check.mjs` every Monday and on demand. A failing run means Ludoya changed something.

### Configuration

All optional. Defaults live in `config.ts`.

| Variable | Default | Use |
|---|---|---|
| `LUDOYA_GROUP_ID` | `b28a80d31be24cffa35d9176c3f1ac50` | Set it when the logs report a rediscovered id |
| `LUDOYA_GROUP_USERNAME` | `darkstonecat` | Stable handle used to recognise the group |
| `LUDOYA_GROUP_SEARCH_QUERY` | `darkstone` | Text for group search. It matches the group **name**, not the username |
| `LUDOYA_API_URL` | `https://api.ludoya.com` | API host |
| `LUDOYA_APP_URL` | `https://app.ludoya.com` | Links to event pages |
| `LUDOYA_IMAGE_BASE_URL` | `https://ludoya-images.s3.eu-west-par.io.cloud.ovh.net` | Game cover URLs. **Also update `next.config.ts`** `remotePatterns` and CSP `img-src` |
| `LUDOYA_MOCK` | unset | `1` serves fixtures from `public/mock/ludoya/` |

---

## Endpoints

### 1. `GET /users/{groupId}/events` — Group events

Groups share the users namespace. `/groups/{groupId}/events` does **not** exist.

| Query param | Effect |
|---|---|
| `displayAllRecurring=true` | **Required for us.** Without it each recurring series collapses to its next occurrence (4 future events instead of 23). |
| `pastLimit=<n>` | Limits `pastEvents`. |

```jsonc
{
  "futureCount": 23, "pastCount": 160, "totalCount": 183,
  "futureEvents": { "elements": [Event] },
  "pastEvents":   { "elements": [Event] }
}
```

**Event (list item)** — fields we read are marked ★

| Field | Type | Notes |
|---|---|---|
| ★ `id` | string | |
| ★ `title` | string | |
| ★ `startsAt` / `endsAt` | ISO string (UTC, `Z`) | |
| ★ `timeZone` | string | `Europe/Madrid` |
| ★ `canceled` | boolean | |
| ★ `imageUrl` | string \| null | **Reduced** image only, see Images |
| ★ `childEventCounts.games` | number | Planned plays count. Missing when zero |
| `type` | `"MEETUP"` | |
| `status` | `"OPEN"` … | |
| `recurrenceConfigId` | string | `90ecc5adbcf74b429cdfe306ff7d3253` = Fridays |
| `children[]` | `{ id, title, imageUrl, startsAt, seatedCount, capacity }` | Preview of children, **no game object** |
| `goingCount`, `seatedCount`, `waitlistCount`, … | number | |
| `location` | `{ id, city, latitude, longitude }` | |
| `organizer` | Group summary | |

Not in the list: `description`, full `image` object. Both only in `GET /events/{id}`.

### 2. `GET /events/{eventId}/children` — Child events

```jsonc
{ "list": [ChildEvent] }
```

Children are planned plays (`type: "PLANNED_PLAY"`) and, for multi-day events, days. Order is not stable; we sort by `startsAt`.

| Field | Type | Notes |
|---|---|---|
| ★ `game` | object \| null | `null` for prototypes or plays without a linked game. We skip those |
| ★ `game.name` | string | |
| ★ `game.yearPublished` | number | Used to disambiguate BGG matches |
| ★ `game.imageId` | string | `games/<id>` or `game-versions/<id>`. URL = `{imageBase}/{imageId}.jpg` |
| ★ `game.slug` | string | Key for `GET /boardgames/{slug}` |
| ★ `game.type` | `"BASE"` \| `"RPG_BOOK"` | `RPG_BOOK` marks roleplaying games |
| ★ `canceled` | boolean | |
| ★ `startsAt` | ISO string | |
| `gameVersion` | object \| null | Carries the same `imageId` when set |
| `parentEvent` | full Event | Heavily duplicated data, ignore |

### 3. `GET /groups/search` — Group search

Used only to rediscover the group id.

| Query param | Notes |
|---|---|
| `nameFilter` | Matches the display name. Unknown params are ignored and return the first 50 groups |
| `fromLatitude`, `fromLongitude`, `maxDistanceKm`, `groupType`, `minMembers`, `sortBy` | Optional |

```jsonc
{ "totalNumber": 1, "pageNumber": 0, "size": 50,
  "elements": [{ "id": "b28a…", "username": "darkstonecat", "name": "DarkStone Catalunya", … }] }
```

### 4. `GET /boardgames/{slug}` — Game detail

Only used by event images, to get each game's BoardGameGeek id. The game's Ludoya `id` does **not** work here, only the `slug`.

| Field | Type | Notes |
|---|---|---|
| ★ `bggUrl` | string | Always `https://boardgamegeek.com/boardgame/<id>`, also for RPGs |
| `complexity` | number | Mirrors BGG weight. `0` when unknown |
| `type` | `"BASE"` \| `"RPG_BOOK"` | |
| `imageId`, `name`, `yearPublished`, `minPlayerCount`, `maxPlayerCount`, `minPlayTimeMinutes`, `maxPlayTimeMinutes`, `minAge`, `categories`, `mechanics`, `bggRating` | | Not used, BGG is the source |

Verified 2026-09-14 over every game ever planned by the group: 409 of 409 have `bggUrl`. Cross-checked against the club's BGG collection: 36 of 38 name matches share the id, the other 2 point to a different edition of the same game.

### 5. `GET /events/{eventId}` — Event detail (not used)

Adds `description`, `image: { url, previewUrl, thumbnailUrl }`, `recurrenceConfig`, `participants`, `slug` and, for planned plays, `game`. Useful if we ever need descriptions.

### Images

The list's `imageUrl` is a reduced variant. The original is the same path without the size suffix:

| List value | Original |
|---|---|
| `posts/<id>-1-preview.jfif` | `posts/<id>-1.jfif` |
| `posts/<id>-1-thumbnail.jpg` | `posts/<id>-1.jpg` |
| `game-versions/<id>_preview.jpg` | `game-versions/<id>.jpg` |

All are JPEG bytes served as `application/octet-stream`. Next.js' image optimizer sniffs the bytes and handles them. The event image generator (`src/lib/event-image/assets.ts`) sniffs them too, because Satori rejects non-image MIME types.

### Other endpoints seen in the bundle

`GET /events/all` (requires `pagination=<page>,<size>` or a date window plus location), `/events/{id}/games`, `/events/{id}/attendees.csv`, `/events/{id}/calendar-invite`, `/events/series/{id}`, `/groups/{id}`, `/users/{id}/groups`, `/stats/event/{id}`.

---

## Event images and BGG

`src/lib/game-matching.ts` turns planned plays into covers and frames. **BGG is the source of truth** for cover, weight and type. Ludoya only provides the bridge to the BGG id.

| Step | Source | Cover |
|---|---|---|
| 1. BGG id | `GAME_NAME_OVERRIDES`, else Ludoya `bggUrl` | |
| 2. Club collection by id | Ludoteca's BGG collection, no request | BGG |
| 3. BGG `thing` by id | One batched BGG request | BGG |
| 4a. Name match in collection | Exact, then fuzzy name | Ludoya |
| 4b. BGG `search` + `thing` | Name, year as tiebreaker | Ludoya |
| 5. Last resort | Ludoya only, weight 0 | Ludoya, orange frame or RPG frame |

Step 4 runs when there is no id or BGG did not answer for it. Name matches prefer Ludoya's cover because the BGG item may be the wrong game; exact ids prefer BGG's. RPG detection combines BGG item type, Ludoya `RPG_BOOK` and the manual name list.

Each generation logs how every game resolved:

```
[EventImage] Resolved 3/3 games: 7 Wonders Duel (bgg-id #173346), Akropolis (collection-id #357563), ALIEN: The Roleplaying Game (ludoya-only)
```

Many `ludoya-only` entries in production mean BGG is failing. Without `BGG_API_KEY`, locally, games outside the mock collection always end up `ludoya-only`.

---

## September 2026 migration

Ludoya renamed "meetups" to "events", moved the group to a new id and replaced planned plays with child events. The old endpoints return an empty 404.

| Before | After |
|---|---|
| Group id `c801047e5d1d4d3295976ebd1e8b48ab` | `b28a80d31be24cffa35d9176c3f1ac50` |
| `GET /groups/{id}/meetups?onlyFuture=true` | `GET /users/{id}/events?displayAllRecurring=true` |
| `futureMeetups.elements` | `futureEvents.elements` |
| `plannedPlayCount` | `childEventCounts.games` |
| `GET /meetups/{id}/planned-plays` → `list[].game.image.url` | `GET /events/{id}/children` → `list[].game.imageId` |
| `image.url` / `image.previewUrl` in list | `imageUrl` (reduced only) |
| `img.ludoya.com` | `ludoya-images.s3.eu-west-par.io.cloud.ovh.net` |
| `app.ludoya.com/meetups/{id}` | `app.ludoya.com/events/{id}` |

---

## When it breaks again

1. **Run `npm run ludoya:check`.** It says which step fails: group, events feed, children, BGG link or images.
2. **Group id changed.** The site already recovers by itself and logs `Group id changed X → Y`. Set `LUDOYA_GROUP_ID=Y` in Vercel to skip the extra request.
3. **Shape changed.** Read the `LudoyaShapeError` in the Vercel logs, adjust `normalize.ts`, refresh the fixtures.
4. **Endpoint moved.** Rediscover it from the SPA bundle:

   ```bash
   mkdir -p /tmp/ludoya && cd /tmp/ludoya
   curl -s https://app.ludoya.com/ -o index.html
   MAIN=$(grep -oE 'main-[A-Z0-9]+\.js' index.html | head -1)
   curl -s "https://app.ludoya.com/$MAIN" -o main.js
   grep -oaE 'chunk-[A-Z0-9]{8}\.js' main.js | sort -u \
     | xargs -P 16 -I{} curl -s "https://app.ludoya.com/{}" -o {}
   # All API calls the app makes:
   cat *.js | grep -oaE '\.(get|post)\(`\$\{[a-zA-Z]+\.apiUrl\}[^`]*`' | sort -u
   # Query params of a given call, e.g. getUserEvents:
   perl -0777 -ne 'while(/(getUserEvents\(.{0,400})/gs){print "$1\n"}' *.js
   ```

   Then update `ludoyaEndpoints` in `config.ts`, the parsers in `normalize.ts`, `scripts/ludoya/check.mjs` and this document.

5. **Refresh fixtures** after any fix:

   ```bash
   API=https://api.ludoya.com; G=b28a80d31be24cffa35d9176c3f1ac50; D=public/mock/ludoya
   curl -s "$API/users/$G/events?displayAllRecurring=true" \
     | jq '{futureCount, pastCount: 0, totalCount: .futureCount, futureEvents, pastEvents: {elements: []}}' > $D/events.json
   curl -s "$API/groups/search?nameFilter=darkstone" | jq . > $D/groups-search.json
   for id in $(jq -r '.futureEvents.elements[] | select(.childEventCounts.games > 0) | .id' $D/events.json); do
     curl -s "$API/events/$id/children" | jq . > "$D/children-$id.json"
   done
   mkdir -p $D/boardgames
   for s in $(jq -r '.list[] | .game.slug // empty' $D/children-*.json | sort -u); do
     curl -s "$API/boardgames/$s" | jq '{id, slug, name, type, yearPublished, imageId, bggUrl, complexity}' > "$D/boardgames/$s.json"
   done
   ```

## Known behaviour

- **Visibility.** Events with `visibility: "ONLY_GROUP"` are not returned without auth. Special events must be `PUBLIC` to appear on the site.
- **DST.** `startsAt` is UTC, so Friday 16:00 local is `14:00Z` in summer and `15:00Z` in winter. Classification always converts with `timeZone`.
- **Zero-length events.** Some special events have `startsAt === endsAt` (e.g. the D&D one-shot).
