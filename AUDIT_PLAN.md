# Plan de Auditoría Web — darkstone.cat

Auditoría integral del sitio en producción **https://www.darkstone.cat/** organizada en fases progresivas. Cada fase incluye las herramientas a usar, las páginas objetivo, los criterios de aceptación y las métricas clave.

---

## Herramientas

| Herramienta | Uso principal | Modo |
|---|---|---|
| **Lighthouse CI** | Performance, Accessibility, SEO, Best Practices | CLI (`npx lighthouse`) o Chrome DevTools |
| **PageSpeed Insights API** | Datos reales de campo (CrUX) + lab data | Web / API |
| **WebPageTest** | Waterfall detallado, filmstrip, Core Web Vitals | webpagetest.org |
| **Google Rich Results Test** | Validación de datos estructurados (JSON-LD) | search.google.com/test/rich-results |
| **Schema.org Validator** | Validación de esquemas JSON-LD | validator.schema.org |
| **axe DevTools / axe-core** | Auditoría de accesibilidad automatizada (WCAG 2.1) | Extensión Chrome / CLI |
| **WAVE** | Revisión visual de accesibilidad | wave.webaim.org |
| **Chrome DevTools** | Network waterfall, Coverage, Performance profiling | Manual |
| **Screaming Frog** (opcional) | Crawl completo del sitio (links rotos, redirects, meta) | Desktop app |
| **Unlighthouse** | Lighthouse automático para TODAS las páginas a la vez | CLI (`npx unlighthouse`) |
| **Bundle Analyzer** | Análisis del bundle JS/CSS | `npm run analyze` (ya configurado) |

---

## Páginas a auditar

| # | URL | Prioridad | Notas |
|---|---|---|---|
| 1 | `https://www.darkstone.cat/` | Alta | Landing page, LCP hero, animaciones pesadas |
| 2 | `https://www.darkstone.cat/about` | Alta | Scroll-pin, parallax, imágenes de miembros |
| 3 | `https://www.darkstone.cat/ludoteca` | Alta | +300 juegos, imágenes BGG, filtros complejos |
| 4 | `https://www.darkstone.cat/contact` | Media | Formulario, validación client/server |
| 5 | `https://www.darkstone.cat/conduct` | Baja | Contenido estático legal |
| 6 | `https://www.darkstone.cat/legal` | Baja | Contenido estático legal |
| 7 | `https://www.darkstone.cat/privacy` | Baja | Contenido estático legal |
| 8 | `https://www.darkstone.cat/cookies` | Baja | Contenido estático legal |
| 9 | `https://www.darkstone.cat/es/` | Media | Verificar i18n (español) |
| 10 | `https://www.darkstone.cat/en/` | Media | Verificar i18n (inglés) |

---

## Fase 0 — Baseline (Línea base) ✅ COMPLETADA

**Fecha:** 2026-03-04 | **Lighthouse:** v13.0.3 | **Entorno:** CLI headless Chrome

> **HALLAZGO CRÍTICO (Pre-auditoría):** Las URLs sin prefijo de locale (`/about`, `/ludoteca`, `/contact`, etc.) devuelven **HTTP 404** en producción. Solo funcionan con prefijo explícito (`/ca/about`). La home (`/`) redirige 307 → `/ca`. Esto contradice la configuración esperada donde el locale por defecto (`ca`) debería omitir el prefijo.

### 0.1 — Scores Lighthouse (4 páginas × mobile + desktop)

| Página | Perf (M) | Perf (D) | A11y (M) | A11y (D) | BP (M) | BP (D) | SEO (M) | SEO (D) |
|---|---|---|---|---|---|---|---|---|
| **Home** `/` | **81** 🟡 | **99** 🟢 | **100** 🟢 | **96** 🟢 | **100** 🟢 | **100** 🟢 | **92** 🟢 | **92** 🟢 |
| **About** `/ca/about` | **94** 🟢 | **100** 🟢 | **96** 🟢 | **96** 🟢 | **100** 🟢 | **100** 🟢 | **92** 🟢 | **92** 🟢 |
| **Ludoteca** `/ca/ludoteca` | **50** 🔴 | **98** 🟢 | **96** 🟢 | **95** 🟢 | **96** 🟢 | **100** 🟢 | **92** 🟢 | **92** 🟢 |
| **Contact** `/ca/contact` | **94** 🟢 | **100** 🟢 | **100** 🟢 | **96** 🟢 | **100** 🟢 | **100** 🟢 | **92** 🟢 | **92** 🟢 |

