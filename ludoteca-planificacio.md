# Ludoteca Darkstone Catalunya — Planificació

## Objectiu

Afegir una pàgina pública `/ludoteca` que mostri la col·lecció de jocs de taula de l'associació (jocs base + expansions agrupades), amb filtres interactius, paginació, ordenació i detall de cada joc en modal.

---

## 1. Font de dades: BoardGameGeek XML API v2

### Per què BGG

La col·lecció es gestiona a **Ludoya** (`app.ludoya.com/darkstonecat`), sincronitzada amb BGG. S'utilitza la API XML v2 de BGG com a font de dades.

### Autenticació obligatòria (juliol 2025)

Des del 2 de juliol de 2025, BGG requereix **registre d'aplicació i token Bearer** per a totes les peticions a la XML API. Sense token, qualsevol request des del servidor retorna `HTTP 401`.

**Procés per obtenir el token:**
1. Anar a [boardgamegeek.com/using_the_xml_api](https://boardgamegeek.com/using_the_xml_api)
2. Registrar l'aplicació "Darkstone Catalunya"
3. Obtenir l'**Application Token**
4. Afegir-lo com a variable d'entorn `BGG_API_TOKEN`

**Header requerit a cada petició:**
```
Authorization: Bearer {BGG_API_TOKEN}
```

### Endpoints

**1) Col·lecció completa (jocs base + expansions, amb stats):**
```
GET https://boardgamegeek.com/xmlapi2/collection
  ?username={BGG_USERNAME}
  &own=1
  &subtype=boardgame,boardgameexpansion
  &stats=1
```

Retorna tots els items de la col·lecció. Cada `<item>` té un atribut `subtype` que indica si és `boardgame` o `boardgameexpansion`.

**2) Detall de tots els jocs (per obtenir minage, averageweight i vincular expansions):**
```
GET https://boardgamegeek.com/xmlapi2/thing
  ?id={ID1,ID2,ID3,...}
  &stats=1
```

Retorna informació detallada incloent:
- `minage` — edat mínima recomanada
- `<statistics><ratings><averageweight>` — complexitat/pes (1–5)
- `<link type="boardgameexpansion" inbound="true">` — vincula cada expansió al seu joc base

Accepta IDs separats per comes (batch, ~20 per petició).

### HTTP 202 — Retry obligatori

BGG retorna `202 Accepted` quan la col·lecció s'està generant. Cal implementar un **retry amb backoff exponencial**: esperar 2s, 4s, 8s... fins a un màxim de 5 intents.

### Dades per joc

| Camp | Font | Descripció |
|------|------|------------|
| `objectid` | col·lecció | ID únic BGG |
| `subtype` | col·lecció | `"boardgame"` o `"boardgameexpansion"` |
| `name` | col·lecció | Nom (pot ser traducció) |
| `originalname` | col·lecció | Nom original si existeix |
| `yearpublished` | col·lecció | Any de publicació |
| `thumbnail` | col·lecció | URL imatge petita (grid) |
| `image` | col·lecció | URL imatge gran (modal) |
| `minplayers` | col·lecció | Jugadors mínim |
| `maxplayers` | col·lecció | Jugadors màxim |
| `playingtime` | col·lecció | Durada en minuts |
| `average` | col·lecció | Rating mitjà (0–10) |
| `averageweight` | thing | Complexitat (1–5) — **no disponible a col·lecció** |
| `minage` | thing | Edat mínima recomanada — **no disponible a col·lecció** |

---

## 2. Estratègia de desenvolupament amb dades mock

Mentre no disposem del token BGG, s'utilitzen **fitxers XML locals** com a mock.

### Fitxers mock actuals

```
public/mock/bgg-collection.xml    ← 286 jocs base (subtype=boardgame)
public/mock/bgg-expansions.xml    ← 105 expansions (subtype=boardgameexpansion)
```

Ambdós obtinguts del navegador (que no requereix token). Són respostes de l'endpoint de **col·lecció**, no del thing endpoint.

### Limitacions de les dades mock

- **No contenen `averageweight`** (complexitat) — el filtre de complexitat no serà funcional en mock
- **No contenen `minage`** (edat mínima) — el filtre d'edat no serà funcional en mock
- **No contenen `<link inbound>`** — la vinculació expansions→joc base es fa per **heurística de nom** en mock mode

### Heurística de vinculació d'expansions (mock)

