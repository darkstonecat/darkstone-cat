# Member benefits managed by the board

Objective: a board-managed list of member benefits (first one: Outlet Games, code `DARKSTONE`), shown only to signed-in active members in their profile, and Trollcave removed from the site.
Branch: `feat/member-benefits` (from `develop`). Delivery: `ask-on-risk`, `feature-branch-chain` (same as the badge catalogue): one work-unit commit per task on this branch, merged into `develop` when done. Test runner: Vitest (`npm run test:unit`, `npm run test:integration` with local Supabase), Playwright for UI.

## Specs

- **S1 Remove Trollcave.** User: "\"Troll Cave\" se debe eliminar." Remove it from the collaborators (home and `/about`), its descriptions in ca/es/en and its logo. The Ludoya mock location "Troll Cave Terrassa" stays (it mirrors real Ludoya data).
- **S2 Discount point on `/about`.** User: "Se puede reaprovechar para decir que tenemos un descuento con la tienda OUTLET GAMES, sin determinar el porcentage, solo mencionandolo" and "Outlet games no es una tienda fisica, por lo que no es enseñando el carnet, es con un código descuento que deberiamos poner en el perfil y solo lo damos allí." `why_join_point_3` mentions a discount at Outlet Games with a members-only code found in the member area; 3% (confirmed by the user, L9), no code, no "show the card".
- **S3 Benefits table.** User: "Editable desde una vista de admin en la DB, posible tabla beneficios por ser socio, por ahora solo este con el código DARKSTONE." Table `public.member_benefits`: `id` (uuid), `name` and `description` (`{ca, es?, en?}`, `ca` required, others fall back to `ca`), `discount_code` (optional), `url` (shop link, `https://`), `collaborator_id` (logo, see S5), `sort_order`, `archived_at`/`archived_by`, `created_by`, `created_at`, `updated_at`. Seeded with Outlet Games, code `DARKSTONE`, `https://outletgames.es`. Only ACTIVE members read non-archived rows; API roles cannot write it.
- **S4 Board functions.** SECURITY DEFINER `admin_*` functions with the session client, one audit entry per change (`benefit.create`, `benefit.update`, `benefit.archive`, `benefit.restore`, details hold the Catalan name): list, create, update, archive, restore. Assumption: no hard delete (archive is enough for one or two rows).
- **S5 Image.** User chose "Pick a collaborator logo": the board picks one of the collaborators of `src/data/collaborators.ts`; the benefit shows its logo. An unknown id shows no image.
- **S6 Profile card.** User (L10): "La tarjeta deberia estar en la vista \"profile\" directamente, es decir la primera del perfil, no en el detalle." Earlier: "En el perfil podria haber una tarjeta nueva de Benificios por ser socios con estas entradas, ahora con la de outlet games, código descuento, link a la tienda, imagen de esta." A card "Beneficis per ser soci", in `/profile` right above "Properes sessions" (L11; not `/profile/details`), lists each benefit: logo, name, description, discount code (copyable), link to the shop. Rendered on the server; the code never appears in `src/messages`, public pages or the client bundle. No benefits → no card.
- **S7 Admin view.** A tab "Beneficis" (`/admin/benefits`, board) with the list (active and archived), create, edit (language tabs ca/es/en, code, URL, logo picker, order) and archive/restore in `AdminDialog`. Activity log renders `benefit.*`. All copy in ca/es/en; `noindex`, not in the sitemap.

## Tasks

| ID | Specs | Route | Status | Commit |
|---|---|---|---|---|
| T1 | S1, S2 | inline | done (tsc, lint, 1951 unit tests) | 3882def |
| T2 | S3, S4 | inline (Risk: item 2, RLS and grants) | done (12 integration tests; RLS mutation check fails without `has_role`; integration suite 562) | 90d5b77 |
| T3 | S2, S5, S6 | inline | done (RED then GREEN on `toBenefitViews`; card tests; unit 1962) | 3996864 |
| T4 | S4, S5, S7 | inline | done (parsers, actions, page, list/dialog tests; unit 2004) | be9ed45 |
| T5 | all | inline (docs CLAUDE.md, README, E2E) | done (E2E admin flow + profile card + code absent from public pages) | see Log |