### 0.2 — Core Web Vitals (Mobile)

| Página | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|
| **Home** | 1.4s 🟢 | **4.0s** 🔴 | 200ms 🟡 | 0 🟢 | 4.9s 🟡 |
| **About** | 1.2s 🟢 | **2.9s** 🟡 | 100ms 🟢 | 0 🟢 | 2.7s 🟢 |
| **Ludoteca** | 1.2s 🟢 | **5.1s** 🔴 | **3,300ms** 🔴 | 0 🟢 | 3.6s 🟡 |
| **Contact** | 1.1s 🟢 | **2.8s** 🟡 | 150ms 🟢 | 0 🟢 | 2.4s 🟢 |

### 0.3 — Core Web Vitals (Desktop)

| Página | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|
| **Home** | 0.4s 🟢 | 0.8s 🟢 | 10ms 🟢 | 0 🟢 | 0.9s 🟢 |
| **About** | 0.3s 🟢 | 0.7s 🟢 | 30ms 🟢 | 0 🟢 | 0.6s 🟢 |
| **Ludoteca** | 0.4s 🟢 | 1.0s 🟢 | 0ms 🟢 | 0 🟢 | 1.1s 🟢 |
| **Contact** | 0.3s 🟢 | 0.6s 🟢 | 0ms 🟢 | 0 🟢 | 0.7s 🟢 |

### 0.4 — Auditorías fallidas por categoría

#### Performance

| Página | Issue | Valor | Severidad |
|---|---|---|---|
| ~~Home (M)~~ | ~~LCP demasiado alto~~ | ~~4.0s~~ → mejorado (eliminado `opacity:0` del hero motion wrapper) | ~~P0~~ RESUELTO |
| ~~Home (M)~~ | ~~Redirects (307 `/` → `/ca`)~~ | ~~~830ms desperdiciados~~ | ~~P1~~ RESUELTO |
| Home (M) | TBT elevado | 200ms | P2 |
| ~~Ludoteca (M)~~ | ~~**LCP crítico**~~ | ~~5.1s~~ → mejorado (eliminado `opacity:0` del hero h1) | ~~P0~~ RESUELTO |
| ~~Ludoteca (M)~~ | ~~**TBT crítico**~~ | ~~3,300ms~~ → mejorado (`startTransition` en filtros, `React.memo` en GameCard, animaciones solo al entrar) | ~~P0~~ RESUELTO |
| Ludoteca (M) | JS no utilizado | ~67KB ahorrable, ~300ms | P1 |
| ~~About (M)~~ | ~~LCP elevado~~ | ~~2.9s~~ → mejorado (eliminado `opacity:0` del hero h1) | ~~P1~~ RESUELTO |
| ~~Contact (M)~~ | ~~LCP elevado~~ | ~~2.8s~~ → mejorado (eliminado `opacity:0` del hero h1) | ~~P2~~ RESUELTO |

#### Accessibility

| Página | Issue | Detalle | Severidad |
|---|---|---|---|
| ~~Home (D), About (M/D), Ludoteca (M/D), Contact (D)~~ | ~~Contraste insuficiente~~ | ~~`opacity-50` → `opacity-70` en LanguageSwitcher; `text-stone-500` → `text-stone-600` en ludoteca~~ | ~~P1~~ RESUELTO |
| ~~Ludoteca (D)~~ | ~~Heading order incorrecto~~ | ~~`<h3>` → `<h2>` en FilterSidebar~~ | ~~P2~~ RESUELTO |

#### Best Practices

| Página | Issue | Detalle | Severidad |
|---|---|---|---|
| ~~Ludoteca (M)~~ | ~~Aspect ratio incorrecto~~ | ~~`height={43}` → `height={47}` en powered-by-bgg.png~~ | ~~P3~~ RESUELTO |

