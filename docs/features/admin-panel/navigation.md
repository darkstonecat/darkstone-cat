# Admin panel — interface and navigation

Status: **approved, not implemented yet** (2026-11-12). Implementation plan: `odd/tasks/admin-navigation.md`. When it ships, this document describes the delivered behaviour, and the status line changes.

This document covers the panel's frame: header, sections, how a board member moves between them, and how to add a new section. What each view does is in [`spec.md`](spec.md) §8. The approved mockup is proposal **A** of the design canvas (grouped sidebar plus a section switcher on phones).

## 1. Why it changed

Until now the panel showed 8 pill tabs in one flat row (`AdminTabs`). Every pill looked equally important. On a phone they sat in a 3- or 4-column grid of about 83 px each, so "Procediments" (and in Spanish "Procedimientos" and "Herramientas") overflowed their pills. The tabs also had no room for a ninth section, and the header plus pills took about 420 px before any content.

## 2. Sections and groups

The sections are grouped by what the board uses them for. The order is fixed: first the groups, top to bottom, then the help link.

| Group | Section | Path | Who | Icon (`react-icons/md`) |
|---|---|---|---|---|
| (none, first) | Resum | `/admin` | board | `MdSpaceDashboard` |
| Junta | Socis | `/admin/members` | board | `MdGroup` |
| Junta | Activitat | `/admin/activity` | board | `MdHistory` |
| Junta | Rols | `/admin/roles` | superadmin only, with a "Super" chip | `MdAdminPanelSettings` |
| Contingut del web | Insígnies | `/admin/badges` | board | `MdMilitaryTech` |
| Contingut del web | Beneficis | `/admin/benefits` | board | `MdCardGiftcard` |
| Manteniment | Eines | `/admin/tools` | board | `MdBuild` |
| (help, last) | Procediments | `/admin/procedures` | board | `MdMenuBook` |

- A board member never sees Rols. A group left with no visible section is not shown.
- Group names: `ca` Junta / Contingut del web / Manteniment, `es` Junta / Contenido de la web / Mantenimiento, `en` Board / Website content / Maintenance.
- **Active section**: the section whose path is the longest prefix of the current path, so nested pages belong to their section (`/admin/members/000-012` → Socis, `/admin/badges/<key>` → Insígnies, `/admin/tools/event-images` → Eines). `/admin` itself matches only Resum. The active link carries `aria-current="page"`.

## 3. Header

One compact dark header on every admin page, below the site NavBar:

- Eyebrow "ADMINISTRACIÓ".
- `h1` with the active section's name (Resum on an unknown path).
- The signed-in line: name and role ("Junta" or "Superadmin"). On a phone the role goes into the eyebrow line and the name is left out, to save height.
- No tabs: navigation moves to the sidebar (desktop) or the section switcher (phone).

## 4. Desktop, from `lg` (1024 px)

- Two columns under the header: a white sidebar about 224 px wide on the left, the page content on the right.
- The sidebar is a `<nav aria-label="Administració">` with the groups of §2: a small uppercase group label, then one link per section (icon and name, at least 40 px tall). The active link is dark (stone background, white text).
- Procediments sits at the bottom of the sidebar, under a thin divider.
- The sidebar sticks under the NavBar while the content scrolls (assumption: confirm during implementation that it fits with Lenis and the fixed NavBar).
- Page containers keep their own `max-w-[1120px]` and padding; the shell only places them in the right column.

## 5. Phone and tablet, below `lg`

- The header holds one full-width button: the active section's icon and name, the word "Canvia" and a chevron. It has `aria-haspopup="dialog"` and `aria-expanded`.
- The button opens a bottom sheet (`role="dialog"`, `aria-modal`, title "Administració") with the same groups and links as the sidebar, links at least 48 px tall, the active one dark, and a close button.
- The sheet is built on `useModalDialog` (page inert, Lenis stopped, focus trap, Escape closes, focus returns to the button), like `AdminDialog`, and renders in a portal to `body`.
- Choosing a link closes the sheet and navigates. A change of path closes it too.
- No section is hidden behind "more": every visible section is one tap away from the sheet.

## 6. Code map

| File | Role |
|---|---|
| `src/app/[locale]/admin/layout.tsx` | Guard (`requireRole("board")`), NavBar, `AdminHeader`, the two-column shell, Footer |
| `src/components/admin/nav/adminNav.ts` | Pure: the sections, groups, icons and `superadminOnly` flags; `visibleAdminNav(isSuperadmin)` and `activeAdminSection(pathname)` |
| `src/components/admin/nav/AdminSidebar.tsx` | Desktop sidebar (`hidden lg:block`) |
| `src/components/admin/nav/AdminSectionSwitcher.tsx` | Phone button and bottom sheet (`lg:hidden`) |
| `src/components/admin/AdminHeader.tsx` | Compact header: eyebrow, title, signed-in line, the switcher on phones |
| `src/messages/{ca,es,en}.json` | `admin.tab_*` (section names, kept from the tabs), `admin.nav_*` (group names, switcher, close, chip) |

`AdminTabs.tsx` is removed. Only one admin navigation landmark is visible at a time: the sidebar on desktop, the sheet's list on a phone when it is open.

## 7. Adding a section

1. Add the page under `src/app/[locale]/admin/<section>/` (it inherits the guard and the shell from the layout).
2. Add one entry to `adminNav.ts`: key, path, group, icon, and `superadminOnly` if it applies. Put it in the group that matches what the board uses it for; add a new group only when none fits.
3. Add `admin.tab_<key>` in `ca`, `es` and `en`, plus `metadata.admin_<key>_{title,description}` and `nav.admin_<key>`.
4. Update the unit tests of `adminNav.ts` (order and grouping) and the E2E shell test.
5. Update §2 of this document and the Pages table of `CLAUDE.md`.

## 8. Tests

- Unit (`tests/components/admin-nav/`): grouping and order, Rols only for superadmins, empty groups hidden, active section on nested paths and on `/admin`.
- Components: sidebar links, `aria-current`, the "Super" chip; switcher opens and closes (button, Escape, link, path change) and returns focus.
- E2E (`e2e/admin/shell.spec.ts`): desktop sidebar order for board and superadmin; on a phone viewport the switcher opens the sheet and navigates; no horizontal overflow at 360 px in `ca` and `es`.