En mode mock, les expansions es vinculen als jocs base per coincidència de nom:
- L'expansió "7 Wonders: Leaders" → cerca joc base amb nom que comenci per "7 Wonders"
- Funciona per la majoria de casos (patró BGG: `"{Base}: {Expansió}"`)
- En mode producció (amb token), s'usa el thing endpoint per vinculació exacta

### Comportament de `src/lib/bgg.ts`

```
Si BGG_API_TOKEN definit → fetch real a BGG amb Bearer token (col·lecció + thing)
Si no definit            → llegir fitxers mock locals (amb heurística de vinculació)
```

Quan arribi el token, només cal afegir la variable d'entorn. Zero canvis de codi.

---

## 3. Configuració

### Variables d'entorn (`.env.local`)

```env
BGG_USERNAME=citizen987
BGG_API_TOKEN=             # Buit fins que tinguem el token registrat
```

Ambdues server-only (sense prefix `NEXT_PUBLIC_`). A Vercel, definir les mateixes al dashboard.

### next.config.ts — Imatges remotes

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cf.geekdo-images.com",
      },
    ],
  },
};
```

### Dependència nova

```bash
npm install fast-xml-parser
```

---

## 4. Arquitectura

### Principi: Server fetch → Client interactivity

```
page.tsx (server)           → fetchBggCollection() → dades JSON (jocs base amb expansions vinculades)
  └─ LudotecaHero (client) → animació entrada
  └─ LudotecaClient (client) → filtres + paginació + grid + modal (tot interactiu)
```

### Caché: ISR 24h

```ts
export const revalidate = 86400;
```

Amb dades mock no aplica. Amb token real: ISR regenera la pàgina cada 24h a Vercel.

### Estructura de fitxers

```
src/
├── lib/
│   └── bgg.ts                         ← Tipus, fetch (real o mock), parse XML, vinculació expansions
├── app/[locale]/ludoteca/
│   └── page.tsx                       ← Server component (ISR 24h, metadata SEO)
├── components/ludoteca/
│   ├── LudotecaHero.tsx               ← Hero animat (títol + subtítol + comptador)
│   ├── LudotecaClient.tsx             ← Orquestrador: estat filtres, paginació, layout
│   ├── FilterBar.tsx                  ← Controls de filtre (cerca, tipus, jugadors, durada, complexitat, edat)
│   ├── Pagination.tsx                 ← Navegació de pàgines + selector items per pàgina
│   ├── GameGrid.tsx                   ← Grid responsive de targetes
│   ├── GameCard.tsx                   ← Targeta individual de joc
│   └── GameDetailModal.tsx            ← Modal amb detall complet + expansions + backdrop
├── messages/{ca,es,en}.json           ← + namespace "ludoteca" + clau "nav.ludoteca"
└── public/mock/
    ├── bgg-collection.xml             ← Mock jocs base (286 items)
    └── bgg-expansions.xml             ← Mock expansions (105 items)
```

---

## 5. Capa de dades: `src/lib/bgg.ts`

### Tipus TypeScript

```ts
export interface BggExpansion {
  id: string;
  name: string;
  year: number;
}

export interface BggGame {
  id: string;
  subtype: "boardgame" | "boardgameexpansion";
  name: string;
  originalName?: string;
  year: number;
  thumbnail: string;
  image: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  rating: number;            // 0–10
  weight: number;            // 1–5 (0 si no disponible)
  minAge: number;            // 0 si no disponible
  expansions: BggExpansion[];
}

export interface BggCollectionResult {
  games: BggGame[];          // Jocs base (expansions dins de cada joc)
  totalWithExpansions: number; // Total incloent expansions
  fetchedAt: string;
  error?: "timeout" | "api_error" | "parse_error";
}
```

### Flux de `fetchBggCollection()`

```
Mode real (amb token):
1. Fetch col·lecció XML (jocs base + expansions en una sola crida)
2. Parse → separar en baseGames[] i expansions[]
3. Fetch thing XML per TOTS els IDs (batches de 20) → averageweight, minage, links
4. Enriquir jocs base amb weight i minAge del thing response
5. Usar <link inbound="true"> per vincular expansions → jocs base
6. Deduplicar i ordenar