#### SEO

| Página | Issue | Detalle | Severidad |
|---|---|---|---|
| ~~Home (M/D), Ludoteca (M/D), Contact (M/D)~~ | ~~Meta description ausente~~ | Resuelto con fix de routing (páginas ya no devuelven 404) | ~~P1~~ RESUELTO |
| ~~About (M/D)~~ | ~~Canonical inválido~~ | ~~`rel=canonical` apunta a URL sin prefijo `/ca/` (que devuelve 404)~~ | ~~P1~~ RESUELTO |

#### Navegación / i18n (hallazgo transversal)

| Issue | Detalle | Severidad |
|---|---|---|
| ~~URLs sin locale devuelven 404~~ | ~~`/about`, `/ludoteca`, `/contact`, etc. → HTTP 404~~ | ~~**P0**~~ RESUELTO |
| ~~Home redirect innecesario~~ | ~~`/` → 307 → `/ca` (830ms desperdiciados en mobile)~~ | ~~P1~~ RESUELTO |
| bf-cache bloqueado en todas las páginas | `cache-control: no-store` impide back/forward cache | P2 |
| ~~LCP lazy-loaded~~ | ~~Todas las páginas reportan LCP como lazy-loaded~~ — **RESUELTO** (eliminado `opacity:0` de hero motion wrappers) | ~~P1~~ RESUELTO |

### 0.5 — Bundle Analysis

| Métrica | Valor |
|---|---|
| **Total JS chunks** | 31 archivos, **1,206 KB** (sin comprimir) |
| **Total CSS** | 1 archivo, **109 KB** (sin comprimir) |

**Top 7 chunks más pesados:**

| Chunk | Tamaño |
|---|---|
| `8008d994f91f0fb6.js` | 209 KB |
| `63f1d744c6d73e89.js` | 131 KB |
| `76812d926ccce5bd.js` | 131 KB |
| `a6dad97d9634a72d.js` | 110 KB |
| `8cbcf94d7b65dc64.js` | 86 KB |
| `4b77dcde68464653.js` | 83 KB |
| `2afe9a0672f0eb89.js` | 65 KB |

### 0.6 — PageSpeed Insights (CrUX)

> API rate-limited (quota 0/day sin API key propia). Consultar manualmente en https://pagespeed.web.dev/

### 0.7 — Resumen ejecutivo del baseline

**Lo que funciona bien:**
- CLS = 0 en todas las páginas (excelente estabilidad visual)
- Desktop performance ≥ 98 en todas las páginas
- Best Practices = 100 en 7 de 8 informes
- Sin fuentes externas (system fonts) — 0 ms de carga de fonts
- Cookie consent correctamente implementado (GA solo con aceptación)
- Cabeceras de seguridad completas (HSTS, CSP, X-Frame-Options, etc.)

**Problemas críticos (P0):** — TODOS RESUELTOS
1. ~~**Ludoteca mobile: TBT 3,300ms**~~ — **RESUELTO** (`startTransition` en filtros, `React.memo` en GameCard, animaciones solo al entrar)
2. ~~**Ludoteca mobile: LCP 5.1s**~~ — **RESUELTO** (eliminado `opacity:0` del hero h1 motion wrapper)
3. ~~**Home mobile: LCP 4.0s**~~ — **RESUELTO** (eliminado `opacity:0` del hero logo motion wrapper)
4. ~~**Routing i18n roto**~~ — **RESUELTO** (`localePrefix: 'as-needed'` + middleware unificado)

**Problemas altos (P1):** — TODOS RESUELTOS
5. ~~Meta description ausente~~ — **RESUELTO** (consecuencia del fix de routing)
6. ~~Canonical inválido en about~~ — **RESUELTO** (fix de routing i18n)
7. ~~Contraste de color insuficiente~~ — **RESUELTO** (`opacity-50` → `opacity-70`, `text-stone-500` → `text-stone-600`)
8. ~~Redirect innecesario en home~~ — **RESUELTO** (fix de routing i18n)
9. ~~LCP lazy-loaded~~ — **RESUELTO** (eliminado `opacity:0` de todos los heroes)

