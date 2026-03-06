# Ludoya API — Reference

Base URL: `https://api.ludoya.com`

Authentication: **Not required** for public group endpoints. Authenticated endpoints use `Authorization: Bearer <token>` via HTTP interceptor (not needed for our use case).

Images CDN: `https://img.ludoya.com`

> **Note:** This is an undocumented API discovered via reverse engineering of the Ludoya Angular SPA (`app.ludoya.com`). There is no official API documentation. The API could change without notice. Contact: `app@ludoya.com`.

---

## Discovery Details

- Ludoya is an Angular SPA served from `app.ludoya.com` (nginx)
- Environment config found in chunk `chunk-OJLW5WHV.js`: production `apiUrl` = `https://api.ludoya.com`
- Group service in chunk `chunk-U2LQI36K.js` (GroupService)
- Meetup/PlannedPlay service in chunk `chunk-2ZNI6T7F.js` (MeetupService)
- DarkStone Catalunya group ID: `c801047e5d1d4d3295976ebd1e8b48ab`
- DarkStone Catalunya slug: `darkstonecat`

---

## Endpoints We Need

### 1. `GET /groups/slug/{slug}` — Group info by slug

Returns group metadata. Use this to resolve the slug to a group ID.

**Example:** `GET /groups/slug/darkstonecat`

#### Response

```json
{
  "id": "c801047e5d1d4d3295976ebd1e8b48ab",
  "name": "DarkStone Catalunya",
  "slug": "darkstonecat",
  "userId": "b28a80d31be24cffa35d9176c3f1ac50",
  "description": "Associació establerta a Terrassa i oberta a tothom!",
  "imageUrl": "https://img.ludoya.com/avatars/18d4feddbcc1474c826287697c0d40ff.png",
  "visibility": "PUBLIC",
  "joinPolicy": "OPEN",
  "postPermission": "MEMBERS",
  "hostEventPermission": "ORGANIZERS",
  "location": { "...Location object..." },
  "distance": 2147483647,
  "createdAt": "2025-03-18T19:38:27.424097Z",
  "memberCount": 200,
  "ownRole": null,
  "membershipRequestCount": 0
}
```

---

### 2. `GET /groups/{groupId}/meetups` — Group meetups (events)

Returns future and past meetups and planned plays for a group.

**Example:** `GET /groups/c801047e5d1d4d3295976ebd1e8b48ab/meetups?onlyFuture=true`

#### Query Parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `onlyFuture` | No | `"true"` | Only return future events (omits past meetups/plays) |

#### Response Structure

```json
{
  "futureMeetups": {
    "totalNumber": 16,
    "pageNumber": 0,
    "size": 16,
    "elements": [ "...Meetup[]..." ]
  },
  "futurePlannedPlays": {
    "totalNumber": 0,
    "pageNumber": 0,
    "size": 0,
    "elements": [ "...PlannedPlay[]..." ]
  },
  "pastMeetups": {
    "totalNumber": 95,
    "pageNumber": 0,
    "size": 0,
    "elements": []
  },
  "pastPlannedPlays": {
    "totalNumber": 12,
    "pageNumber": 0,
    "size": 0,
    "elements": []
  },
  "totalMeetupsCount": 111,
  "totalPlannedPlaysCount": 12,
  "pastEventsCount": 107,
  "futureEventsCount": 16
}
```

> With `onlyFuture=true`, `pastMeetups.elements` and `pastPlannedPlays.elements` are empty arrays (but `totalNumber` still reflects the total count).