Mode mock (sense token):
1. Llegir bgg-collection.xml → baseGames[]
2. Llegir bgg-expansions.xml → expansions[]
3. Vincular expansions per heurística de nom
4. weight=0, minAge=0 (no disponibles en mock)
5. Ordenar alfabèticament
```

### Funcions internes

| Funció | Responsabilitat |
|--------|----------------|
| `fetchBggCollection()` | Orquestra tot el flux |
| `fetchBggXml(url)` | HTTP GET amb Bearer token + retry exponencial per 202 |
| `readMockXml(filename)` | Llegir fitxer XML mock del filesystem |
| `parseCollectionXml()` | XML col·lecció → items amb subtype |
| `parseThingXml()` | XML thing → mapa { id → { weight, minAge, baseGameIds } } |
| `linkExpansionsByThing()` | Vincula expansions via thing links (mode real) |
| `linkExpansionsByName()` | Vincula expansions via heurística de nom (mode mock) |

### Gestió d'errors

| Escenari | Comportament |
|----------|-------------|
| Token no definit (dev) | Fallback a mock XML |
| HTTP 202 esgotat (5 intents) | `error: "timeout"` |
| HTTP 401 (token invàlid) | `error: "api_error"` |
| HTTP 4xx/5xx | `error: "api_error"` |
| XML malformat | `error: "parse_error"` |
| Mock XML no trobat | `error: "api_error"` |
| Thing fetch falla | Jocs base sense expansions ni weight/minAge (degradació graceful) |

---

## 6. Components

### 6.1. `page.tsx` — Server Component

Segueix el patró exacte de `contact/page.tsx`:
- `NavBar` → `LudotecaHero` → contingut → `Footer` → `ScrollToTop`
- Metadata SEO: `title: "Ludoteca — Darkstone Catalunya"`
- `export const revalidate = 86400`

### 6.2. `LudotecaHero.tsx` — "use client"

Patró idèntic a `ContactHero.tsx`:
- Fons `bg-stone-custom`, text `text-brand-white`
- `motion.h1` + `motion.p` amb animació escalonada
- Comptador total de jocs (base) + total amb expansions
- `useTranslations("ludoteca")`

### 6.3. `LudotecaClient.tsx` — "use client" (Orquestrador)

**Estat:**
- `search`, `gameType`, `players`, `maxDuration`, `maxWeight`, `minAge`, `sortBy`
- `currentPage`, `itemsPerPage`
- `selectedGame` (per modal)
- Debounce 300ms en cerca de text

**Lògica de filtratge** amb `useMemo` (AND de tots els filtres).

**Paginació**: Calcula pàgines, slice del resultat filtrat.

**Renderitza:**
- `<FilterBar>` amb callbacks
- Comptador de resultats
- `<GameGrid>` amb pàgina actual
- `<Pagination>` amb navegació + selector items per pàgina
- `<GameDetailModal>` amb `AnimatePresence`
- Estats buits: error, col·lecció buida, sense resultats de filtre

### 6.4. `FilterBar.tsx` — "use client"

| Control | Element | Comportament |
|---------|---------|-------------|
| Cerca | `<input text>` | Cerca en `name` + `originalName`, debounce 300ms |
| Tipus | `<select>` | Tots, Joc base, Expansió |
| Jugadors | `<select>` | 1, 2, 3, 4, 5, 6, 7, 8+ |
| Durada | `<select>` | ≤30', ≤60', ≤120', ≤180', >180' |
| Complexitat | `<select>` | Lleugera (≤2), Mitjana (≤3), Pesada (≤4), Expert (≤5) |
| Edat mínima | `<select>` | ≤6, ≤8, ≤10, ≤12, ≤14, ≤16+ |
| Ordenar | `<select>` | Nom, Rating, Complexitat, Any |
| Reset | `<button>` | Neteja tots els filtres |

### 6.5. `Pagination.tsx` — "use client"

- Botons Anterior / Següent
- Números de pàgina amb punts suspensius per llistes llargues
- Selector d'items per pàgina: 12, 24, 48, 96
- Indicador "Mostrant X–Y de Z jocs"

### 6.6. `GameGrid.tsx` — "use client"

- Grid responsive: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Stagger d'entrada amb `motion.div` + `whileInView`

### 6.7. `GameCard.tsx` — "use client"

- `next/image` amb `thumbnail`
- Nom (truncat), jugadors (icona + rang), durada
- Rating (si > 0), complexitat (si > 0)
- Indicador d'expansions si `expansions.length > 0` (badge "+3")
- Hover: `whileHover={{ scale: 1.03 }}`

### 6.8. `GameDetailModal.tsx` — "use client"

- `AnimatePresence` al pare, backdrop `bg-black/60`
- Tancar: click backdrop, tecla `Escape`
- Scroll lock via Lenis (`stop/start`)
- `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap
- **Contingut:**
  - Imatge gran, nom + original, any
  - Jugadors, durada, rating BGG, complexitat, edat mínima
  - Link extern a fitxa BGG
  - **Secció d'expansions**: llistat de les expansions disponibles a la col·lecció (nom + any), amb link a BGG per cadascuna