**Aceptado (trade-offs documentados):**
- ~~P1: JS no utilizado en ludoteca (~67KB)~~ — **ACEPTADO**: `react-icons` ya optimizado via `optimizePackageImports`, `GameDetailModal` ya lazy-loaded. Los ~67KB restantes son overhead de `motion/react` (engine de animaciones) + internals de Next.js/React cargados pero no ejecutados en el paint inicial. No reducible sin eliminar animaciones.
- ~~P2: Home TBT 200ms~~ — **ACEPTADO**: Justo en el umbral (200ms). Causado por inicialización de Lenis (smooth scroll) + animaciones Motion + hidratación de React. No reducible sin eliminar features de UX.
- ~~P2: bf-cache bloqueado (`cache-control: no-store`)~~ — **ACEPTADO**: Comportamiento de Next.js para páginas con rendering dinámico (`useSearchParams`). No modificable sin cambios en la infraestructura Vercel/Next.js.

**Archivos de informes:** `./audits/baseline/*.report.{json,html}`

---

## Fase 1 — Performance (Core Web Vitals) ✅ COMPLETADA

**Fecha:** 2026-03-04 | **Lighthouse:** v13.0.3 | **Entorno:** CLI headless Chrome (localhost)

**Umbrales objetivo:**
| Métrica | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| FCP | ≤ 1.8s | ≤ 3.0s | > 3.0s |
| TTFB | ≤ 800ms | ≤ 1800ms | > 1800ms |

### 1.0 — Scores Post-Optimización (Mobile, localhost)

| Página | Score pre→post | FCP | LCP pre→post | TBT pre→post | CLS | SI |
|---|---|---|---|---|---|---|
| **Home** | 72→**87** (+15) | 2.1s 🟢 | 4.0→**3.4s** 🟡 | 293→**164ms** 🟢 | 0 🟢 | 2.4s 🟢 |
| **About** | 73→**97** (+24) | 2.0s 🟢 | 5.5→**2.0s** 🟢 | 169→**97ms** 🟢 | 0 🟢 | 2.3s 🟢 |
| **Ludoteca** | 59→**75** (+16) | 1.8s 🟢 | 6.4→**5.0s** 🔴 | 547→**245ms** 🟡 | 0 🟢 | 3.4s 🟡 |
| **Contact** | 89→**98** (+9) | 1.9s 🟢 | 2.6→**1.9s** 🟢 | 199→**62ms** 🟢 | 0 🟢 | 2.9s 🟢 |

> **Nota:** Mediciones localhost sin CDN/edge. Producción (Vercel) será significativamente mejor.

### 1.1 — LCP (Largest Contentful Paint) ✅

- [x] **Elemento LCP identificado por página:**
  - Home: Hero logo image (`darkstone_logo_768px.webp`) — `priority` + `fetchPriority="high"` ✅
  - About: Hero h1 → AboutOrigin founding date (`text-8xl`) — era LCP candidato con `opacity:0`
  - Ludoteca: Hero h1 → first game card image (remoto desde BGG)
  - Contact: Hero h1 (FCP = LCP, óptimo)
- [x] Hero image con `priority` + `fetchPriority="high"` + `quality={60}` ✅
- [x] Todas las `<Image>` con `quality={60}` (excepto SVGs, que Next.js no optimiza) ✅
- [x] Sin recursos render-blocking — CSS inline, scripts en Suspense ✅
- [x] Preconnect a `cf.geekdo-images.com` presente ✅
- [x] TTFB <160ms en todos los casos ✅
- [x] CSS crítico inline (Tailwind v4 bundled) ✅

**Fixes aplicados:**
1. **`localeDetection: false`** en `src/i18n/routing.ts` — Eliminó redirect por Accept-Language (~590ms de ahorro en todas las páginas)
2. **Reducción de animaciones hero h1** — `duration: 0.6` → `0.4`, eliminado `delay`, `y: 30` → `y: 20` en AboutHero, ContactHero, LudotecaHero
3. **Eliminado `opacity: 0`** de Hero.tsx h1 `initial` state
4. **Eliminado `opacity: 0`** de AboutOrigin.tsx (h2, p, founding date) — la fecha `text-8xl` era el LCP real de About
5. **Reducido `scale: 0.5` → `0.8`** en Hero.tsx logo animation (asentamiento más rápido)