#### Meetup Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Meetup unique identifier |
| `title` | String | Event title (e.g. "Divendres de jocs!") |
| `description` | String | Event description |
| `organizer` | User | Event organizer (see User object) |
| `location` | Location | Venue (see Location object) |
| `spotId` | String? | Specific spot within the location |
| `distance` | Number | Distance from request origin (irrelevant for server-side) |
| `group` | Group | Parent group (see Group object) |
| `isOfficial` | Boolean | Whether it's an official group event |
| `startsAt` | String (ISO 8601) | Start datetime in UTC |
| `endsAt` | String (ISO 8601) | End datetime in UTC |
| `timeZone` | String (IANA) | Event timezone (e.g. `"Europe/Madrid"`) |
| `image` | Image? | Event image (see Image object) |
| `visibility` | String | `"PUBLIC"`, `"ONLY_GROUP"`, etc. |
| `restrictedAttendance` | Boolean | Whether attendance is restricted |
| `attendeeLimit` | Number? | Max attendees (null = unlimited) |
| `canceled` | Boolean | Whether the event is canceled |
| `closed` | Boolean | Whether the event is closed for new attendees |
| `takeGamesPermission` | String | Who can bring games: `"ORGANIZERS"`, `"ANYONE"` |
| `organizePlaysPermission` | String | Who can create planned plays: `"ORGANIZERS"`, `"ANYONE"` |
| `tournament` | Object? | Tournament config (null if not a tournament) |
| `plannedPlayCount` | Number | Number of planned game sessions |
| `attendeeCount` | Number | Number of confirmed attendees |
| `sortWeight` | Number | Sorting priority (higher = more relevant) |
| `interactions` | Interactions | Likes and comments (see Interactions object) |
| `recurrenceConfigId` | String? | Recurrence group ID (same ID = recurring event series) |

---

### 3. `GET /meetups/{meetupId}/planned-plays` — Planned plays for a meetup

Returns all game sessions scheduled within a specific meetup/event.

**Example:** `GET /meetups/b5a6cbffb4cf4df0b02812a0ae3abf38/planned-plays`

#### Response Structure

```json
{
  "list": [ "...PlannedPlay[]..." ]
}
```

#### PlannedPlay Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Planned play unique identifier |
| `organizer` | User | Who organized this game session |
| `game` | Game | Board game info (see Game object) |
| `gameVersion` | GameVersion | Specific version being played |
| `expansions` | GameVersion[] | Expansions included in this session |
| `meetup` | Meetup | Parent meetup (full meetup object, nested) |
| `title` | String | Play title (usually the game name) |
| `description` | String? | Additional notes/description |
| `startsAt` | String (ISO 8601) | Start datetime in UTC |
| `timeZone` | String (IANA) | Timezone (e.g. `"Europe/Madrid"`) |
| `location` | Location | Venue |
| `spotId` | String? | Specific spot/table |
| `group` | Group | Parent group |
| `isOfficial` | Boolean | Official group play |
| `image` | Image? | Custom image for this play |
| `slots` | Number | Max player slots |
| `estimatedDurationMinutes` | Number | Estimated play duration in minutes |
| `visibility` | String | `"PUBLIC"`, etc. |
| `restrictedAttendance` | Boolean | Restricted sign-up |
| `play` | Object? | Linked gameplay record (null if not played yet) |
| `canceled` | Boolean | Whether canceled |
| `closed` | Boolean | Whether closed for sign-ups |
| `teacher` | User? | Person teaching the game (null if none) |
| `master` | User? | Game master for RPGs (null if not RPG) |
| `participants` | Participant[] | Signed-up players |
| `waitList` | Participant[] | Players on the wait list |
| `declinedParticipants` | Participant[] | Players who declined |
| `sortWeight` | Number | Sorting priority |
| `interactions` | Interactions | Likes and comments |

---

## Shared Object Types

### User

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | User ID |
| `username` | String | Username |
| `name` | String | Display name |
| `avatarUrl` | String (URL) | Avatar image URL (`img.ludoya.com`) |
| `isGroup` | Boolean? | `true` if this is a group account |

### Game

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Ludoya game ID |
| `slug` | String | URL-friendly game name |
| `name` | String | Game display name |
| `imageId` | String | Image path for CDN |
| `image` | Image | Game box art images |
| `type` | String | `"BASE"` or `"EXPANSION"` |
| `yearPublished` | Number | Year of publication |
| `versionId` | String (UUID) | Default version ID |

### GameVersion

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Version ID |
| `name` | String | Version name |
| `label` | String? | Version label |
| `languages` | String[] | Language codes (e.g. `["es"]`, `["ca", "es"]`) |
| `yearPublished` | Number | Year of publication |
| `imageId` | String | Image path for CDN |
| `image` | Image | Version-specific images |
| `publisher` | String | Publisher name |