## Log

- L1 (2026-11-11, user): "En la vista home en la sección collaboratos o desde la vista about se debe eleiminar una de las tiendas. \"Troll Cave\" se debe eliminar. Analiza como funciona y como limpiarlo limpiamente"
- L2 (2026-11-11, user): "Se puede reaprovechar para decir que tenemos un descuento con la tienda OUTLET GAMES, sin determinar el porcentage, solo mencionandolo"
- L3 (2026-11-11, user): "Outlet games no es una tienda fisica, por lo que no es enseñando el carnet, es con un código descuento que deberiamos poner en el perfil y solo lo damos allí."
- L4 (2026-11-11, user, code source): "Editable desde una vista de admin en la DB, posible tabla beneficios por ser socio, por ahora solo este con el código DARKSTONE. En el perfil podria haber una tarjeta nueva de Benificios por ser socios con estas entradas, ahora con la de outlet games, código descuento, link a la tienda, imagen de esta."
- L5 (2026-11-11, user, image): "Pick a collaborator logo (Recommended)".
- L6: production runs without `NEXT_PUBLIC_MEMBER_AREA_PUBLIC`, so most members cannot reach the profile yet; the migration needs the user's go-ahead before production.
- L7 (2026-11-11): T1-T5 implemented inline (no writer reason). Assumption kept: no hard delete (archive only). Migration applied to the LOCAL Supabase only; production still pending the user's go-ahead. RDD is off (global), so no native review; one independent verifier runs at the end for Risk item 2.
- L8 (2026-11-11): independent verifier (Risk item 2): no blockers; S3, S4, S6, S7 pass (RLS probes as anon, user without member row and former member all denied or empty; helpers not executable by API roles; audit details never hold the code). Advisories only: phone-shaped names refused by the audit detector (benefit_text_sensitive); production migration pending.
- L9 (2026-11-11, user): "Tengo confirmación del descuento de OUTLETGAMES, es de un 3%". S2 and the seeded description now say 3% (migration edited: not yet applied to production; local row updated by hand).
- L10 (2026-11-11, user): "La tarjeta deberia estar en la vista \"profile\" directamente, es decir la primera del perfil, no en el detalle. Igualmente desde una ejecución \"npm run dev\" no me aparece y la nueva pestaña \"Beneficis\" muestra: \"No s'han pogut carregar els beneficis. Recarrega la pàgina.\"" Card moved to `/profile` (first card), texts moved to `profile.home`. The dev error: the benefits table exists only in the local Supabase; `npm run dev` reads `.env.local` (not readable by the agent), most likely the production project where the migration is not applied yet.
- L11 (2026-11-11, user): "Verificado, todo ok. En profile, la card de beneficis debe estar justo encima de la de properes sessions". Card moved below the checklist and badges, above the sessions.
- L12 (2026-11-11, user): "Si" (merge). feat/member-benefits fast-forwarded into develop at 31c89ba; not pushed. Production migration still pending.
- L13 (2026-11-11, user): "Haz la migración a producción de la base de datos, pero no añadas los datos archivados que tenemos en local para pruebas, solo lo relativo a aoutletgames actual". Dry run listed only 20261111100000_member_benefits.sql; `supabase db push --linked` applied it. Read-only check on production: 1 row (Outlet Games, DARKSTONE, https://outletgames.es, outlet-games, 3% text), RLS on with the active-member policy, anon cannot select or call admin_list_benefits, service role cannot insert, migration recorded, audit CHECK keeps old actions plus benefit.*. Local test benefits were never pushed (db push only runs migration files).