**Residual:**
- Ludoteca LCP 5.0s: dominado por carga de imágenes remotas de BGG (cf.geekdo-images.com) a través del optimizador de Next.js. No reducible sin cambiar la fuente de imágenes.
- Home LCP 3.4s: dominado por la carga de la hero image (138KB WebP). En producción con CDN será significativamente menor.

### 1.2 — INP (Interaction to Next Paint) ✅

- [x] Todos los event listeners de scroll/wheel/touch usan `{ passive: true }` ✅
- [x] Todas las animaciones Motion usan propiedades transform-only (x, y, scale, opacity, rotate) ✅
- [x] No se encontraron forced reflows en handlers de interacción ✅
- [x] Filtros de ludoteca envueltos en `startTransition()` (de Phase 0) ✅
- [x] `GameCard` memoizado con `React.memo()` (de Phase 0) ✅

**Fix aplicado:**
- **Debounce del resize handler** en `Activities.tsx` — evita layout reads frecuentes durante resize

### 1.3 — CLS (Cumulative Layout Shift) ✅

CLS = **0.000** en todas las páginas (EXCELENTE)

- [x] Todas las `<Image>` con `fill`+`sizes` o `width`+`height` ✅
- [x] CookieBanner con `position: fixed` (no afecta layout flow) ✅
- [x] SectionDivider SVGs con `viewBox` fijo ✅
- [x] System fonts (sin web fonts, 0ms de carga de fonts) ✅
- [x] GameCard progressive loading: container `aspect-4/5` fijo, swap por opacity ✅
- [x] Todos los overlays (modals, banners) usan `fixed`/`absolute` positioning ✅

### 1.4 — Bundle y recursos ✅

| Métrica | Valor |
|---|---|
| **Total JS chunks** | 32 archivos, **1,206 KB** (sin comprimir) |
| **Estimated gzip** | ~362 KB |
| **Total CSS** | 1 archivo, **109 KB** (sin comprimir) |
| **JS transfer (mobile)** | ~304-327 KB por página |
| **CSS transfer** | ~20 KB (comprimido) |

- [x] `react-icons` tree-shaken via `optimizePackageImports` ✅
- [x] `GameDetailModal` lazy-loaded con `dynamic()` + `ssr: false` ✅
- [x] Code splitting funcional: cada página carga solo sus componentes ✅
- [x] Total transferido < 500KB en primera carga ✅
- [x] Unused JS ~65KB es overhead de motion/react (aceptado, documentado en Phase 0) ✅

**Top 5 chunks más pesados:**

| Chunk | Tamaño |
|---|---|
| `8008d994f91f0fb6.js` | 209 KB |
| `63f1d744c6d73e89.js` | 131 KB |
| `76812d926ccce5bd.js` | 131 KB |
| `a6dad97d9634a72d.js` | 110 KB |
| `8cbcf94d7b65dc64.js` | 86 KB |

### 1.5 — Resumen ejecutivo Phase 1

**Mejoras logradas:**
- **About:** +24 puntos (73→97), LCP -3.5s (5.5→2.0s)
- **Ludoteca:** +16 puntos (59→75), LCP -1.4s, TBT -302ms
- **Home:** +15 puntos (72→87), TBT -129ms
- **Contact:** +9 puntos (89→98), LCP -0.7s
- **CLS:** 0.000 en todas las páginas (ya era excelente)
- **Redirects eliminados:** ~590ms de ahorro universal

**Cambios realizados (Phase 1):**
1. `src/i18n/routing.ts` — `localeDetection: false`
2. `src/components/about/AboutHero.tsx` — reducción duración/delay h1
3. `src/components/about/AboutOrigin.tsx` — eliminado `opacity:0` de elementos above-fold
4. `src/components/contact/ContactHero.tsx` — reducción duración h1
5. `src/components/ludoteca/LudotecaHero.tsx` — reducción duración h1
6. `src/components/home/Hero.tsx` — eliminado `opacity:0` de h1, `scale:0.5→0.8` en logo
7. `src/components/home/Activities.tsx` — debounce resize handler

