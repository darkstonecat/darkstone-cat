# Pla de Millora Web — Darkstone Catalunya

> Fitxer de referència per a Claude Code. Cada pas és un prompt independent i autocontingut.
> **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Motion v12 (`motion/react`) · Lenis · Zustand · next-intl
> **Local:** http://localhost:3000/ca
> **Objectiu de disseny:** Qualitat awwwards — animacions fluides, tipografia expressiva, transicions cinematogràfiques, 100% responsiu.

---

## Estat actual del projecte (febrer 2026)

### ✅ Ja implementat
- **Hero:** Parallax scroll-driven amb spring physics, staggered entrance, CTA animat
- **About (Qui som):** Dual-column scrollytelling amb sticky title + whileInView reveals
- **Activities (Què fem):** Galeria parallax amb fotos orgàniques (desktop) + cards apilades (mobile)
- **FixedBackground:** Sistema de temes amb transició de color animada + textura parallax
- **Lenis:** Smooth scroll integrat globalment via SmoothScroll context
- **useThemeSection:** Hook personalitzat per canviar tema per secció
- **ScrollToTop:** Botó flotant integrat amb Lenis
- **i18n:** 3 idiomes (ca, es, en) amb next-intl i routing dinàmic `[locale]`

### 🟡 Funcional però millorable
- **Schedule (Quan quedem):** Cards blanques amb hover — funcional però poc impactant
- **JoinUs (Uneix-te):** Telegram + Ludoya cards — falta el CTA de "Fes-te soci"
- **Location (On som):** Dual-column amb mapa, però sense min-h-screen ni animacions d'entrada
- **NavBar:** Logo + language switcher — falta backdrop blur, indicador de secció activa, menú mòbil

### 🔴 Per fer
- **Footer:** Només text i links de text — necessita redisseny complet
- **Animació de càrrega inicial:** No existeix
- **Menú mòbil (hamburger):** No existeix

---

## Pas 1 — NavBar premium amb menú mòbil

**Objectiu:** Navegació fixa amb backdrop blur, indicador de secció activa, i menú hamburger per a mòbil amb animació d'obertura.

**Context tècnic:** El component actual (`src/components/NavBar.tsx`) només té logo + LanguageSwitcher. Usa `motion/react` per a animacions.

