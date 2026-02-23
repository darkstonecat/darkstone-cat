# Pla de Millora Web — Darkstone Catalunya

> Fitxer de referència per a Claude Code. Cada pas és un prompt independent i autocontingut.
> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Motion v12 (`motion/react`) · Lenis · Zustand · next-intl
> **Local:** http://localhost:3000/ca
> **Objectiu de disseny:** Qualitat awwwards — animacions fluides, tipografia expressiva, transicions cinematogràfiques, 100% responsiu.

---

## Estat actual del projecte (febrer 2026)

### ✅ Completat
- **Pas 1 — NavBar:** Backdrop blur, navegació per seccions, indicador actiu animat, menú hamburger mòbil amb circular reveal
- **Pas 2 — Schedule:** Tipografia gegant sobre fons fosc, dues columnes amb divisor animat, horaris corregits
- **Pas 3 — JoinUs:** CTA "Fes-te soci" amb formulari + cards Telegram/Ludoya redissenyades
- **Pas 4 — Location:** Pantalla completa 40/60, skeleton loader, animacions d'entrada
- **Pas 5 — Footer:** 3 columnes amb logo, nav links, icones socials amb spring hover
- **Hero:** Parallax scroll-driven amb spring physics, staggered entrance, CTA animat
- **FixedBackground:** Sistema de temes amb transició de color animada + textura parallax
- **Lenis:** Smooth scroll integrat globalment via SmoothScroll context
- **i18n:** 3 idiomes (ca, es, en) amb next-intl i routing dinàmic `[locale]`

### 🟡 Funcional però millorable
- **About (Qui som):** Dual-column scrollytelling — massa espai buit, falta element visual (foto), import incorrecte de `framer-motion`
- **Activities (Què fem):** Galeria parallax orgànica — visualment interessant però confusa, relació foto-categoria poc clara

### 🔴 Per fer
- **Micro-interaccions globals**
- **Animació de càrrega inicial**
- **Audit responsive i optimització**

---

## Pas 6 — Redisseny de `Qui som?` amb layout editorial

**Objectiu:** Transformar la secció en un layout editorial asimètric amb foto d'ambient que ocupi mitja pantalla, eliminant l'excés d'espai buit i donant personalitat visual.

**Context tècnic:** Component actual a `src/components/About.tsx`. Usa dual-column scrollytelling amb sticky title. **Important:** Actualment importa de `framer-motion` — cal migrar a `motion/react`.

**Problema actual:**
- El títol "Qui som?" queda sol i desbalancejat a l'esquerra
- Massa espai buit, el fons és idèntic al Hero — no hi ha canvi de "capítol"
- No hi ha cap element visual (foto) que doni vida a la secció

**Tasques:**
1. Layout de dues columnes a pantalla completa (`min-h-screen flex`):
   - **Columna esquerra (45%):** Contingut editorial centrat verticalment, `px-8 md:px-16 py-24`
   - **Columna dreta (55%):** Foto d'ambient a `object-cover h-full` amb overlay gradient suau
2. Contingut columna esquerra (de dalt a baix):
   - Etiqueta petita: `01 — QUI SOM` en `text-xs tracking-[0.3em] opacity-40 uppercase`
   - Títol: `text-6xl md:text-7xl font-black leading-none`
   - Descripció: `text-lg opacity-60 max-w-sm`
   - Pills/tags en fila: `Fundada el 2024` · `Terrassa` · `Gratuït` — border rounded-full
   - Línia divisòria
   - Subseccions: icona/emoji + nom + descripció breu (Foment del Català, Ludoteca Oberta)
3. Foto columna dreta: Next.js `<Image>` amb fill, `object-cover`, src `/images/photos/egarajuga_taula.webp`
   - Overlay gradient: `bg-gradient-to-l from-black/10 to-transparent`
4. Animacions amb `motion/react` (NO `framer-motion`):
   - Contingut esquerre: staggered fade + slide up amb `whileInView`
   - Foto: fade in amb scale subtil
5. Responsive: En mòbil, foto a dalt (h-[40vh]) i contingut a sota en stack vertical
6. Tema: `useThemeSection` amb colors adequats (brand-beige fons, stone-custom text)
7. Afegir traduccions per als pills a `src/messages/{ca,es,en}.json` (claus: `about.pill_founded`, `about.pill_location`, `about.pill_free`)