### Location

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Location ID |
| `creator` | User | Who created this location |
| `name` | String | Venue name (e.g. "Centre Civic Ca N'Aurell") |
| `address` | String | Full address |
| `latitude` | Number | Latitude coordinate |
| `longitude` | Number | Longitude coordinate |
| `visibility` | String | `"PUBLIC"` |
| `imageUrl` | String? | Location image |
| `capacity` | Number? | Venue capacity |
| `spots` | Object[] | Named spots/tables within the venue |

### Image

| Field | Type | Description |
|-------|------|-------------|
| `url` | String (URL) | Full resolution image |
| `previewUrl` | String (URL) | Medium resolution preview |
| `thumbnailUrl` | String? (URL) | Small thumbnail (not always present) |

> Image formats: `.jfif` for event images, `.jpg` for game images, `.png` for avatars. All served from `img.ludoya.com`.

### Participant

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Player display name |
| `userId` | String (UUID) | Player user ID |
| `username` | String | Player username |
| `avatarUrl` | String (URL) | Player avatar |
| `addedBy` | String? | Who added this player (null if self-joined) |
| `status` | String | `"CONFIRMED"`, `"PENDING"` |
| `experience` | String | `"NO_EXPERIENCE"`, `"SOME_EXPERIENCE"`, `"EXPERIENCED"` |

### Interactions

| Field | Type | Description |
|-------|------|-------------|
| `likeCount` | Number | Number of likes |
| `commentCount` | Number | Number of comments |
| `liked` | Boolean | Whether current user liked (always `false` without auth) |
| `likes` | User[] | Users who liked |
| `comments` | Object[] | Comment list |

### Group

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Group ID |
| `name` | String | Group name |
| `slug` | String | URL slug |
| `userId` | String (UUID) | Owner user ID |
| `description` | String | Group description |
| `imageUrl` | String (URL) | Group avatar |
| `visibility` | String | `"PUBLIC"`, `"PRIVATE"` |
| `joinPolicy` | String | `"OPEN"`, `"APPROVAL"`, `"INVITE"` |
| `postPermission` | String | `"MEMBERS"`, `"ORGANIZERS"` |
| `hostEventPermission` | String | `"ORGANIZERS"`, `"MEMBERS"` |
| `location` | Location | Default group location |
| `createdAt` | String (ISO 8601) | Creation date |
| `memberCount` | Number? | Total members |
| `ownRole` | String? | Current user's role (null without auth) |

---

## Other Available Endpoints (discovered but not needed)

These were found in the MeetupService and GroupService but are **not needed** for the events page. Listed for future reference.

### MeetupService

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/meetups/all` | GET | Search all public meetups (with filters) |
| `/meetups` | GET | Current user's meetups (requires auth) |
| `/meetups/{id}` | GET | Single meetup details |
| `/meetups/{id}/games` | GET | Games brought to a meetup |
| `/meetups/{id}/children` | GET | Sub-events of a meetup |
| `/meetups/{id}/join` | POST | Join a meetup (requires auth) |
| `/meetups/{id}/leave` | POST | Leave a meetup (requires auth) |
| `/meetups/{id}/attendees` | POST | Add attendees (requires auth) |
| `/planned-plays/{id}` | GET | Single planned play details |
| `/planned-plays` | GET | Current user's planned plays (requires auth) |
| `/boardgames/{id}/planned-plays` | GET | Planned plays for a specific game |

### GroupService

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/groups` | GET | All groups |
| `/groups/{id}` | GET | Group by ID |
| `/groups/search` | GET | Search groups (with filters, pagination, geo) |
| `/groups/{id}/members` | GET | Group members (paginated) |
| `/groups/{id}/boardgames/collective` | GET | Group's collective game collection |
| `/groups/{id}/boardgames/summary` | GET | Collection summary stats |
| `/groups/{id}/gameplays` | GET | Group game play history |
| `/groups/{id}/gameplays/stats` | GET | Gameplay statistics by period |
| `/groups/{id}/feed` | GET | Group activity feed |
| `/groups/{id}/stats` | GET | Group statistics |
| `/users/{id}/groups` | GET | Groups a user belongs to |
| `/users/{id}/meetups` | GET | User's meetups |