**Tasques:**
1. Afegir `backdrop-blur-md bg-brand-beige/80` (o transparent segons tema) quan l'usuari fa scroll
2. Afegir navegació amb links a les seccions (Qui som, Què fem, Quan quedem, Uneix-te, On som) — visibles en desktop, ocults en mòbil
3. Implementar indicador de secció activa basat en scroll (línia animada sota l'element actiu)
4. Crear menú hamburger per a mòbil:
   - Icona animada (hamburger ↔ X) amb `motion/react`
   - Panel fullscreen amb fons fosc, links de secció en tipografia gran i staggered entrance
   - Tancament amb clic fora o al navegar
5. El color del navbar ha de respectar el tema actiu del `useThemeStore` (text clar sobre fons fosc i viceversa)
6. Afegir les traduccions necessàries a `src/messages/{ca,es,en}.json` (ja existeix `nav.menu_button`)

**Important:** Usar `motion/react` (NO `framer-motion`). Usar `useLenis` per a smooth scroll a seccions.

---

## Pas 2 — Redisseny de `Quan quedem?` amb tipografia gegant

**Objectiu:** Transformar la secció d'horaris en un moment visual impactant — tipografia oversized sobre fons fosc, estil editorial/brutalist.

**Context tècnic:** Component actual a `src/components/Schedule.tsx`. Té cards blanques amb hover effects. Usa `useThemeSection` per al canvi de tema.

**Tasques:**
1. Canviar el disseny a:
   - Fons fosc via `useThemeSection` (color-stone-custom o similar)
   - `min-h-screen` amb contingut centrat
   - Títol de secció amb reveal animation (`motion/react` whileInView)
   - Dues columnes simètriques amb divisor vertical animat
   - Etiqueta uppercase petita: `DIVENDRES` / `DISSABTES`
   - Horari en tipografia gegant: `text-[clamp(3rem,12vw,10rem)]` amb `font-black`
   - Sense cards, sense icones — només tipografia i espai
2. Animacions d'entrada:
   - Títol: fade + slide up
   - Horaris: staggered reveal amb clip-path o opacity
   - Divisor vertical: height 0 → 100% animat
3. Responsive: En mòbil, apilar verticalment amb separador horitzontal
4. Horaris correctes: Divendres 16:00 — 20:30, Dissabtes 10:00 — 13:30

---

## Pas 3 — Redisseny de `Uneix-te` + CTA "Fes-te soci"

**Objectiu:** Afegir la crida a l'acció principal de l'associació (fer-se soci) i millorar les cards de Telegram/Ludoya amb més personalitat visual.

**Context tècnic:** Component actual a `src/components/JoinUs.tsx`. Només té Telegram + Ludoya. No existeix CTA de "Fes-te soci".

**Formulari d'alta:** `https://docs.google.com/forms/d/1OBM0vAOs0vvBioSeop4T0aYh__ysuNEOy36kprTJo7Q/viewform`

**Tasques:**
1. Reestructurar la secció en dues zones:
   - **Zona CTA (part superior):**
     - Fons fosc amb gradient subtil o mesh gradient
     - Títol gran: "Fes-te soci" amb text reveal animation
     - Subtítol: "És gratuït. Vine qualsevol divendres o dissabte."
     - Botó prominent amb hover magnètic (scale + glow) que obre el formulari en nova pestanya
     - Text del botó: "Emplena el formulari d'alta →"
   - **Zona canals (part inferior):**
     - Card Telegram: fons `#229ED9`, icona gran de Telegram, hover amb elevació
     - Card Ludoya: fons fosc amb accent brand-beige, logo Ludoya des de `/public/images/logos/`
     - Ambdues amb `whileInView` staggered entrance
2. Afegir traduccions a `src/messages/{ca,es,en}.json` per als nous textos (títol, subtítol, botó)
3. `min-h-screen` amb contingut centrat verticalment
4. Responsive: Cards apilades en mòbil, horitzontal en desktop

---

## Pas 4 — Location a pantalla completa amb animacions

**Objectiu:** Que la secció ocupi tota la pantalla amb animacions d'entrada i millor placeholder del mapa.

**Context tècnic:** Component actual a `src/components/Location.tsx`. Ja té dual-column amb mapa, però sense min-h-screen i amb placeholder bàsic (emoji).

**Tasques:**
1. Afegir `min-h-screen` al wrapper
2. Ajustar proporcions: columna info 40%, mapa 60% (desktop)
3. Substituir el placeholder emoji del mapa per un skeleton loader elegant (pulsing gradient)
4. Afegir animacions d'entrada amb `motion/react`:
   - Títol i info: fade + slide des de l'esquerra
   - Mapa: fade in amb scale subtil
5. Millorar el botó CTA: text "Com arribar-hi →" amb hover animat
6. En mòbil: mapa a sota amb alçada fixa (60vh)
7. Verificar horaris correctes: Divendres 16:00 — 20:30

---

## Pas 5 — Footer redissenyat

**Objectiu:** Footer amb presència visual — logo, links de navegació, icones socials, i micro-interaccions.

**Context tècnic:** Component actual a `src/components/Footer.tsx`. Només té copyright + links de text.

**Tasques:**
1. Layout a 3 columnes (desktop), stack (mòbil):
   - **Esquerra:** Logo Darkstone + nom + tagline breu
   - **Centre:** Links de navegació a seccions (mateixos que el NavBar)
   - **Dreta:** Icones socials (Instagram, Twitter/X, Telegram) amb `react-icons` — hover amb scale i canvi de color
2. Línia divisòria superior amb gradient subtil (brand-red → brand-orange → transparent)
3. Copyright a la part inferior centrat
4. Fons fosc (stone-custom) amb text clar
5. Animació d'entrada: staggered fade-in de les 3 columnes amb `whileInView`
6. Icones socials: hover amb `motion/react` spring animation (scale 1 → 1.15)

---

## Pas 6 — Micro-interaccions i polish global

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

## Pas 7 — Animació de càrrega inicial (page intro)

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

## Pas 8 — Optimització i responsive final

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

| Pas | Nom | Dificultat | Impacte visual | Prioritat |
|-----|-----|-----------|----------------|-----------|
| 1 | NavBar premium + menú mòbil | Mitjana | ⭐⭐⭐⭐ | Alta |
| 2 | Schedule tipografia gegant | Fàcil | ⭐⭐⭐⭐⭐ | Alta |
| 3 | JoinUs + Fes-te soci CTA | Mitjana | ⭐⭐⭐⭐ | Alta |
| 4 | Location pantalla completa | Fàcil | ⭐⭐⭐ | Mitjana |
| 5 | Footer redissenyat | Fàcil | ⭐⭐⭐ | Mitjana |
| 6 | Micro-interaccions i polish | Alta | ⭐⭐⭐⭐⭐ | Mitjana |
| 7 | Animació de càrrega | Mitjana | ⭐⭐⭐⭐ | Baixa |
| 8 | Responsive + optimització | Mitjana | ⭐⭐⭐ | Alta |

**Ruta recomanada:** Pas 1 → Pas 2 → Pas 3 → Pas 5 → Pas 4 → Pas 8 → Pas 6 → Pas 7

**Notes tècniques globals:**
- Sempre usar `motion/react` (Motion v12), MAI `framer-motion` directament
- Usar `useThemeSection(bg, text)` per registrar colors de tema a cada secció
- Usar `cn()` de `src/lib/utils.ts` per combinar classes Tailwind
- Traduccions a `src/messages/{ca,es,en}.json` — el català és l'idioma principal
- Path alias: `@/*` → `./src/*`
- Color tokens definits a `src/styles/globals.css` com custom properties

---

*Pla actualitzat — febrer 2026 — Darkstone Catalunya web v2*