**Fotos disponibles:** `egarajuga_taula.webp`, `egarajuga_alcalde.webp`, `boardgames_darws.webp`

---

## Pas 7 — Redisseny de `Què fem?` amb carrusel horitzontal

**Objectiu:** Substituir l'actual galeria parallax per un carrusel horitzontal immersiu amb snap, on cada categoria ocupa quasi tota la pantalla amb foto a full bleed.

**Context tècnic:** Component actual a `src/components/Activities.tsx`. Té una implementació complexa amb galeria parallax orgànica (desktop) i cards apilades (mobile). El component és gran (~400 línies).

**Problema actual:**
- Les fotos es solapen i la relació entre foto i categoria no és clara
- La llista de categories a l'esquerra és funcional però poc atractiva
- La secció no té narrativa clara — l'usuari no sap on mirar primer

**Tasques:**
1. Estructura general: `min-h-screen flex flex-col`
   - **Capçalera (part superior):** Títol, descripció breu, botons de navegació ← →
   - **Carrusel (part inferior, flex-1):** Scroll horitzontal amb snap
2. Capçalera:
   - Esquerra: etiqueta `02 — QUÈ FEM` + títol `text-5xl font-black` + descripció breu
   - Dreta: dos botons circulars ← → que fan `scrollBy` al carrusel
3. Carrusel (`overflow-x-auto snap-x snap-mandatory scroll-smooth`):
   - Amagar scrollbar amb `.no-scrollbar` (ja existeix a globals.css)
   - Cada card: `snap-start shrink-0 w-[72vw] md:w-[55vw] rounded-2xl overflow-hidden relative`
   - Contingut de cada card:
     - Next.js `<Image>` amb fill, `object-cover`
     - Overlay gradient: `bg-gradient-to-t from-black/80 via-black/20 to-transparent`
     - Número (top-right): `text-white/40 text-xs font-mono` (ex: "01 / 04")
     - Text (bottom-left): títol `text-3xl font-black text-white` + descripció `text-white/75 text-sm`
4. Les 4 cards en ordre:
   - "Jocs de Taula" → `boardgames_finspan.webp`
   - "Jocs de Rol" → `rol_miseries2.webp`
   - "Esdeveniments i Tornejos" → `events_speedpainting.webp`
   - "Egara Juga" → `egarajuga_sam.webp`
5. Botons de navegació: `useRef<HTMLDivElement>` + `scrollBy({ left: ±cardWidth, behavior: 'smooth' })`
6. Tema: `useThemeSection` amb `brand-beige` fons
7. Responsive: Cards més amples en mòbil (`w-[85vw]`), capçalera apilada
8. Usar textos de `activities.items.{board_games,rpg,events,egara}` de les traduccions existents
9. Afegir etiqueta secció a traduccions si cal (`activities.section_label`)

**Important:** Eliminar completament la implementació anterior (DesktopGallery, MobileGallery, parallax amb fotos orgàniques). El nou component ha de ser molt més simple i llegible.

---

## Pas 8 — Micro-interaccions i polish global

**Objectiu:** Afegir detalls premium que eleven la qualitat percebuda a nivell awwwards — text reveals, hover states sofisticats, transicions entre seccions.

**Tasques:**
1. **Text reveal animation reutilitzable:** Crear un component `TextReveal` que anima paraula per paraula o línia per línia amb `whileInView` i delay escalonat. Aplicar als títols principals de cada secció.
2. **Hover magnètic als botons CTA:** Efecte on el botó segueix lleugerament el cursor (translate subtle basat en posició del mouse). Aplicar al Hero CTA i al botó de "Fes-te soci".
3. **Staggered list animations:** Les llistes d'elements (horaris, links, cards) apareixen amb delay escalonat (0.05s entre elements).
4. **Scroll progress indicator:** Línia fina a la part superior de la pantalla (sota el NavBar) que mostra el progrés de scroll de la pàgina. Color brand-orange → brand-red gradient.
5. **Transicions suaus entre seccions:** Assegurar que cada secció usa `useThemeSection` correctament i que les transicions de color del `FixedBackground` són fluides.
6. **Cursor personalitzat (opcional, només desktop):** Dot cursor que canvia de mida sobre elements interactius (links, botons).