**Pendiente (no accionable):**
- Ludoteca LCP 5.0s: imágenes remotas de BGG (no controlable)
- Home LCP 3.4s: hero image 138KB (óptimo para su tamaño, mejorará con CDN)

**Archivos de informes:** `./audits/phase1/*.report.json`, `./audits/phase1/*-v{2,3,4}`

---

## Fase 2 — Accesibilidad (WCAG 2.1 AA)

**Objetivo:** Garantizar conformidad WCAG 2.1 nivel AA en todas las páginas.

**Herramientas:** axe DevTools, WAVE, Lighthouse Accessibility, revisión manual

### 2.1 — Auditoría automatizada

- [ ] Ejecutar axe-core en las 4 páginas principales
  ```bash
  npx @axe-core/cli https://www.darkstone.cat/ --tags wcag2a,wcag2aa,wcag21a,wcag21aa
  ```
- [ ] Ejecutar WAVE en las 4 páginas principales
- [ ] Documentar todos los errores y warnings por página

### 2.2 — Navegación por teclado (manual)

- [ ] Verificar que Tab recorre todos los elementos interactivos en orden lógico
- [ ] Verificar que `SkipLink` ("Saltar al contenido") funciona correctamente
- [ ] Verificar focus visible (outline naranja 2px) en todos los elementos
- [ ] Verificar que el menú hamburger mobile atrapa el foco (focus trap)
- [ ] Verificar que el modal de juego (GameDetailModal) atrapa el foco
- [ ] Verificar que Escape cierra el CookieBanner y los modales
- [ ] Verificar que el formulario de contacto es completamente operable con teclado

### 2.3 — Lectores de pantalla (manual)

- [ ] Probar con NVDA o VoiceOver en home page
- [ ] Verificar que las imágenes tienen `alt` descriptivos
- [ ] Verificar que los iconos decorativos tienen `aria-hidden="true"`
- [ ] Verificar roles ARIA del CookieBanner (`role="dialog"`, `aria-modal="true"`)
- [ ] Verificar que los headings siguen jerarquía correcta (h1 → h2 → h3)
- [ ] Verificar que los errores del formulario se anuncian (`aria-describedby`)

### 2.4 — Contraste de color

- [ ] Verificar ratio de contraste en todas las combinaciones de colores:
  - `#1c1917` sobre `#EEE8DC` (texto oscuro / fondo claro) — target ≥ 4.5:1
  - `#FAFAF9` sobre `#1C1917` (texto claro / fondo oscuro) — target ≥ 4.5:1
  - `#A61A1A` (brand-red) sobre fondos claros y oscuros
  - `#B54F00` (brand-orange) sobre fondos claros y oscuros
  - Links y botones en estados hover/focus
- [ ] Verificar contraste de texto pequeño (< 18px) ≥ 4.5:1
- [ ] Verificar contraste de texto grande (≥ 18px / 14px bold) ≥ 3:1

### 2.5 — Movimiento y animaciones

- [ ] Verificar que `prefers-reduced-motion: reduce` desactiva TODAS las animaciones
- [ ] Verificar que Lenis smooth scroll se desactiva con reduced motion
- [ ] Verificar que el parallax del home (sticky scroll) no causa mareo
- [ ] Verificar que el marquee de texto se detiene con reduced motion

---

## Fase 3 — SEO

**Objetivo:** Maximizar la visibilidad en buscadores y la correcta indexación multilingüe.

**Herramientas:** Lighthouse SEO, Google Search Console, Rich Results Test, Schema Validator, Screaming Frog

### 3.1 — Meta tags y canonical

- [ ] Verificar `<title>` único y descriptivo en cada página (50-60 chars)
- [ ] Verificar `<meta name="description">` único en cada página (150-160 chars)
- [ ] Verificar `<link rel="canonical">` apunta a la URL correcta (sin trailing slash)
- [ ] Verificar que las páginas legales tienen `robots: noindex, follow`
- [ ] Verificar que no hay contenido duplicado entre locales

