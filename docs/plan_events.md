# Plan: Pagina d'Esdeveniments

Pagina nova per mostrar els proxims esdeveniments de l'associacio, amb dades obtingudes automaticament de Ludoya.

## Objectiu

Eliminar la duplicacio de contingut: l'associacio ja gestiona els seus esdeveniments a Ludoya, i la web ha de mostrar-los automaticament sense intervenció manual.

## Fonts de dades

- **API Ludoya** (publica, sense autenticacio): documentada a `docs/ludoya-api-reference.md`
- **Endpoints necessaris:**
  1. `GET /groups/{groupId}/meetups?onlyFuture=true` — llista d'esdeveniments futurs
  2. `GET /meetups/{meetupId}/planned-plays` — partides d'un esdeveniment concret
- **Group ID hardcoded:** `c801047e5d1d4d3295976ebd1e8b48ab` (evita una request extra per slug)
- **URLs de Ludoya per als links:**
  - Esdeveniment: `https://app.ludoya.com/meetups/{meetupId}`

---

## Que es mostra

### 1. Esdeveniments regulars (divendres i dissabtes)

Tots els esdeveniments futurs que coincideixin amb els horaris regulars.

Identificacio per dia de la setmana i horari (en timezone `Europe/Madrid`):
- Divendres: comenca a les 16:00, acaba a les 20:30
- Dissabte: comenca a les 10:00, acaba a les 13:30

> No es pot confiar en `recurrenceConfigId` perque no sempre es creen com a recurrents.

Es mostren dins d'una **card fosca** (`#1C1917`) amb un **carrusel manual** de 2 en 2. Per defecte es mostren els 2 mes propers al dia actual. L'usuari pot navegar endavant/enrere per veure'n mes.

Cada event es una **mini-card clara** (fons blanc) amb:
- Part superior: imatge de l'esdeveniment (`meetup.image.previewUrl`) sense marges (edge-to-edge)
- Part inferior (fons blanc): data, horari, link extern a Ludoya
- **Partides planificades** (si `plannedPlayCount > 0`):
  - Nom del joc (pildores informatives dels jocs que es jugaran)

### 2. Esdeveniments especials

Qualsevol esdeveniment futur que **no** sigui un dels recurrents de divendres/dissabte, dins d'un marge maxim de 12 mesos.

Es mostren dins d'una **card fosca** (`#1C1917`) separada, tambe amb **carrusel manual** de 2 en 2, per defecte els 2 mes propers.

Cada event es una **mini-card clara** (fons blanc) amb:
- Part superior: imatge de l'esdeveniment sense marges (edge-to-edge)
- Part inferior (fons blanc): titol, data, horari, link extern a Ludoya
- **Partides planificades** (si `plannedPlayCount > 0`):
  - Nom del joc (pildores informatives dels jocs que es jugaran)

### 3. Estat buit / error

Si la API de Ludoya no respon o no hi ha esdeveniments:
- Mostrar missatge simpatic
- Link directe a la pagina del grup a Ludoya com a fallback

---

## Logica de classificacio d'esdeveniments

```
Per cada meetup a futureMeetups.elements:
  - Si canceled === true → descartar
  - Convertir startsAt/endsAt a hora local (Europe/Madrid)
  - Si es divendres i comenca a les 16:00 i acaba a les 20:30 → "regular"
  - Si es dissabte i comenca a les 10:00 i acaba a les 13:30 → "regular"
  - Si la data es dins de 12 mesos → "special"
  - Altrament → descartar

Tots els "regular" es mostren (ordenats per data, sense limit)
Tots els "special" es mostren (ordenats per data, sense limit)
```

> La deteccio es basa en dia + horari exacte en timezone local, no en `recurrenceConfigId`. Qualsevol esdeveniment que no coincideixi amb els horaris regulars apareixera com a "especial".

---

## Arquitectura tecnica

### ISR (Incremental Static Regeneration)

- `revalidate = 86400` (1 dia)
- Les dades d'esdeveniments canvien poc; una actualitzacio diaria es suficient
- Minimitza les requests a la API de Ludoya (no documentada, sense garanties de rate limiting)
- En cas d'error de la API, Next.js serveix l'ultima versio cacheada

### Flux de dades (server-side)

