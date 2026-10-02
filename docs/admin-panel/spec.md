# Admin panel — functional specification

Status: **draft for discussion**. This document describes how the admin panel works: actors, membership lifecycle, use cases and views. It is not an implementation plan; table and column names are only there to make the behaviour unambiguous.

UI copy is in Catalan (the association's language) and is translated to `es` and `en` like the rest of the site.

## 1. Context

- Every member is equal: there are **no membership fees**, no member categories and no approval step. Signing up on the web makes you a member.
- Today the site knows two roles, `member` and `admin` (`members.role`). Any admin can change any column of any member, including `role`, through the `admins_update_all` RLS policy, and nobody records what admins do.
- Today "Dona't de baixa" deletes the account and, by cascade, every member row and badge. The association loses the record that the person was ever a member.

This specification changes three things:

1. **Leaving is a state, not a deletion.** A member who leaves keeps their row with a leaving date, and the board can reinstate them later at their request.
2. **Roles get a hierarchy** with a role that is the only one able to grant and revoke powers.
3. **Every admin action is recorded** in an audit log: who did what, to whom, when.

## 2. Glossary

| Term (ca) | Meaning |
|---|---|
| **Soci actiu** | Member with no *data de baixa*. |
| **Exsoci** | Member with a *data de baixa* (has left). |
| **Alta** | Joining: the first sign-up or a return. |
| **Baixa** | Leaving, by the member's choice or by the board. |
| **Reincorporació** | The board makes a former member active again. |
| **Primera alta** | Date of the first sign-up. Never changes. |
| **Alta actual** | Date of the latest *alta* (first sign-up or last return). |
| **Junta** | Board of the association. Role `board` in the panel. |
| **Superadmin** | Board member who can also grant and revoke roles. |
| **Registre d'activitat** | Audit log of admin actions and membership changes. |

## 3. Actors and roles

| Actor | Role | Description |
|---|---|---|
| Visitor | none | Not signed in. Can only use the public site and `/verify/<token>`. |
| Active member | `member` | Signed in, no *data de baixa*. |
| Former member | `member` | Membership closed. Cannot sign in: treated as a visitor (§4.4). |
| Board member | `board` | Manages members, badges, cards, exports and site operations. |
| Superadmin | `superadmin` | Everything `board` can do, plus granting and revoking `board` and `superadmin`. |

Roles are hierarchical: `superadmin` ⊃ `board` ⊃ `member`. A role is independent of the membership state, but a former member cannot hold `board` or `superadmin` (BR-12).

### 3.1 Permission matrix

| Capability | Member | Board | Superadmin |
|---|:-:|:-:|:-:|
| Own profile, card, data download, leave | ✅ | ✅ | ✅ |
| Rejoin after leaving | — ³ | ✅ | ✅ |
| Read the admin procedures (V-8) | — | ✅ | ✅ |
| Open the admin panel | — | ✅ | ✅ |
| List and search members, see member detail (masked DNI/phone) | — | ✅ | ✅ |
| Reveal a member's DNI/phone | — | ✅ | ✅ |
| Edit a member's data | — | ✅ | ✅ |
| Give a member *baixa* / reinstate a member | — | ✅ ¹ | ✅ |
| Award and revoke badges | — | ✅ | ✅ |
| Regenerate a member card | — | ✅ | ✅ |
| Export the member list (CSV) and one member's data | — | ✅ | ✅ |
| Read the audit log | — | ✅ | ✅ |
| Site operations (event images, cache refresh, game name overrides) | — | ✅ | ✅ |
| Grant / revoke `board` | — | — | ✅ |
| Grant / revoke `superadmin` | — | — | ✅ ² |
| Anonymise a former member (erasure request) | — | — | ✅ |

¹ Not on a member who holds `board` or `superadmin` (BR-12).
² Never below two superadmins (BR-10).
³ A former member asks the board, which reinstates them (BR-17).

## 4. Membership lifecycle

```
            sign-up                    baixa (self or board)
 (none) ──────────────▶  ACTIVE  ──────────────────────────▶  FORMER
                           ▲                                    │
                           └──────── reincorporació ────────────┘
                                     (board only, on request)
```

### 4.1 Membership state

The membership state is a **mark on the member's own row**. There is no separate table. The row gains:

| Field | Meaning |
|---|---|
| **Primera alta** | Date of the first sign-up. Never changes. Filled from the existing `membership_start_date`. |
| **Alta actual** | Start of the current or last membership. Equal to *primera alta* until the first return. |
| **Data de baixa** | Empty for an active member. Set on *baixa*, cleared on return. |
| **Baixa per** | `self` (the member left) or `board` (a board member gave it). |
| **Motiu de la baixa** | Free text. Mandatory when the board gives the *baixa*. |

**State** = active when *data de baixa* is empty, former otherwise.

Previous leave and return cycles are not stored on the row. Each one is an entry in the audit log (`membership.leave` / `membership.rejoin`, §5), and the member file shows them from there (V-3). Nothing is lost, and the member stays a single row.

The "Membre {year}" badge keeps using the **primera alta** (BR-6).

Why not move former members to a separate table: the member row is tied to the login account, and the member number, badges and audit entries all point to it. Moving the row means either deleting the login account or keeping two tables with the same columns. Deleting the account means reinstatement must create a new account and password. Two tables have to be kept in sync. Neither is simpler than a date column.

### 4.2 Leaving (*baixa*)

On *baixa*:

- **Contact and profile data are deleted at once:** phone, postal code, Ludoya and BGG usernames. The association no longer needs them (GDPR art. 5.1.e).
- **The member register is kept, blocked** (§4.5): member number, name, DNI if given, e-mail, *alta* and *baixa* dates, *baixa per*, *motiu* and badges.
- The login account is blocked, and every open session of that person ends (BR-18, §4.4).
- The member card stops being valid: `/verify/<token>` answers "Carnet no vàlid" (BR-4).
- Newsletter consent is switched off (BR-5).
- The member no longer counts as active in stats or in the default CSV export.

### 4.3 Returning (*reincorporació*)

Only the board can reinstate a former member (BR-17). The former member asks for it by contacting the association, and a board member follows the procedure P-1 (§8, V-8).

When a former member returns:

- *Alta actual* becomes today, and *data de baixa*, *baixa per* and *motiu* are cleared. The member number is the same one (BR-2).
- The login account is unblocked. The password is the one the member had before.
- A new card token is issued, so a card printed before the *baixa* stays invalid (BR-4).
- Newsletter stays off until the member switches it on again.
- Phone, postal code and gaming usernames are empty (they were deleted on *baixa*). The "Completa el perfil" checklist asks for them again.
- The member receives an e-mail: "Tornes a ser soci de Darkstone Catalunya".

Return is possible only while the register is blocked, so up to 3 years after the *baixa*. Once it has been purged (§4.5), the person signs up again as a new member, with a new member number.

### 4.4 A former member cannot sign in

A former member is a visitor again: they see the public site and nothing else.

**Mechanism.** On *baixa* the login account is **blocked with Supabase Auth's native ban**, and on return the ban is lifted. Auth itself refuses a banned account, with no check of ours, for:

- password login,
- magic-link, recovery and confirmation links,
- session refresh.

Source: `supabase/auth`, `ResourceOwnerPasswordGrant`, `verifyTokenHash` / `verifyUserAndToken` and `RefreshTokenGrant`.

Auth checks the ban **before** the password. A specific "this account is closed" message would therefore tell anyone who types a former member's e-mail that this person was a member. So the site never says that an account is closed (D-6, resolved).

| Entry point | Behaviour for a former member |
|---|---|
| Login, any password | The same generic error as a wrong password, with the help line below. |
| Magic link | Nothing arrives. The form gives the same neutral answer as always. |
| "He oblidat la contrasenya" | Nothing is sent. Auth would still send the recovery e-mail to a banned account (its link would then fail), so the site checks the state first, as it already does for the magic link. The answer is the same neutral one. |
| Sign-up with the same e-mail | The same "Revisa el teu correu" screen as always. No e-mail is sent. |
| A session open at the time of the *baixa* | It cannot be renewed. Protected pages also check the member state, so the person is sent to `/login` on their next request. |
| `/verify/<token>` with their card | "Carnet no vàlid". |

**Help line.** The generic login error always carries this line, for everyone, so it reveals nothing:

> Si no pots entrar o t'has donat de baixa, contacta amb la junta. **[Contacta amb la junta]**

The link opens `/contact` with the subject prefilled ("Vull tornar a ser soci"). It is the entry point of M-2.

Consequences:

- A former member who wants a copy of their data cannot download it themselves. They ask by e-mail, and the board follows P-3.
- There is no self-service return (D-1, resolved).

### 4.5 Data retention and erasure

The law sets no fixed period for former members' data. It sets a criterion:

- **No indefinite retention** (GDPR art. 5.1.e). Once the membership ends, the data that served it is no longer needed.
- **Blocking** (LOPDGDD art. 32). Data that may still be needed for liabilities arising from the processing is set aside, used for nothing else, and destroyed when those liabilities prescribe.
- Darkstone charges no fees and issues no tax certificates, so no tax obligation applies. The reference is the prescription of LOPDGDD infringements: 1, 2 or 3 years by severity.

**Chosen period: 3 years after the *baixa*** (D-2, resolved).

| When | What happens |
|---|---|
| Active member | All data is used normally. |
| *Baixa* | Contact and profile data are deleted (§4.2). The register is **blocked**: kept, but restricted (below). |
| Blocked, up to 3 years | The board sees only member number, name, e-mail, dates, *baixa per*, *motiu* and badges. The e-mail is visible because it is needed to identify the person on a request (P-1, P-3, P-4). The DNI is hidden from the board. A superadmin can reveal it only with a written reason, e.g. a request from an authority, and it is logged. The record is not exported in the CSV and is used for nothing else. The board can reinstate the person (A-7). |
| 3 years after the *baixa* | A daily job **purges** the record: it deletes the login account, e-mail, name, DNI, badges and *motiu*. What remains is an anonymous stub (member number, *alta* and *baixa* dates), so the number is never reused and the statistics stay right. → `member.purge` |

**Erasure requests** (GDPR art. 17) arrive by e-mail at `hola@darkstone.cat` and follow P-4:

- From an active member: the board gives the *baixa* first.
- From a former member: a superadmin runs "Anonimitza" (S-3). It deletes the login account, e-mail and badges at once. Name, DNI and dates stay blocked until the purge, because they are what may be needed for liabilities (LOPDGDD art. 32). The reply tells the person when they will be destroyed.

Self-service account deletion disappears. "Dona't de baixa" now marks the *baixa* (M-1).

**Before this ships (outside the panel):**

- **Privacy policy.** It must state the 3-year period, what is blocked and why. Today it only states a period for contact-form data.
- **Sign-up form.** Its information clause gets the same period.
- **Record of processing activities.** It records the member-management processing with this period.
- Optional: confirm the period in writing with the APDCAT (Autoritat Catalana de Protecció de Dades), which answers queries from Catalan associations.

## 5. Audit log (*registre d'activitat*)

### 5.1 What is recorded

Every **change made by a board member or superadmin** is recorded, plus every **membership lifecycle event** whatever its actor:

| Action key | Actor | Target |
|---|---|---|
| `member.update` | board | member (fields changed) |
| `member.reveal_sensitive` | board, or superadmin for a former member | member (which field: DNI or phone; reason for a former member) |
| `membership.leave` | member (self) or board | member (+ reason when board) |
| `membership.rejoin` | board | member (+ how the request arrived) |
| `badge.award` / `badge.revoke` | board | member + badge |
| `card.regenerate` | board | member |
| `export.members_csv` | board | filter used, row count |
| `export.member_data` | board | member |
| `role.grant` / `role.revoke` | superadmin | member + role |
| `member.anonymise` | superadmin | member |
| `member.purge` | system (retention job) | member number |
| `ops.cache_refresh` | board | jobs run, result |
| `ops.game_override.create` / `.update` / `.delete` | board | override |

Reading is recorded only when it exposes sensitive data: revealing DNI/phone and exports. Opening the list or a member detail is not recorded.

### 5.2 What an entry contains

- Date and time.
- Actor (user, and their role at that moment).
- Action key.
- Target (member and/or object).
- Details: for normal fields, the value before and after. For **encrypted fields (DNI, phone) only the field name**, never the value (BR-15).
- Reason, when the action requires one.

### 5.3 Rules

- Append-only: nobody can edit or delete an entry, including superadmins (BR-14). The only deletion is the retention rule below.
- Entries survive the anonymisation and the purge of their target. The target is then shown by member number only.
- Readable by every `board` and `superadmin` user (D-3, resolved).
- Retention: entries are deleted 3 years after they were written, by the same daily job as the purge. The log contains personal data too, and 3 years covers the same liabilities as the register (§4.5).

## 6. Business rules

| ID | Rule |
|---|---|
| BR-1 | A person has one member row for life. Leaving and returning change its dates, never create a new row or member number. |
| BR-2 | Member numbers are permanent: kept on return, never reused, kept after anonymisation. |
| BR-3 | Nobody can delete a member row by hand through the site. Personal data is removed on *baixa* (contact data), by anonymisation (S-3) and by the purge 3 years after the *baixa* (§4.5). |
| BR-4 | A card is valid only while the membership is active. Returning issues a new token. |
| BR-5 | Leaving switches newsletter consent off. |
| BR-6 | "Membre {year}" badge uses the *primera alta*. |
| BR-7 | Badges are kept while the register is blocked, and are there again on return. The purge deletes them. |
| BR-8 | A *baixa* given by the board requires a written reason, and the member is notified by e-mail with that reason. This follows LO 1/2002 art. 21: a member must be informed of the facts and given a reasoned decision before disciplinary measures. |
| BR-9 | Only a superadmin grants or revokes `board` and `superadmin`. |
| BR-10 | There are always at least two superadmins: the president and the board member who maintains the site. A superadmin cannot be revoked, leave or be anonymised if that would leave fewer than two. To step down, a superadmin first grants the role to a replacement. |
| BR-11 | Nobody can change their own role. |
| BR-12 | A member who holds `board` or `superadmin` must lose the role (by a superadmin) before the membership can be closed. A former member cannot be granted a role. |
| BR-13 | The board cannot change a member's e-mail (it is the login identity). Only the member can, from their profile. |
| BR-14 | The audit log is append-only. Only the retention job deletes entries, 3 years after they were written. |
| BR-15 | Decrypted DNI/phone values never appear in the audit log or in server logs. |
| BR-16 | Every permission is enforced by the server and the database, never only by hiding a button. |
| BR-17 | Only the board reinstates a former member, after a request from that person whose identity was confirmed through the account e-mail (procedure P-1). There is no self-service return. |
| BR-18 | A former member's login account is banned in Supabase Auth while former. They cannot sign in by any method, and no screen ever says that an account is closed (§4.4). |
| BR-19 | Sessions that Ludoya marks as members-only (`ONLY_GROUP`) are never shown on the site. Members see them in Ludoya itself. |
| BR-20 | On *baixa*, phone, postal code and gaming usernames are deleted. The rest of the register is blocked for 3 years and then purged (§4.5). |
| BR-21 | A blocked record is shown to the board only with its register fields. Its DNI can be revealed only by a superadmin with a written reason. It is never included in the CSV export. |

## 7. Use cases

Format: actor · trigger → main flow → result · audit entry.

### 7.1 Member

**M-1 · Leave the association** — active member · "Dona't de baixa" in `/profile/details`
1. A dialog explains what happens:
   - they will no longer be able to sign in;
   - the card stops working;
   - phone, postal code and gaming usernames are deleted;
   - the association keeps the member register (name, e-mail, DNI if given, dates) blocked for 3 years, and then destroys it;
   - to come back they will have to contact the board.

   It suggests downloading their data first, and links to the privacy policy for full erasure.
2. The member confirms.
3. *Data de baixa* = today, *baixa per* = `self`.
4. The session ends.

→ Home page as a visitor, with the notice "T'has donat de baixa. Gràcies per haver format part de Darkstone." · `membership.leave`
Alternative: a member with `board`/`superadmin` sees "Abans de donar-te de baixa, un superadmin t'ha de treure el rol de la junta." (BR-12)

**M-2 · Ask to return** — former member · "Contacta amb la junta" in the help line of the login error (§4.4), the contact page, or any other channel (e-mail, in person)
1. The contact form opens with the subject prefilled.
2. The member sends the request. Nothing changes in their account yet.

→ The board receives the request and handles it with A-7 (procedure P-1) · no audit entry until the board acts

**M-3 · Request full erasure** — former or active member · e-mail to `hola@darkstone.cat` → handled by a superadmin through S-3.

### 7.2 Board

**A-1 · See the dashboard** — `/admin`. Stats and recent activity (see V-1).

**A-2 · Find a member** — `/admin/members`. Search by name, member number or e-mail. Filter by state (active by default / former / all) and role. Sort and paginate.

**A-3 · See a member** — `/admin/members/<number>`. Data with masked DNI/phone, membership history, badges, card status and the activity related to that member.

**A-4 · Edit a member's data** — from A-3, active members only. Editable fields: first and last name, phone, DNI, postal code, Ludoya and BGG usernames. The same validation as the member's own profile edit applies. E-mail is not editable (BR-13), and neither are member number or membership dates. → `member.update`

**A-5 · Reveal DNI/phone** — from A-3. The eye button shows the full value on that screen only. For a former member, only a superadmin can reveal the DNI, and must write a reason (BR-21). → `member.reveal_sensitive`

**A-6 · Give a member *baixa*** — from A-3, active member without a board role.
1. A dialog asks for the reason (mandatory) and the date (default today, never in the future).
2. The board member confirms.
3. *Data de baixa* is set, *baixa per* = `board`, and the member receives an e-mail with the reason (BR-8).

→ `membership.leave`

**A-7 · Reinstate a former member** — from A-3 of a former member, after a request (M-2). Follows procedure P-1.
1. The "Reincorpora" dialog shows the checklist of P-1 and a link to it.
2. The board member fills in how the request arrived (mandatory: formulari, correu, en persona, altre) and an optional note.
3. If the last *baixa* was given by the board, the dialog shows its date and reason before confirming.
4. The board member confirms.
5. The member is active again (§4.3) and a new card token is issued.
6. The member receives the "Tornes a ser soci" e-mail.

→ `membership.rejoin`

**A-8 · Award or revoke a badge** — from A-3, active members only. Choose from the badge catalogue (today "Voluntari Egara Joga" and "Donant a la ludoteca"). → `badge.award` / `badge.revoke`

**A-9 · Regenerate a card** — from A-3. Use case: a lost or shared card. The old QR becomes invalid immediately. → `card.regenerate`

**A-10 · Export the member list** — from V-2.
1. The dialog warns that the file contains personal data.
2. Download the CSV.

The CSV holds active members only. Blocked records are never exported (BR-21). It gains two columns: *Primera alta* and *Alta actual*. → `export.members_csv`

**A-11 · Export one member's data** — from A-3, to answer an access request. Produces the same JSON the member can download themselves, with whatever data the association still holds. → `export.member_data`

**A-12 · Read the audit log** — `/admin/activity`. Filter by actor, action, target member and date range.

**A-13 · Generate event images** — the existing tool, moved under the panel (V-6).

**A-14 · Refresh caches** — V-6. Buttons "Actualitza Ludoya" / "Actualitza ludoteca (BGG)". They run the same jobs as the scheduled refresh and show the result. → `ops.cache_refresh`

**A-15 · Manage game name overrides** — V-6. A list of *Ludoya game name → BGG id*, used when the automatic match by name and year fails. It replaces the hard-coded `GAME_NAME_OVERRIDES`. → `ops.game_override.*`

### 7.3 Superadmin

**S-1 · Grant or revoke `board`** — `/admin/roles` or A-3. Only active members can be granted it. → `role.grant` / `role.revoke`

**S-2 · Grant or revoke `superadmin`** — same place. Revoking is blocked if it would leave fewer than two superadmins (BR-10), and for oneself (BR-11). → `role.grant` / `role.revoke`

**S-3 · Anonymise a former member** — A-3 of a former member, after an erasure request (P-4).
1. The dialog lists:
   - what is deleted now: login account, e-mail and badges;
   - what stays blocked until the purge date, which the dialog shows: name, DNI, dates.
2. The superadmin types the member number to confirm.
3. The data is deleted.

→ `member.anonymise`

## 8. Views

All admin views use the dark header pattern of the member area (eyebrow "ADMINISTRACIÓ", title, tabs), `noindex`, not in the sitemap. Tabs: **Resum · Socis · Activitat · Procediments · Eines**, plus **Rols** for superadmins.

### V-1 · Resum — `/admin`
- Stat cards:
  - Socis actius
  - Altes aquest mes
  - Baixes aquest mes
  - Reincorporacions aquest any
  - Butlletí (active members who accept it)
  - Membres de la junta
- "Activitat recent": last 10 audit entries with a link to V-4.
- Shortcuts: Socis, Exporta, Eines.

### V-2 · Socis — `/admin/members`
- Search box.
- Filters: state (Actius / Exsocis / Tots), role.
- Table columns:
  - Núm.
  - Nom i cognoms
  - Email
  - Estat (badge "Actiu" / "Baixa des de …"). Purged records are not listed.
  - Rol
  - Alta actual
- A row opens V-3.
- "Exporta CSV" button → A-10 dialog.
- Empty state: "Cap soci coincideix amb la cerca."
- Mobile: rows become cards.

### V-3 · Fitxa de soci — `/admin/members/<number>`
- Header:
  - Name, member number, state badge, role badge.
  - Actions menu: Edita, Dona de baixa / Reincorpora, Regenera carnet, Exporta dades.
  - Anonimitza (superadmin, former only).
- **Dades personals**:
  - Active member: name, e-mail (read-only), phone and DNI (masked, with the reveal button), postal code, Ludoya, BGG. Edit mode reuses the profile edit fields.
  - Former member (blocked): name and e-mail. The DNI is masked, and only a superadmin can reveal it, with a reason. A notice reads "Dades bloquejades fins al {data_purga}". There is no edit mode.
- **Pertinença**: primera alta, alta actual, data de baixa, baixa per, motiu, plus the earlier leave and return entries from the audit log.
- **Insígnies**: awarded badges with date and a revoke button; "Atorga insígnia" with the catalogue.
- **Carnet**: valid / not valid, plus the last regeneration date.
- **Rol** (superadmin only): role selector, with the BR-10/11/12 blocks explained inline.
- **Activitat**: audit entries whose target is this member.

### V-4 · Activitat — `/admin/activity`
- Filters: date range, actor, action type, member.
- Columns: date, actor, action (readable text, e.g. "Ha donat de baixa el soci 000-123"), details.
- Paginated. Read-only, with no actions at all.

### V-5 · Rols — `/admin/roles` (superadmin only)
- Two lists: Superadmins, Junta. Each person has a "Treu el rol" button (disabled with an explanation when BR-10/11 applies).
- "Afegeix a la junta": search among active members.

### V-6 · Eines — `/admin/tools`
- **Imatges d'esdeveniments**: link to the existing `/events/images` (which moves under `/admin`, with a permanent redirect).
- **Memòria cau**: the two refresh buttons with the last result and time.
- **Correspondències de jocs**: an editable table of *Nom a Ludoya → BGG id*, with a link that checks the id on BGG.

### V-7 · Member-side changes
- `/profile/details` › Compte: "Dona't de baixa" opens the M-1 dialog. The account is not deleted.
- `/login`: the generic error always carries the help line with "Contacta amb la junta" (§4.4).
- Magic link, password reset and sign-up send nothing to a former member, and give the same neutral answer as always (§4.4).
- `/contact`: accepts a prefilled subject, used by the "Contacta amb la junta" button.
- `/verify/<token>`: a former member's card answers "Carnet no vàlid". The answer never says why.
- Navbar: the "Administració" link is shown to `board` and `superadmin`.

### V-8 · Procediments — `/admin/procedures`
Step-by-step guides for the requests that reach the board outside the site. Every board member can read them.
- An index lists the procedures. Each one opens as its own section.
- Each action dialog links to its procedure: A-6 → P-2, A-7 → P-1, A-9 → P-5, A-11 → P-3, S-3 → P-4.
- The text lives in the translation files, versioned with the code that runs each action. It is not editable from the panel: it changes rarely, and it must match what the buttons actually do.

**P-1 · Reincorporació d'un exsoci**
1. Find the person in Socis with the filter "Exsocis" (name, member number or e-mail). If they are not there, their record was purged (more than 3 years since the *baixa*): tell them to sign up again as a new member.
2. Confirm identity. The request must come from the e-mail of the account. If it came from another address or in person, write to the account e-mail and wait for the answer.
3. Read the last *baixa* in the member's file. If the board gave it (A-6), discuss the request with the board before accepting it.
4. Look for duplicates. If the person signed up again with another account, ask which one to keep. Then give the other one *baixa* with the reason "Compte duplicat".
5. Click "Reincorpora" and record how the request arrived.
6. The member receives the e-mail automatically. Reply to the request too: the old card no longer works, the new one is in "Carnet", and the newsletter is off until they switch it on.

**P-2 · Baixa d'un soci per decisió de la junta**
1. Check that the decision follows the statutes and has been agreed by the board.
2. Before deciding, inform the member of the facts and give them the chance to explain themselves (LO 1/2002 art. 21).
3. If the member holds a board role, a superadmin removes it first (BR-12).
4. Click "Dona de baixa" with a reason the member can read. They receive it by e-mail.

**P-3 · Sol·licitud d'accés a les dades**
1. Confirm identity through the account e-mail.
2. Click "Exporta dades" in the member's file.
3. Send the file to the account e-mail within one month of the request (GDPR art. 12.3).

**P-4 · Sol·licitud de supressió de dades**
1. Confirm identity through the account e-mail.
2. If the person is still an active member, give the *baixa* first, with the reason "Sol·licitud de supressió".
3. Ask a superadmin to run "Anonimitza" (S-3).
4. Reply within one month. Explain that name, DNI and dates stay blocked until the purge date because of possible liabilities (LOPDGDD art. 32), and give that date.

**P-5 · Carnet perdut o compartit**
1. Click "Regenera carnet". The old QR stops working at once.
2. Tell the member to download the new card from "Carnet".

## 9. Decisions

| ID | Question | Answer |
|---|---|---|
| D-1 | Can a former member return by themselves, or only through the board? | **Resolved:** only through the board, on request (BR-17, P-1). |
| D-2 | How long are former members' data and the audit log kept? | **Resolved:** contact data is deleted on *baixa*. The register stays blocked for 3 years and is then purged, and audit entries are kept 3 years (§4.5, §5.3). Optional written confirmation from the APDCAT. |
| D-3 | Who can read the audit log? | **Resolved:** every `board` and `superadmin` user. |
| D-4 | How many superadmins? | **Resolved:** at least two, the president and the board member who maintains the site (BR-10). |
| D-5 | Should members-only Ludoya sessions (`ONLY_GROUP`) be shown to active members? | **Resolved:** no. Members see them inside Ludoya (BR-19). |
| D-6 | What does a former member see when signing in? | **Resolved:** the generic login error with the help line (§4.4). Supabase checks the ban before the password, so a specific message would reveal who was a member. |

## 10. Out of scope

- Membership fees, payments, SEPA collections and renewal reminders (no fees).
- A member approval step (every member is equal).
- Sending newsletters from the panel (the export is enough for now).
- Member directory, QR check-in at events, game lending, advanced statistics. These are possible future ideas.
- Implementation plan, data migrations and tests: to be written once this specification is agreed.