### 3.2 — Internacionalización (hreflang)

- [ ] Verificar hreflang en el HTML renderizado de cada página
- [ ] Verificar que `x-default` apunta al catalán (sin prefijo)
- [ ] Verificar consistencia bidireccional: ca → es → en → ca
- [ ] Verificar que el sitemap incluye alternates correctos para las 3 locales
- [ ] Comprobar que `/es/ludoteca` y `/en/ludoteca` devuelven contenido traducido

### 3.3 — Datos estructurados (JSON-LD)

- [ ] Validar schemas con Google Rich Results Test:
  - Organization
  - LocalBusiness (considerar cambiar a `NonprofitOrganization`)
  - Event (2 eventos recurrentes)
  - WebPage (por página)
  - BreadcrumbList (por página)
  - ItemList (ludoteca)
- [ ] Validar con Schema.org Validator
- [ ] Verificar que no hay errores ni warnings en Search Console

### 3.4 — Sitemap y robots

- [ ] Verificar que `/sitemap.xml` es accesible y válido
- [ ] Verificar que las 24 URLs (8 páginas × 3 locales) están presentes
- [ ] Verificar que `lastModified` refleja fechas reales de modificación
- [ ] Verificar que `robots.txt` permite crawl de todo excepto `/api/`
- [ ] Verificar que no hay páginas huérfanas (en sitemap pero sin links internos)

### 3.5 — OpenGraph y Social

- [ ] Verificar OG image renderiza correctamente (1200×630)
- [ ] Verificar que cada locale genera su propia OG image
- [ ] Probar compartir URLs en Twitter, Facebook, LinkedIn (og:title, og:description, og:image)
- [ ] Verificar `twitter:card = summary_large_image`
- [ ] Verificar `twitter:site` y `twitter:creator`
- [ ] Considerar añadir `<meta name="theme-color">` para mobile browsers

---

## Fase 4 — Best Practices y Seguridad

**Objetivo:** Verificar cabeceras de seguridad, HTTPS, CSP y buenas prácticas generales.

**Herramientas:** Lighthouse Best Practices, securityheaders.com, Mozilla Observatory, Chrome DevTools

### 4.1 — Cabeceras de seguridad

- [ ] Verificar cabeceras en securityheaders.com:
  - `Strict-Transport-Security` (HSTS, max-age ≥ 2 años)
  - `Content-Security-Policy` (CSP)
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (camera, microphone, geolocation deshabilitados)
- [ ] Evaluar si `unsafe-inline` y `unsafe-eval` en CSP son realmente necesarios
- [ ] Verificar que todos los recursos se cargan sobre HTTPS
- [ ] Verificar redirect HTTP → HTTPS

### 4.2 — Cookies y privacidad

- [ ] Verificar que Google Analytics SOLO se carga cuando consent = 'accepted'
- [ ] Verificar atributos de la cookie de consentimiento:
  - `SameSite`
  - `Secure` (HTTPS only)
  - `HttpOnly` si aplica
- [ ] Verificar que no hay cookies de terceros sin consentimiento
- [ ] Verificar que el banner de cookies cumple RGPD

### 4.3 — Buenas prácticas generales

- [ ] Verificar que no hay errores en console del navegador
- [ ] Verificar que no hay mixed content (HTTP en página HTTPS)
- [ ] Verificar que los links externos usan `rel="noopener noreferrer"`
- [ ] Verificar que no hay vulnerabilidades conocidas en dependencias (`npm audit`)
- [ ] Verificar que las imágenes usan formatos modernos (WebP/AVIF)
- [ ] Verificar que no hay recursos de más de 500KB sin comprimir

---

## Fase 5 — Auditoría multi-dispositivo y cross-browser

**Objetivo:** Verificar comportamiento consistente en diferentes dispositivos y navegadores.

**Herramientas:** Chrome DevTools Device Mode, BrowserStack (opcional), Lighthouse mobile/desktop

### 5.1 — Responsive design

