# Ludoya API — Reference (public v1)

Base URL: `https://api.ludoya.com/public/v1` (sandbox: `https://api.dev.ludoya.com`, needs a sandbox key).

Authentication: header `X-Api-Key: ldy_...`, scoped to the organisation that owns the key (so no request names it). **Server-side credential**: never send it from a browser, never log it. Business plan: 100 requests/minute, no daily cap. Vendor documentation: `docs/ludoya-api-reference-official.md` and `GET /public/v1/openapi.json` (unauthenticated).

Conventions from the vendor: ISO-8601 instants, IANA time zones, `pagination=size,pageIndex`, errors as `{ "message", "code" }` with `code` in `validation_failed | unauthorized | forbidden | not_found | conflict | rate_limited`, responses carry `Cache-Control: private, max-age=30` and `X-RateLimit-*` headers, a 429 carries `Retry-After`.

Last verified: **2026-09-30**. Run `npm run ludoya:check` to re-verify.

---

## How the site uses it

Code lives in `src/lib/ludoya/`; only `normalize.ts` knows raw shapes.

| File | Owns |
|---|---|
| `config.ts` | Hosts, endpoint builders, cache lifetimes, regular-session schedule. Only `LUDOYA_API_URL`, `LUDOYA_APP_URL`, `LUDOYA_MOCK` and `LUDOYA_API_KEY` are read from env. |
| `client.ts` | `ludoyaGet()`: `X-Api-Key`, 10 s timeout, 3 attempts with backoff, `Retry-After` honoured up to 5 s, typed `LudoyaApiError`, mock mode. `import "server-only"`. |
| `shape.ts` | Guards; `LudoyaShapeError` names the exact field path that changed. |
| `normalize.ts` | Raw JSON → `LudoyaSession`, `LudoyaSessionPlay`, `LudoyaLocation`, `LudoyaUser`; `withUsualVenue()`. |
| `sessions.ts` | `fetchSessions()`, Madrid-calendar-day windows (`sessionsInNextDays`, `sessionsInMonth`). |
| `username.ts` | `lookupLudoyaUsername()`. |
| `types.ts` | Public types. Independent from Ludoya's shapes. |
| `index.ts` | `fetchUpcomingEvents()` for `/events` and event images (long cache, `PUBLIC` events only, stripped to `LudoyaEvent`). |

Member-area data lives outside the adapter, in `src/lib/member-sessions.ts` (`fetchMemberWeekSessions`, `fetchMonthEvents`, cache 60 s, BGG covers through `src/lib/game-matching.ts`). Username checks are server actions in `src/lib/profile/username-checks.ts`.

### Fetch flow

```
GET /events?includeSubEvents=true      (one request)
  → futureEvents.elements[]  sessions (MEETUP, parentId null) and their plays
                              (PLANNED_PLAY with parentId = session id and a game)
GET /locations                          (cached 1 h, optional)
  → the location with isDefault = true is the usual venue
```

There is no per-event children request any more. For months that already started, the calendar adds `pastLimit=60` (most recent past events, sub-events included).

### Cache and resilience

| Data | `revalidate` |
|---|---|
| `/events`, event images | 86400 s |
| Member home sessions and month | 60 s |
| Locations | 3600 s |
| Username checks | 0 (never cached) |

Next.js stores only 200 responses and keeps serving a stale entry when a refetch fails, so an outage shows the last good data. The error state (`error: "api_error" | "timeout"`) only appears with a cold cache. A locations failure only drops the usual-venue flag.

### Configuration

| Variable | Use |
|---|---|
| `LUDOYA_API_KEY` | Required outside mock mode. Vercel env and the `LUDOYA_API_KEY` GitHub secret (weekly check). |
| `LUDOYA_API_URL` | API host, default `https://api.ludoya.com`. |
| `LUDOYA_APP_URL` | Web app host for event links, default `https://app.ludoya.com`. |
| `LUDOYA_MOCK` | `1` serves sanitized fixtures from `public/mock/ludoya/v1/`; no key, no network. Playwright sets it. |

The image host (`ludoya-images.s3.eu-west-par.io.cloud.ovh.net`) must stay in `next.config.ts` `remotePatterns` and CSP `img-src`.

---

## Endpoints we use

### `GET /events?includeSubEvents=true[&pastLimit=n]`

```jsonc
{
  "futureEvents": { "totalNumber": 27, "pageNumber": 0, "size": 27, "elements": [Event] },
  "pastEvents":   { "totalNumber": 166, "pageNumber": 0, "size": 0,  "elements": [Event] }
}
```

`pastEvents` is empty unless `pastLimit` is set (most recent first). Fields we read are marked ★; optional fields are absent when unset.

| Field | Notes |
|---|---|
| ★ `id`, ★ `type` | `MEETUP` (sessions), `PLANNED_PLAY`, `TOURNAMENT`, `PLAY_BOOTH`, `ROTATIVE_PLAYTEST` |
| ★ `title`, `description` | |
| ★ `startsAt`, ★ `endsAt`, `timeZone` | UTC instants; Friday 16:00 local is `14:00Z` in summer, `15:00Z` in winter |
| `parentId` | Set on sub-events. Plays hang off their session |
| `imageUrl` | Full-size image (the old API sent reduced ones) |
| `participantCount` | Seats taken |
| `capacity`, `minParticipants` | Nullable / optional. Null capacity = unlimited |
| `location` | `{ id, name, address, latitude, longitude, isDefault: false, … }`. **`isDefault` is always false here**: use `/locations` |
| `visibility` | `PUBLIC`, `ONLY_GROUP`, `ONLY_FRIENDS`, `PRIVATE`. The key returns all of them, so the site filters |
| `draft`, `canceled` | Drafts appear in the list; skip both |
| `master`, `teacher` | Optional `{ id, username, name, avatarUrl }`: game master / teacher, used as organizer |
| `game` | On plays: `{ id, slug, name, imageUrl, yearPublished? }` |