```
page.tsx (server component, ISR)
  └─> fetchUpcomingEvents()  [src/lib/ludoya.ts]
        ├─> GET /groups/{id}/meetups?onlyFuture=true
        ├─> Classificar: regulars vs specials
        ├─> Per cada event (regular o special) amb plannedPlayCount > 0:
        │     GET /meetups/{id}/planned-plays  (en paral·lel amb Promise.all)
        └─> Retorna { regularEvents, specialEvents, error? }
```

Requests per cicle de revalidacio: 1 (meetups) + N (planned plays per events amb partides) requests totals.

### Tipus principals (`src/lib/ludoya.ts`)

```typescript
interface LudoyaEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;        // ISO 8601 UTC
  endsAt: string;
  timeZone: string;        // "Europe/Madrid"
  imageUrl: string | null;
  thumbnailUrl: string | null;
  plannedPlayCount: number;
  ludoyaUrl: string;        // link a app.ludoya.com
  type: "regular" | "special";
  plannedPlays: LudoyaPlannedPlay[];  // buit si no n'hi ha
}

interface LudoyaPlannedPlay {
  gameName: string;
}

interface LudoyaEventsResult {
  regularEvents: LudoyaEvent[];   // tots els regulars futurs
  specialEvents: LudoyaEvent[];   // tots els especials dins de 12 mesos
  error?: "api_error" | "timeout";
}
```

---

## Fitxers a crear

| Fitxer | Proposit |
|--------|----------|
| `src/lib/ludoya.ts` | Fetch API + tipus + logica de classificacio |
| `src/app/[locale]/events/page.tsx` | Pagina server amb ISR, metadata, JSON-LD |
| `src/components/events/EventsHero.tsx` | Hero section (client, animacions) |
| `src/components/events/EventsContent.tsx` | Contingut principal: cards + partides (client, animacions) |

### `src/lib/ludoya.ts`

- Constants: API URL, group ID, horaris regulars, app URLs
- Interfaces TypeScript per a les respostes de l'API i els tipus processats
- `fetchUpcomingEvents()`: funcio principal que orquestra tot el flux
- Error handling: try/catch amb retorn graceful (`error` field)
- Timeout: 15s per request
- Transformacio de dades: de la resposta bruta de l'API als tipus simplificats per la UI

### `src/app/[locale]/events/page.tsx`

Segueix el patro de `faq/page.tsx` (pagina simple server-rendered):

- `revalidate = 86400`
- `generateMetadata()` amb traduccions
- JSON-LD: `BreadcrumbList` + `WebPage` + `Event` (schema.org) per cada esdeveniment
- Renderitza: `NavBar` + `EventsHero` + `EventsContent` + `Footer` + `ScrollToTop`
- Passa les dades processades a `EventsContent` com a props

### `src/components/events/EventsHero.tsx`

- Coherent amb les altres hero sections del projecte
- Fons fosc (`#1C1917`), text clar
- Titol animat amb motion/react

### `src/components/events/EventsContent.tsx`

- Rep `regularEvents`, `specialEvents`, `error?` com a props
- **Seccio regulars**: card fosca (`#1C1917`) amb carrusel manual (2 visibles, navega endavant/enrere)
- **Seccio especials**: card fosca separada, mateix patro de carrusel
- Dins de cada card fosca: mini-cards clares (fons blanc) amb imatge edge-to-edge a dalt i text a baix
- Estat buit/error: missatge simpatic + link a Ludoya
- Animacions d'entrada amb `whileInView` + `viewport={{ once: true }}`
- Carrusel: per defecte mostra els 2 events mes propers al dia actual; botons prev/next per navegar

---

## Fitxers a modificar