---

## 7. Integració amb el projecte existent

### 7.1. NavBar.tsx

- Afegir `{ href: "/ludoteca", key: "ludoteca" }` a `NAV_LINKS`
- Afegir `"/ludoteca": { text: "#FAFAF9", bg: "#1C1917" }` a `SUBPAGE_THEMES`

### 7.2. Footer.tsx

- Afegir `{ href: "/ludoteca", key: "ludoteca" }` a `NAV_LINKS`

### 7.3. Traduccions (3 fitxers)

- `nav.ludoteca`: ca → "Ludoteca", es → "Ludoteca", en → "Game Library"
- Namespace `ludoteca` complet amb totes les claus de UI

### 7.4. next.config.ts

- `remotePatterns` per `cf.geekdo-images.com`

### 7.5. .env.local

- `BGG_USERNAME=citizen987`
- `BGG_API_TOKEN=` (buit fins a registre)

---

## 8. Gestió d'errors i estats buits

| Escenari | Comportament UI |
|----------|----------------|
| BGG no respon / token invàlid | Missatge: "No s'ha pogut carregar la col·lecció." |
| Col·lecció buida (0 jocs) | Missatge: "La col·lecció encara no té jocs." |
| Filtres sense resultats | Missatge + botó reset filtres |
| Imatge no disponible | Placeholder SVG |
| Sense token (dev) | Funciona amb mock — sense impacte a UI |
| Thing fetch falla | Jocs sense weight/minAge/expansions — filtres afectats mostren "N/D" |

---

## 9. Accessibilitat

- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Tancar modal amb `Escape`
- Focus trap dins del modal
- Scroll lock via Lenis
- Alt text: `"{nom del joc} — board game cover"`
- Filtres amb `aria-label`
- Cards com a `<button>` (focusables amb teclat)

---

## 10. Implementació — Ordre d'execució

### Pas 1: Configuració base
- [ ] `npm install fast-xml-parser`
- [ ] Afegir `BGG_USERNAME` i `BGG_API_TOKEN` a `.env.local`
- [ ] Afegir `remotePatterns` a `next.config.ts`

### Pas 2: Capa de dades
- [ ] Crear `src/lib/bgg.ts` (tipus + fetch real/mock + parse + vinculació + dedup)

### Pas 3: Pàgina i Hero
- [ ] Crear `src/app/[locale]/ludoteca/page.tsx`
- [ ] Crear `src/components/ludoteca/LudotecaHero.tsx`
- [ ] Afegir traduccions bàsiques als 3 fitxers de `messages/`

### Pas 4: Components de UI
- [ ] `LudotecaClient.tsx`
- [ ] `FilterBar.tsx`
- [ ] `Pagination.tsx`
- [ ] `GameGrid.tsx`
- [ ] `GameCard.tsx`
- [ ] `GameDetailModal.tsx`

### Pas 5: Integració navegació
- [ ] NavBar.tsx (NAV_LINKS + SUBPAGE_THEMES)
- [ ] Footer.tsx (NAV_LINKS)
- [ ] Completar traduccions (ca, es, en)

### Pas 6: Verificació
- [ ] Build: `npm run build` sense errors
- [ ] Lint: `npm run lint` sense errors
- [ ] Responsive: mòbil / tablet / desktop
- [ ] Accessibilitat: teclat, modal, alt text

### Pas 7: Activació real (quan tinguem el token)
- [ ] Registrar app a BGG
- [ ] Afegir `BGG_API_TOKEN` a `.env.local` i Vercel
- [ ] Verificar que el fetch real funciona (incloent thing endpoint per weight/minAge/expansions)
- [ ] Mantenir mock com a fallback dev

---

## 11. Limitacions conegudes

- **Token BGG requerit**: Sense token, la API retorna 401. Cal registrar l'app.
- **Mock sense `averageweight` ni `minage`**: Els filtres de complexitat i edat no seran funcionals fins que tinguem el token i el thing endpoint.
- **Vinculació d'expansions en mock**: Per heurística de nom (no 100% fiable). Amb token real, vinculació exacta via thing endpoint.
- Jocs antics o poc populars poden tenir stats a 0.
- Categories i mecàniques no disponibles a l'endpoint de col·lecció.
- Sincronització Ludoya → BGG és manual.
- Imatges depenen del CDN de BGG (`cf.geekdo-images.com`).
- ISR regenera reactivamente (stale-while-revalidate).