**Not exposed by the public API** (verified 2026-09-30): the BGG id of a game, a game type (no RPG flag), a waiting-list count (`queuedParticipantCount`), `childEventCounts`. Standalone plays (`PLANNED_PLAY` with no `parentId`, e.g. an RPG table) appear at top level; the site ignores them because they have no session to show under.

### `GET /events/{eventId}/children`

`{ "children": [Event] }`, the same shape as list items. Not used by the site today (sub-events arrive with `includeSubEvents`); the check script exercises it.

### `GET /locations`

`{ "locations": [{ id, name, address, latitude, longitude, imageUrl, capacity, isDefault, spots[] }] }`. Exactly one location has `isDefault: true`: the usual venue ("Centre Cívic Ca N’Aurell"). Names are shown as received.

### `GET /search/users?query=&intent=PLAY&pagination=`

`{ "users": { totalNumber, pageNumber, size, elements: [{ id, username, name, avatarUrl }] } }`. Matching is partial (`query=a` returns many users), so the site requires an exact case-insensitive `username` match. No match is a 200 with empty `elements`. `intent=PLAY` can miss users who opted out of play tagging: a miss is a soft warning only.

### `GET /search/boardgames?query=`

Returns `{ games: { elements: [{ id, slug, name, imageUrl, yearPublished, minPlayerCount, maxPlayerCount, isExpansion }] } }`. Fixture only; the site does not call it (BGG is the reference for covers).

### BoardGameGeek username lookup (not Ludoya)

`GET https://boardgamegeek.com/xmlapi2/user?name=` with the BGG `Bearer` token. Verified 2026-09-30: a known name answers 200 XML `<user id="…" name="…">`; an unknown name answers **404 with an HTML page** (not a 200 with an empty id). The site treats 404 and an empty id as `not_found`, any other outcome as `failed`.

---

## Event images and BGG

`src/lib/game-matching.ts` turns planned plays into covers and frames. BGG is the source of truth for cover, weight and type; the public API has no BGG id, so games are matched by **name + year**.

| Step | Source | Cover |
|---|---|---|
| 1. Manual override | `GAME_NAME_OVERRIDES` (name → BGG id), club collection then BGG `thing` | BGG |
| 2. Name match in collection | Exact, then fuzzy name | BGG if the year matches, else Ludoya |
| 3. BGG `search` + `thing` | Name, year as tiebreaker | BGG if the year matches, else Ludoya |
| 4. Last resort | Ludoya only, weight 0 | Ludoya, orange frame |

RPG detection uses the BGG item type and the manual name list (`RPG_GAME_NAMES`); Ludoya no longer sends a game type. Each generation logs how every game resolved:

```
[EventImage] Resolved 3/3 games: Signorie (collection-name #77), Ostia (bgg-search #11), Prototype X (ludoya-only)
```

Many `ludoya-only` entries in production mean BGG is failing or names diverge; add an override. Without `BGG_API_KEY`, locally, games outside the mock collection always end up `ludoya-only`.

---

## When it breaks

1. **Run `npm run ludoya:check`.** It names the failing step: key, locations, events feed, plays, user search or images. A `401` means the key was revoked or expired: issue a new one in the Ludoya web app and update Vercel and the GitHub secret.
2. **Shape changed.** Read the `LudoyaShapeError` in the logs (it names the field path), adjust `normalize.ts`, refresh the fixtures, update this document.
3. **Endpoint changed.** Fetch `GET /public/v1/openapi.json` and compare with `ludoyaEndpoints` in `config.ts`.
4. **Rate limited.** Look for `rate_limited` in the logs. The client waits for a `Retry-After` up to 5 s, otherwise it surfaces the error; caches keep pages served.
5. **Refresh fixtures** (they must stay free of personal data: replace organizers and users with placeholders such as "Organizer A" / "Member A"):

   ```bash
   API=https://api.ludoya.com/public/v1; D=public/mock/ludoya/v1
   H="X-Api-Key: $LUDOYA_API_KEY"
   curl -s -H "$H" "$API/events?includeSubEvents=true" | jq . > $D/events.json
   curl -s -H "$H" "$API/locations" | jq . > $D/locations.json
   # then edit: trim to a handful of events, keep one draft and one standalone play,
   # replace master/teacher with {"id":"…","username":"organizer-a","name":"Organizer A","avatarUrl":null}
   ```

   `children-<eventId>.json` fixtures come from `GET /events/{id}/children` for events that have plays; `search-users-found.json` holds the placeholder user the mock treats as existing (`member-a`).

## Known behaviour

- **Visibility.** The organisation key returns every visibility. `/events` and event images list `PUBLIC` only; the member area also keeps `ONLY_GROUP`.
- **DST.** Classification of regular sessions converts with `timeZone` (Fri 16:00–20:30, Sat 10:00–13:30 local).
- **Zero-length events.** Some special events have `startsAt === endsAt`.
- **Images.** JPEG bytes served as `application/octet-stream`. Next.js' optimizer sniffs them; the event image generator (`src/lib/event-image/assets.ts`) sniffs them too, because Satori rejects non-image MIME types.

## History

Until September 2026 the site used Ludoya's undocumented web-app API (`/users/{groupId}/events`, `/events/{id}/children`, `/boardgames/{slug}` for the BGG link) with group-id rediscovery. It was replaced by the public v1 API in the member-area work (`odd/tasks/zona-socis.md`, block B2); the old client, fixtures and `LUDOYA_GROUP_*` / `LUDOYA_IMAGE_BASE_URL` variables were removed.