| Fitxer | Canvi |
|--------|-------|
| `next.config.ts` | Afegir `img.ludoya.com` a `remotePatterns` i CSP `img-src` |
| `src/messages/ca.json` | Namespace `events` + claus a `metadata`, `nav`, `footer` |
| `src/messages/es.json` | Idem (traduccions al castella) |
| `src/messages/en.json` | Idem (traduccions a l'angles) |
| `src/components/NavBar.tsx` | Afegir `"/events"` a `SUBPAGE_THEMES` |
| `src/components/Footer.tsx` | Afegir link a `NAV_LINKS` |
| `src/app/sitemap.ts` | Afegir entrada `/events` |
| `scripts/lighthouse/config.mjs` | Afegir `{ slug: 'events', path: '/events' }` |
| `CLAUDE.md` | Actualitzar taules (Pages, Components, Translation Keys) |
| `README.md` | Actualitzar taula de Pages |

### Detall: `next.config.ts`

```typescript
// images.remotePatterns — afegir:
{ protocol: "https", hostname: "img.ludoya.com" }

// CSP img-src — afegir https://img.ludoya.com:
"img-src 'self' data: blob: https://cf.geekdo-images.com https://img.ludoya.com https://www.googletagmanager.com"
```

> `api.ludoya.com` NO cal afegir-lo a `connect-src` perque les requests es fan server-side (ISR), mai des del navegador.

### Detall: Traduccions

Noves claus (exemple `ca.json`):

```json
{
  "nav": {
    "events": "Esdeveniments"
  },
  "footer": {
    "events": "Esdeveniments"
  },
  "metadata": {
    "events_title": "Proxims Esdeveniments | Darkstone Catalunya",
    "events_description": "Consulta els proxims esdeveniments i partides de jocs de taula de Darkstone Catalunya a Terrassa."
  },
  "events": {
    "title": "Proxims Esdeveniments",
    "subtitle": "Vine a jugar amb nosaltres!",
    "regular_title": "Properes sessions",
    "special_title": "Esdeveniments especials",
    "friday": "Divendres de jocs",
    "saturday": "Dissabtes de jocs",
    "planned_plays": "Partides planificades",
    "view_event": "Veure a Ludoya",
    "no_plays": "Encara no hi ha partides planificades",
    "error_title": "No s'han pogut carregar els esdeveniments",
    "error_description": "Pots consultar els nostres esdeveniments directament a Ludoya.",
    "error_link": "Veure esdeveniments a Ludoya",
    "no_events": "No hi ha esdeveniments programats properament",
    "special_badge": "Especial",
    "duration": "{minutes} min"
  }
}
```

---

## Estructura visual (wireframe)

Inspirat en el patro de PIE (paint workshops): titol de seccio + carrusel de cards amb imatge prominent i detalls a sota. Adaptat als colors i estil de Darkstone.

```
┌──────────────────────────────────────────────────────────────┐
│                       EVENTS HERO                            │
│  Fons fosc (#1C1917)                                         │
│             "Proxims Esdeveniments"                          │
│        "Vine a jugar amb nosaltres!"                         │
└──────────────────────────────────────────────────────────────┘

Fons clar (#EEE8DC)

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  PROPERES SESSIONS                                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Card fosca (#1C1917)                   rounded-2xl    │  │
│  │                                                        │  │
│  │  ┌────────────────────┐  ┌────────────────────┐       │  │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │  │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │  │
│  │  │ ▓▓ IMATGE EVENT ▓▓ │  │ ▓▓ IMATGE EVENT ▓▓ │       │  │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │  │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │  │
│  │  │ ┌──────────┐       │  │ ┌──────────┐       │       │  │
│  │  │ │Dv. 7.03. │ badge │  │ │Ds. 8.03. │ badge │       │  │
│  │  │ │  16:00   │ sobre │  │ │  10:00   │ sobre │       │  │
│  │  │ └──────────┘ img   │  │ └──────────┘ img   │       │  │
│  │  │                    │  │                    │       │  │
│  │  │  [Mesos] [Dead R.] │  │  [Root]            │ pills │  │
│  │  │                    │  │                    │ sobre │  │
│  │  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ img   │  │
│  │  ├────────────────────┤  ├────────────────────┤       │  │
│  │  │ Fons blanc         │  │ Fons blanc         │       │  │
│  │  │                    │  │                    │       │  │
│  │  │ Divendres de jocs  │  │ Dissabtes de jocs  │       │  │
│  │  │ 16:00 - 20:30      │  │ 10:00 - 13:30      │       │  │
│  │  │                    │  │                    │       │  │
│  │  │ [Veure a Ludoya ->]│  │ [Veure a Ludoya ->]│       │  │
│  │  └────────────────────┘  └────────────────────┘       │  │
│  │                                                        │  │
│  │  · · · · ·                                   [<] [>]   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ESDEVENIMENTS ESPECIALS                                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Card fosca (#1C1917)                   rounded-2xl    │  │
│  │                                                        │  │
│  │  ┌────────────────────┐  ┌────────────────────┐       │  │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │  │
│  │  │ ▓▓ IMATGE EVENT ▓▓ │  │ ▓▓ IMATGE EVENT ▓▓ │       │  │
│  │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │       │  │
│  │  │ ┌──────────┐       │  │ ┌──────────┐       │       │  │
│  │  │ │Ds. 12.04.│ badge │  │ │Dg. 20.04.│ badge │       │  │
│  │  │ │  10:00   │       │  │ │  16:00   │       │       │  │
│  │  │ └──────────┘       │  │ └──────────┘       │       │  │
│  │  │  [X-Wing]    pills │  │                    │       │  │
│  │  ├────────────────────┤  ├────────────────────┤       │  │
│  │  │ Fons blanc         │  │ Fons blanc         │       │  │
│  │  │ Torneig X-Wing     │  │ Jornada RPG        │       │  │
│  │  │ 10:00 - 18:00      │  │ 16:00 - 21:00      │       │  │
│  │  │ [Veure a Ludoya ->]│  │ [Veure a Ludoya ->]│       │  │
│  │  └────────────────────┘  └────────────────────┘       │  │
│  │                                                        │  │
│  │  · · · · ·                                   [<] [>]   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Elements de disseny (inspirats en referencia PIE)

**Badge de data**: superposat sobre la imatge (cantonada superior esquerra).
- Fons brand-orange (`#B54F00`) amb text blanc
- Mostra: dia de la setmana abreujat + data + hora d'inici
- Ex: "Dv. 7.03. / 16:00"

**Pills de partides**: superposats sobre la imatge (part inferior).
- Fons semi-transparent fosc amb text blanc, rounded-full
- Mostren els noms dels jocs que es jugaran
- Nomes visibles si hi ha partides planificades

**Mini-card d'event**: fons blanc, rounded-xl, overflow-hidden.
- Part superior: imatge edge-to-edge (aspect-ratio ~3:2), sense marges
- Part inferior: padding amb titol de l'event, horari, link a Ludoya

**Indicadors de carrusel**: punts (`· · · · ·`) a l'esquerra indicant la posicio actual.

**Botons de navegacio**: `[<]` `[>]` a la dreta, sota les cards. Estil circular, coherent amb la UI.

### Carrusel

- Mostra **2 mini-cards** visibles alhora (desktop)
- Per defecte posicionat als **2 events mes propers** al dia actual
- Botons prev/next per navegar manualment (no auto-play)
- Punts indicadors de pagina
- Si nomes hi ha 1 o 2 events, els botons i punts no es mostren
- **Mobile**: 1 mini-card visible, swipe o botons per navegar

---

## Riscos i mitigacions

| Risc | Probabilitat | Impacte | Mitigacio |
|------|-------------|---------|-----------|
| API Ludoya canvia sense avis | Baixa | Alt | Error handling graceful; ISR serveix cache; fallback amb link directe |
| API caiguda temporal | Baixa | Mig | ISR serveix ultima versio; estat d'error amb link manual |
| Canvi d'horari regular | Baixa | Mig | Actualitzar constants d'horari a `ludoya.ts` |
| Imatges pesades de Ludoya | Mitjana | Baix | `quality={60}` + Next.js optimization + thumbnails API |
| Molts esdeveniments | Baixa | Baix | Limit de 12 mesos; carrusel permet navegar sense sobrecarregar la UI |

---

## Decisions preses

1. **Ruta**: `/events`
2. **Navegacio**: Navbar + footer
3. **Partides**: Es mostren tant en regulars com en especials
4. **Revalidacio**: 1 dia (`86400`)
5. **Estat buit/error**: Missatge simpatic + link a Ludoya
6. **Integracio**: Links externs a Ludoya (sense embed)
7. **Estil**: Inspirat en PIE workshops — fons clar (`#EEE8DC`), cards fosques (`#1C1917`) per seccions, mini-cards blanques per events (imatge edge-to-edge + badge data + pills partides sobre imatge, text a baix)
8. **Quantitat**: Sense limit d'events; carrusel manual de 2 en 2 (1 en mobile), posicionat als 2 mes propers per defecte, amb punts indicadors i botons prev/next