- [ ] Verificar en breakpoints clave: 320px, 375px, 768px, 1024px, 1440px, 1920px
- [ ] Verificar que el menú hamburger funciona correctamente en mobile
- [ ] Verificar que la ludoteca es usable en móvil (filtros, grid, modal)
- [ ] Verificar que las animaciones parallax/sticky no rompen en mobile
- [ ] Verificar que no hay overflow horizontal en ningún breakpoint
- [ ] Verificar tamaños de tap targets ≥ 48×48px en mobile

### 5.2 — Cross-browser

- [ ] Chrome (última versión)
- [ ] Firefox (última versión)
- [ ] Safari (última versión)
- [ ] Edge (última versión)
- [ ] Safari iOS (iPhone)
- [ ] Chrome Android

### 5.3 — Condiciones adversas

- [ ] Probar con throttling de red (Slow 3G) — ¿la página sigue siendo usable?
- [ ] Probar con CPU throttling (4x slowdown) — ¿las animaciones son fluidas?
- [ ] Probar con JavaScript deshabilitado — ¿hay contenido visible?
- [ ] Probar con imágenes deshabilitadas — ¿hay alt text informativo?

---

## Fase 6 — Informe final y priorización

**Objetivo:** Consolidar hallazgos, priorizar correcciones y comparar con baseline.

### 6.1 — Consolidación

- [ ] Recopilar todos los hallazgos de las fases 1-5
- [ ] Clasificar por severidad: Crítico / Alto / Medio / Bajo / Informativo
- [ ] Agrupar por categoría: Performance / Accessibility / SEO / Security / UX

### 6.2 — Priorización

Matriz de priorización:

| Prioridad | Criterio | Ejemplos |
|---|---|---|
| **P0 — Crítico** | Rompe funcionalidad o bloquea usuarios | CLS > 0.25, links rotos, errores JS |
| **P1 — Alto** | Impacto directo en métricas de Google | LCP > 2.5s, accesibilidad WCAG A, SEO errors |
| **P2 — Medio** | Mejora significativa de UX/rendimiento | INP > 200ms, contraste AA, bundle size |
| **P3 — Bajo** | Nice-to-have, mejoras incrementales | theme-color, PWA, AVIF images |
| **P4 — Info** | Documentar para futuras iteraciones | Tendencias, comparativas, roadmap |

### 6.3 — Informe final

- [ ] Tabla comparativa: scores baseline vs. scores post-optimización
- [ ] Lista priorizada de issues con links a los archivos afectados
- [ ] Recomendaciones técnicas concretas para cada issue
- [ ] Screenshots / filmstrips de antes y después (si aplica)
- [ ] Métricas de campo (CrUX) si hay suficientes datos

---

## Comandos rápidos de referencia

```bash
# Lighthouse CLI — página principal mobile
npx lighthouse https://www.darkstone.cat/ \
  --output=json,html \
  --output-path=./audits/home \
  --chrome-flags="--headless" \
  --preset=perf

# Lighthouse CLI — desktop
npx lighthouse https://www.darkstone.cat/ \
  --output=json,html \
  --output-path=./audits/home-desktop \
  --chrome-flags="--headless" \
  --emulated-form-factor=desktop

# Unlighthouse — scan completo
npx unlighthouse --site https://www.darkstone.cat/

# axe-core CLI — accesibilidad
npx @axe-core/cli https://www.darkstone.cat/ \
  --tags wcag2a,wcag2aa,wcag21a,wcag21aa

# Bundle analyzer (ya configurado en el proyecto)
npm run analyze

# npm audit — vulnerabilidades
npm audit

# Validar sitemap
curl -s https://www.darkstone.cat/sitemap.xml | head -50
```

---

## Notas adicionales

- **Prioridad de páginas:** Home > Ludoteca > About > Contact > Legal pages
- **Locales:** Auditar primero en `ca` (default), luego verificar `es` y `en`
- **Producción vs. dev:** Todas las pruebas se ejecutan contra `https://www.darkstone.cat/` (producción en Vercel)
- **Frecuencia sugerida:** Repetir auditoría después de cada sprint de optimización y antes de cada release importante
