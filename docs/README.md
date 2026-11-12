# Darkstone Catalunya — Documentation

Index of the project docs. Start here, then open the folder for the topic. Setup and commands live in the root `README.md`; the working rules for agents live in `CLAUDE.md`.

## Folders

| Folder | What goes there |
|---|---|
| `features/` | One folder per part of the site: its specification and what was delivered |
| `integrations/` | External APIs we call: how we use them, limits, known quirks, links to the vendor docs |
| `operations/` | Runbooks: steps someone follows to launch, deploy or recover something |
| `_local/` | Gitignored. Drafts, private notes and third-party copies that must not be committed |

The repository is public: never put secrets, real member data or copies of third-party docs outside `_local/`. Link to the vendor's own docs instead.

## Documents

### Features

| Document | Summary |
|---|---|
| [`features/admin-panel/spec.md`](features/admin-panel/spec.md) | Admin panel: actors, membership lifecycle, business rules (BR-*), use cases and views |
| [`features/admin-panel/navigation.md`](features/admin-panel/navigation.md) | Admin panel frame: header, grouped sections, desktop sidebar, phone section switcher, how to add a section |
| [`features/events/spec.md`](features/events/spec.md) | Public agenda `/events`: listing rules, cards, seat counter, calendar, data flow and privacy |

### Integrations

| Document | Summary |
|---|---|
| [`integrations/ludoya-api.md`](integrations/ludoya-api.md) | Ludoya public v1 API: endpoints we use, caching, mock mode, troubleshooting. Vendor spec: [OpenAPI](https://api.ludoya.com/public/v1/openapi.json) |
| [`integrations/bgg-api.md`](integrations/bgg-api.md) | BoardGameGeek XML API2: the collection and thing calls, what we use and what we leave out. Vendor docs: [BGG_XML_API2](https://boardgamegeek.com/wiki/page/BGG_XML_API2) |

### Operations

| Document | Summary |
|---|---|
| [`operations/member-area-launch.md`](operations/member-area-launch.md) | Publishing the member area: the `NEXT_PUBLIC_MEMBER_AREA_PUBLIC` flag, checklist and rollback |

## Adding a document

1. Put it in the folder that matches its purpose (a new feature gets its own `features/<name>/` folder).
2. Add a row to the table above.
3. Link it from `CLAUDE.md` or the root `README.md` only where it helps someone find it.
