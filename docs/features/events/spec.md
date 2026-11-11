# Events page (`/events`) — specification and implementation

`/events` is the association's only public agenda. It shows the upcoming sessions and special events from Ludoya: big game covers, a visual seat counter on each play, a month calendar, and one banner per special event. The member home (`/profile`) no longer has its own sessions list or calendar. Everything below is implemented on `feat/events-redesign` (November 2026).

| | |
|---|---|
| Route | `src/app/[locale]/events/page.tsx` (`revalidate = 60`, indexable, in the sitemap) |
| Data | Ludoya public API, one request cached 60 s (`fetchMemberAreaSessions`) |
| Calendar API | `GET /api/events/calendar?month=YYYY-MM&locale=` (public) |
| Code | `src/lib/events/`, `src/components/events/` |
| Messages | `events.*` in `src/messages/{ca,es,en}.json` |
| Tests | `tests/lib/events-*.test.ts`, `tests/unit/events-calendar-view.test.ts`, `tests/components/events/`, `tests/components/EventsCalendar.test.tsx`, `tests/server/api/events-calendar.test.ts`, `e2e/pages/events.spec.ts` |
| Design source | `odd/tasks/events-redesign-mockup/` (`desktop.dc.html`, `mobile.dc.html`, `seats.dc.html`) |
| Task log | `odd/tasks/events-redesign.md` (specs S1-S14 with the user's own words, task log L1-L23) |

## 1. What a visitor sees

### Desktop (≥ 1024 px)

1. **Header** (dark): h1 "Esdeveniments", one line of intro, chips with the session hours, the venue (Google Maps link) and "Gratuït · no cal ser soci".
2. **Special banners**: one compact banner per upcoming special event, at most 3, soonest first. Each shows a small image, "Esdeveniment especial", the title, dates and place, and only the days left ("Falten N dies"). A click opens that special's card and scrolls to it.
3. **Two columns**:
   - left, sticky: the **month calendar** and the "Com funciona" card;
   - right: the **timeline**, grouped by week.
4. "Veure més dates a Ludoya ↗" closes the timeline.

### Mobile

Header → banners → **"Properes dates" day strip** (with the "Veure el mes" toggle) → timeline → "Com funciona". The sidebar calendar is hidden; the strip's month grid replaces it.

There is no section link bar ("Aquesta setmana / Properes setmanes / Especials"): the user removed it because the page reads at a glance.

## 2. Rules

### What is listed

| Rule | Value |
|---|---|
| Visibility | `PUBLIC` sessions and `PUBLIC` plays only. Drafts, cancelled, `ONLY_GROUP`, friends-only and private events never appear. |
| Regular vs special | A session is **regular** when it matches a usual slot exactly in Madrid time: Friday 16:00–20:30 or Saturday 10:00–13:30. Anything else is **special**. |
| Range | This Madrid week (Monday to Sunday) plus the 3 following weeks (`AGENDA_WEEKS = 4`), plus every special starting in the next 12 months, each in its own week group. |
| Running events | A multi-day special that already started stays (in this week's group) until it ends. Ended events are dropped. |
| Banners | Upcoming specials, soonest first, at most 3 (`MAX_BANNERS`). No special, no banner. |

### Cards

| Rule | Value |
|---|---|
| Format | Every event, session or special, is a collapsible card (`aria-expanded`, `aria-controls`). |
| Default state | This week's events open; later sessions closed; specials always open. |
| Toggle all | Each later week has "Desplega-ho tot / Plega-ho tot". |
| Closed card | Title, date and time, play count, free seats, a stack of small covers. |
| Open session | Grid of play cards (2 columns on mobile) plus a "Proposa una partida" card linking to Ludoya ("Sigues el primer!" when there are no plays). |
| Place | Shown only when it is **not** the usual venue: name, "fora del local habitual", "Com arribar-hi ↗" (Google Maps). The usual venue appears only in the header. |
| Countdown | Specials only, on the banner and the card: "Falten N dies", "Demà", "Avui", "En curs". Never on sessions or in the day strip. |

### Seat counter (play cards)

A light pill at the top of the 3:4 cover, always on one line, with `X/N` on the right.

| Capacity | Drawing |
|---|---|
| ≤ 8 | Chairs: dark = taken, grey outline = free, orange outline = still needed to reach `minParticipants`. At most 6 chairs on desktop and 5 on mobile; beyond that, the first MAX-1 chairs (taken, then needed, then free) and "…". |
| 9–20 | Segmented bar, one segment per seat. |
| > 20 | Continuous bar. |
| No capacity | People icon and "N apuntats". |

There is no status text under the cover (the pill already shows the seats); a full play only changes the button to "A la cua". The pill is `role="img"` with a label such as "3 de 4 places ocupades, en falta 1 per començar". Edge cases: a capacity ≤ 0 counts as no limit, needed seats never exceed free seats, an over-booked play is full.

### Calendar

| Rule | Value |
|---|---|
| Range | Current month up to 6 months ahead; the previous arrow is disabled on the current month. |
| Cells | Session days dark, special days orange, today ringed, past days faded. A special spanning several days is marked on its start day. |
| Click | A day whose event is in the timeline opens that card and scrolls to it (the URL hash becomes `#event-<id>`). Any other day with an event opens Ludoya in a new tab. A day with a session and a special opens the special. |
| Month change | Loads the month from `/api/events/calendar`; the timeline and the scroll position do not move. On failure the grid stays and offers Ludoya. |

### Mobile day strip

| Rule | Value |
|---|---|
| Content | Upcoming days with events from the timeline, grouped by week. This week dark, later weeks white, specials orange with ★. A multi-day special appears on each remaining day. |
| Gesture | Swipes with the finger, snaps per day, no visible scrollbar, a right-edge fade with "›" while more days follow (hidden at the end), up to 5 position dots. |
| Week labels | "Aquesta setmana" or "16–22 de nov." above the first day of each week, truncated with an ellipsis rather than overlapping the next week. |
| Tap | Opens and scrolls to the day's card. |
| "Veure el mes ▾ / Amaga el mes ▴" | Shows the month grid (44 px days, "Toca un dia per anar-hi."), closed by default. |

### Links to a card

Any link to `#event-<id>` on the page (banner, calendar day, strip day) or a shared URL such as `/events#event-<id>` opens that card and scrolls to it. `EventsTimeline` handles them with one document-wide click handler and on load.

## 3. Data flow

```
Ludoya  GET /events?includeSubEvents=true&pastLimit=200  +  GET /locations
   │    (one request, fetch cache 60 s, tag "ludoya"; /api/cron/refresh warms it)
   ▼
fetchMemberAreaSessions()          src/lib/member-sessions.ts
   │
   ├─► selectAgendaSessions()      agenda-view.ts   PUBLIC, range, running specials
   │   withCovers(…, ∞)            member-sessions.ts   BGG covers within 2.5 s, else Ludoya's
   │   toAgenda()                  agenda-view.ts   weeks, specials, countdown, place rule
   │   formatAgenda(…, locale, now) agenda-format.ts   every date text + strip days (server)
   │        ▼
   │   EventsHeader · EventsTimeline · EventCard · PlayCard · SeatPill · EventsDayStrip
   │
   └─► toEventsCalendar()          calendar-view.ts + month-grid.ts
            ▼
       EventsCalendar (first month with the page, the others via /api/events/calendar)
```

- **Dates are formatted on the server only.** Node and browser ICU differ (apostrophes, abbreviations), which would break hydration; client components only print strings.
- **"Now"** comes from `agendaNow()` (`src/lib/events/clock.ts`): the real time, or `LUDOYA_MOCK_NOW` when `LUDOYA_MOCK=1` (tests only).
- **Failure**: if Ludoya fails with a cold cache, the page shows `EventsStatus` (error, with a Ludoya link); an empty agenda shows the empty state. A warm cache keeps serving the last good data.
- The admin event image tool keeps its own path (`fetchUpcomingEvents`, 24 h cache) and is untouched.

## 4. Privacy

- Only the fields of the view model leave the server: no organizer names, no `visibility` field, no `ONLY_GROUP` play. Unit tests check the serialised JSON; the E2E checks the HTML.
- The calendar route is public by design: it returns the same titles, ids and Ludoya links the page already shows.

## 5. `GET /api/events/calendar`

| Case | Answer |
|---|---|
| `month` malformed or outside current..+6 | `400 {"error":"invalid_month"}`, `Cache-Control: no-store`, Ludoya not called |
| Valid month | `200` `EventsCalendarMonth` (`monthKey`, `title`, `prev`, `next`, `weekdays`, `weeks[][]` of days with `kind`, `label`, `titles`, `eventId`, `ludoyaUrl`), `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300` |
| Ludoya failed | `200` with the empty grid and `error: "api_error" \| "timeout"`, `no-store` |
| `locale` unknown | Catalan |

## 6. Code map

| File | Role |
|---|---|
| `src/lib/events/agenda-view.ts` | Pure: selection, weeks, countdown, place rule, view model, summaries |
| `src/lib/events/agenda-format.ts` | Pure: date texts and strip days, formatted on the server |
| `src/lib/events/agenda.ts` | Server: `fetchEventsAgenda(now)` |
| `src/lib/events/seat-counter.ts` | Pure: seat pill mode, chairs, status, label |
| `src/lib/events/month-grid.ts` | Pure: Monday-first month grid, range, labels |
| `src/lib/events/calendar-view.ts` | Pure: one calendar month for `/events` |
| `src/lib/events/calendar.ts` | Server: `fetchEventsCalendar(month, locale, now)` |
| `src/lib/events/links.ts` | Anchors, Ludoya agenda URL, directions link, countdown text |
| `src/lib/events/clock.ts` | `agendaNow()` |
| `src/components/events/EventsHeader.tsx` | Header chips and special banners |
| `src/components/events/EventsTimeline.tsx` | Week groups, open state, toggle all, `#event-` handling and scroll |
| `src/components/events/EventCard.tsx` | Session and special cards |
| `src/components/events/PlayCard.tsx`, `SeatPill.tsx` | Play cover and seat counter |
| `src/components/events/EventsCalendar.tsx` | Month grid, `sidebar` and `inline` variants |
| `src/components/events/EventsDayStrip.tsx` | Mobile strip and month toggle |
| `src/components/events/HowItWorks.tsx`, `EventsStatus.tsx` | "Com funciona" card, error and empty states |
| `src/app/api/events/calendar/route.ts` | Calendar month route |

Messages: `events.*` (header, banners, timeline, cards), `events.seats`, `events.play`, `events.calendar`, `events.strip`.

## 7. Testing

- **Unit and component (Vitest)**: selection and view model, date formatting and strip, seat counter (every case of `seats.dc.html`), calendar view and route, calendar and strip components, timeline defaults, header, the `agendaNow()` override, and `SmoothScroll` (programmatic scroll).
- **E2E (Playwright, `e2e/pages/events.spec.ts`)**: the server uses the Ludoya fixtures (`LUDOYA_MOCK=1`) with `LUDOYA_MOCK_NOW=2026-10-01T10:00:00Z`. `page.clock` cannot move a server-rendered date, hence the env override. With that "now":
  - this week: Friday 2 and Saturday 3 October (open);
  - next week: Friday 9 (closed) and the special "Juguem a El Cartón Peleón!" on Sunday 11, away from the usual venue (open, "Falten 10 dies");
  - "Egara Juga 2026", 28–29 November (special);
  - drafts on 10 October and 8 November are never shown; Friday 25 December is outside the four weeks, so its calendar day opens Ludoya.
- Run: `npm run test:unit`, `npx playwright test e2e/pages/events.spec.ts`.

## 8. Quality at delivery (11 November 2026)

| Check | Result |
|---|---|
| Unit | 148 files, 2038 tests |
| E2E | full suite green (261 + the fixed benefits test); events spec 29/29 with `--repeat-each=3` |
| Lighthouse `/events`, desktop | performance 99, accessibility 100, best practices 96, SEO 92, CLS 0 |
| Lighthouse `/events`, mobile | performance 84–95 across 4 runs (LCP 3.0–4.3 s), accessibility 100, best practices 96, SEO 92, CLS 0 |

Notes on the remaining points, all from a local production build with live data: the mobile LCP element is the header intro paragraph (time to first byte about 0.3 s plus about 1.1 s of render delay from render-blocking CSS); best practices loses points to the Vercel Analytics scripts, which answer 404 locally; SEO flags the canonical because it points to `www.darkstone.cat` while the audit runs on localhost.

## 9. Differences from the mockup

| Mockup | Delivered | Why |
|---|---|---|
| Banners "newest first" | Soonest first | Read as the nearest event being the most relevant. |
| Mobile banner label "★ ESPECIAL" | Same below 640 px; "Esdeveniment especial" above | Keeps the mobile banner at 96–107 px (107 with a two-line title). |
| Strip tile texts at 85 % opacity | Full colour | Failed WCAG contrast on orange tiles. |
| Muted calendar days `#A8A29E` | `stone-500` | Same contrast reason. |
| "Com arribar-hi" underlined on hover | Always underlined | Links must not rely on colour alone. |
| Week label overflowing freely above the strip | Week groups with a truncated label | A long label ("30 de nov. – 6 de des.") would overlap the next week's. |

## 10. Out of scope and follow-ups

- **"Afegeix al calendari" (`.ics`)**: deferred by the user.
- **Members-only sessions (`ONLY_GROUP`)** stay hidden everywhere until a board-approved member state exists (`docs/features/admin-panel/spec.md`, BR-19).
- **Mobile LCP**: bound by the framework's render-blocking CSS, not by this page's code.

## 11. Delivery

Branch `feat/events-redesign` (from `develop`, not pushed at the time of writing), one work-unit commit per task:

| Commit | Change |
|---|---|
| `c07dd24` | Agenda data layer |
| `c2f4e1d` | Seat pill and play card |
| `ef7f244` | Page rebuilt as one agenda (header, banners, timeline, cards) |
| `9463146` | Calendar sidebar and `/api/events/calendar` |
| `47e9d7b` | Fix: programmatic Lenis scrolls never animated (banner and calendar links did not scroll) |
| `7eb3f73` | Mobile day strip and month toggle |
| `c501ce0` | Profile sessions and calendar removed |
| `05bb97b` | Benefits E2E updated for the new profile home |
| `f5fed04` | Contrast and link underline fixes |
| `9ee666e` | E2E spec, `agendaNow()`, CLAUDE.md and README |

No database migration and no production configuration step. The page reads the same `LUDOYA_API_KEY` as before.