**Important:** No sobrecarregar — cada micro-interacció ha de ser subtil i funcional, no decorativa.

---

## Pas 9 — Animació de càrrega inicial (page intro)

**Objectiu:** Primera impressió impactant — una animació de 1-2 segons quan la pàgina carrega per primera vegada.

**Tasques:**
1. Crear component `PageIntro` que:
   - Mostra un overlay fullscreen amb el logo Darkstone centrat
   - Logo fa scale animation (0.8 → 1) amb opacity (0 → 1)
   - L'overlay es desplaça cap amunt (o fa clip-path reveal) per mostrar la pàgina
   - Durada total: ~1.5s, ease-out
2. Usar `AnimatePresence` de `motion/react` per gestionar la sortida
3. Integrar amb el layout (`src/app/[locale]/layout.tsx`)
4. Assegurar que no bloqueja la càrrega de contingut (el contingut carrega darrere l'overlay)
5. Només mostrar en la primera visita de la sessió (guardar estat amb `sessionStorage`)

---

## Pas 10 — Optimització i responsive final

**Objectiu:** Assegurar que tot funciona perfectament en mòbil, rendiment optimitzat, i accessibilitat bàsica.

**Tasques:**
1. **Audit responsive:** Revisar cada secció als breakpoints: 375px (mòbil), 768px (tablet), 1024px (desktop), 1440px (desktop gran)
2. **Performance:**
   - Verificar que les imatges usen Next.js `<Image>` amb lazy loading i sizes correctes
   - Revisar que les animacions pesades usen `will-change` o `transform` (GPU-accelerated)
   - Auditar amb Lighthouse i corregir problemes > 90 score
3. **Accessibilitat:**
   - ARIA labels als botons i links
   - Focus states visibles per a navegació amb teclat
   - Alt text a totes les imatges
   - Contrast de color adequat (WCAG AA)
4. **SEO bàsic:**
   - Metadata correcta a `layout.tsx` (title, description, og:image)
   - Structured data bàsica (Organization)
5. **Touch interactions:** Assegurar que hover effects tenen alternatives per a touch (active states)

---

## Resum i ordre d'execució

| Pas | Nom | Dificultat | Impacte visual | Estat |
|-----|-----|-----------|----------------|-------|
| 1 | NavBar premium + menú mòbil | Mitjana | ⭐⭐⭐⭐ | ✅ Fet |
| 2 | Schedule tipografia gegant | Fàcil | ⭐⭐⭐⭐⭐ | ✅ Fet |
| 3 | JoinUs + Fes-te soci CTA | Mitjana | ⭐⭐⭐⭐ | ✅ Fet |
| 4 | Location pantalla completa | Fàcil | ⭐⭐⭐ | ✅ Fet |
| 5 | Footer redissenyat | Fàcil | ⭐⭐⭐ | ✅ Fet |
| 6 | About layout editorial + foto | Mitjana | ⭐⭐⭐⭐⭐ | ✅ Fet |
| 7 | Activities carrusel horitzontal | Alta | ⭐⭐⭐⭐⭐ | ✅ Fet |
| 8 | Micro-interaccions i polish | Alta | ⭐⭐⭐⭐⭐ | ✅ Fet |
| 9 | Animació de càrrega | Mitjana | ⭐⭐⭐⭐ | ✅ Fet |
| 10 | Responsive + optimització | Mitjana | ⭐⭐⭐ | Pendent |

**Ruta recomanada:** Pas 6 → Pas 7 → Pas 8 → Pas 10 → Pas 9

**Notes tècniques globals:**
- Sempre usar `motion/react` (Motion v12), MAI `framer-motion` directament
- Usar `useThemeSection(bg, text)` per registrar colors de tema a cada secció
- Usar `cn()` de `src/lib/utils.ts` per combinar classes Tailwind
- Traduccions a `src/messages/{ca,es,en}.json` — el català és l'idioma principal
- Path alias: `@/*` → `./src/*`
- Color tokens definits a `src/styles/globals.css` com custom properties

---

*Pla actualitzat — febrer 2026 — Darkstone Catalunya web v3*