---

## Important Discoveries

### Event Visibility

Events with `visibility: "ONLY_GROUP"` are **not returned** by the public API (no auth). They return `{"message": "Event is not accessible"}` when accessed directly by ID, and are excluded from `/groups/{groupId}/meetups` responses.

This means **special events created with group-only visibility will not appear on the website**. Organizers must set visibility to `PUBLIC` for events to be displayed. All regular Friday/Saturday events observed so far use `PUBLIC` visibility.

### Multi-Day Events (Children)

Multi-day events (e.g., "Ègara Juga") use a parent-child structure:
- The parent meetup appears in the group meetups list
- Child events (individual days) are accessible via `GET /meetups/{parentId}/children`
- The Ludoya SPA uses `?day=0`, `?day=1` URL params to show specific days
- Child events may have their own planned plays, locations, and schedules
- Child event IDs are different from the parent ID

The `/children` endpoint returns `{ "list": [...Meetup[]] }` where each child is a full Meetup object with its own organizer, location, spots, etc.

### PlannedPlay `game` Field

The `game` field inside a PlannedPlay can be `null` (observed during build). This happens when a planned play is created without linking a specific game from Ludoya's database. Always null-check `pp.game` before accessing `pp.game.name`.

### DST / Timezone Shifts

Regular event times shift in UTC across DST boundaries. For example, Friday events at 16:00 Europe/Madrid:
- Winter (CET, UTC+1): `startsAt: "...T15:00:00Z"`
- Summer (CEST, UTC+2): `startsAt: "...T14:00:00Z"`

Event classification must always convert to local time using the `timeZone` field, never compare raw UTC hours.

### `/meetups/all` Endpoint

Accepts `groupId`, `onlyFuture`, `latitude`, `longitude`, `radius` as query params. Returns the same response structure as `/groups/{groupId}/meetups`. Only returns `PUBLIC` visibility events.

---

## Implementation Notes

### Fetch Flow for Events Page

```
1. GET /groups/slug/darkstonecat
   → Extract groupId

2. GET /groups/{groupId}/meetups?onlyFuture=true
   → Extract futureMeetups.elements (Meetup[])

3. For each meetup where plannedPlayCount > 0:
   GET /meetups/{meetupId}/planned-plays
   → Extract list (PlannedPlay[])
   (Run in parallel with Promise.all)
```

### Caching Strategy

- ISR with `revalidate: 3600` (1 hour) — events change infrequently but planned plays get added throughout the week.
- Group ID can be hardcoded or cached longer since it never changes.

### Image Domains

Add `img.ludoya.com` to `remotePatterns` in `next.config.ts` (same pattern as `cf.geekdo-images.com` for BGG).

### Rate Limiting

No documented rate limits. With ISR caching, requests are minimal:
- 1 request for meetups list
- N requests for planned plays (one per event with `plannedPlayCount > 0`)
- Typical load: ~3-5 requests per revalidation cycle

### Data Redundancy

The API returns heavily nested objects with repeated data. Each planned play includes the full meetup, group, and location objects. When processing, extract and deduplicate:
- Parse meetups from the `/meetups` endpoint
- Enrich each meetup with its planned plays from `/planned-plays`
- Discard the nested meetup/group/location duplicates inside each planned play

### Timezone Handling

All `startsAt`/`endsAt` values are in UTC (ISO 8601 with `Z` suffix). The `timeZone` field (`"Europe/Madrid"`) should be used for display formatting. Use `Intl.DateTimeFormat` or a library to convert.

### Recurrence Detection

Events with the same `recurrenceConfigId` are part of the same recurring series:
- `90ecc5adbcf74b429cdfe306ff7d3253` = "Divendres de jocs!" (Fridays)
- `d4cd20a973b54934a8c1577022e25d7a` = "Dissabtes de jocs!" (Saturdays)

This can be used to group/label recurring events in the UI.
