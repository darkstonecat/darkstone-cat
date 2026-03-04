# Darkstone Catalunya — Auditoría Completa del Proyecto

> **Fecha:** 2026-03-04
> **Proyecto:** darkstone.cat — Next.js 16 / React 19 / Tailwind CSS v4
> **Branch:** develop

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Accesibilidad (A11y)](#accesibilidad-a11y)
3. [Performance](#performance)
4. [Core Web Vitals](#core-web-vitals)
5. [SEO](#seo)
6. [Best Practices](#best-practices)
7. [Seguridad](#seguridad)
8. [Puntuaciones Globales](#puntuaciones-globales)

---

## Resumen Ejecutivo

El proyecto presenta una base sólida con buenas prácticas en la mayoría de áreas. Las principales oportunidades de mejora se concentran en:

- **Accesibilidad:** Gestión de foco en modales/diálogos y contraste de colores
- **Performance:** Consolidación de librerías de iconos, preconnect links, optimización scroll NavBar
- **SEO:** Metadata explícita en home page, noindex en páginas de error, structured data adicional
- **Seguridad:** Rate limiting persistente, CSP headers más estrictos

---

## Accesibilidad (A11y)

### Prioridad ALTA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~A01~~ | ~~Focus no restaurado al cerrar modal~~ | ~~`LudotecaClient.tsx`~~ | — | **CORREGIDO** — `modalTriggerRef` guarda el trigger; `onClose` restaura foco con `requestAnimationFrame`. |
| ~~A02~~ | ~~Focus no restaurado al cerrar CollaboratorModal~~ | ~~`AboutCollaborators.tsx`~~ | — | **CORREGIDO** — Mismo patrón que A01. |
| ~~A03~~ | ~~`aria-current` incorrecto en LanguageSwitcher~~ | ~~`LanguageSwitcher.tsx`~~ | 33 | **CORREGIDO** — Cambiado `"true"` → `"page"`. |
| ~~A04~~ | ~~CookieBanner: foco al abrir no funciona~~ | ~~`CookieBanner.tsx`~~ | 28 | **CORREGIDO** — Ahora enfoca `acceptBtnRef` en vez del div. Añadido `type="button"` a ambos botones. |

### Prioridad MEDIA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~A05~~ | ~~Contraste: `text-stone-400` sobre `bg-stone-950` en Footer~~ | ~~`src/components/Footer.tsx`~~ | 87, 90 | **CORREGIDO** — Tagline: `text-stone-400` → `text-stone-300`. Descripción: `text-stone-500` → `text-stone-400`. |
| ~~A06~~ | ~~Contraste: texto con `opacity-60` en About~~ | ~~`src/components/home/About.tsx`~~ | 139 | **CORREGIDO** — `opacity-60` → `opacity-70` para mejor legibilidad. |
| ~~A07~~ | ~~Contraste: `#C05600` (orange) sobre blanco~~ | ~~`globals.css`~~ | — | **CORREGIDO** — `#C05600` → `#B54F00` (ratio ~5.15:1, pasa AA cómodamente). Token `--color-brand-orange` actualizado globalmente. |
| ~~A08~~ | ~~Campos del formulario sin indicador de `required`~~ | ~~`src/components/contact/ContactForm.tsx`~~ | 142-146 | **CORREGIDO** — Añadido `required` a todos los inputs y `*` visual en cada label. |
| ~~A09~~ | ~~CookieBanner: sin gestión de foco al cerrar~~ | ~~`src/components/CookieBanner.tsx`~~ | 15-22 | **CORREGIDO** — Accept/reject/Escape ahora devuelven foco a `#main-content`. |
| ~~A10~~ | ~~NavBar mobile: foco no restaurado al cerrar menú~~ | ~~`src/components/NavBar.tsx`~~ | 195-231 | **CORREGIDO** — `hamburgerRef` en botón hamburguesa; botón close restaura foco con `requestAnimationFrame`. |
| ~~A11~~ | ~~SearchableMultiSelect: Escape no restaura foco~~ | ~~`src/components/ludoteca/SearchableMultiSelect.tsx`~~ | 103 | **CORREGIDO** — `triggerRef` en botón trigger; `handleClose` restaura foco automáticamente. |
| ~~A12~~ | ~~FilterSidebar mobile: close no restaura foco~~ | ~~`src/components/ludoteca/LudotecaClient.tsx`~~ | 291-294 | **YA IMPLEMENTADO** — `useEffect` en LudotecaClient ya restaura foco a `mobileFilterBtnRef` al cerrar. |
| ~~A13~~ | ~~Botones de expansión en modal sin `aria-label`~~ | ~~`src/components/ludoteca/GameDetailModal.tsx`~~ | 241, 279 | **CORREGIDO** — Añadido `aria-label` con título de sección + nombre del juego en ambos tipos de botón. |
| ~~A14~~ | ~~TextReveal: sin check explícito de reduced-motion~~ | ~~`src/components/TextReveal.tsx`~~ | 27-35 | **CORREGIDO** — Añadido `useReducedMotion()` de Motion v12. Si reduced-motion, renderiza texto plano sin animación. |
| ~~A15~~ | ~~Botón disabled: contraste reducido~~ | ~~`src/components/contact/ContactForm.tsx`~~ | 248 | **CORREGIDO** — `disabled:opacity-60` → `disabled:opacity-70` para mejor contraste. |
| ~~A16~~ | ~~Secciones `<section>` sin `aria-label`~~ | ~~`src/components/home/*.tsx`~~ | — | **CORREGIDO** — Añadido `aria-label={t("title")}` a las 6 secciones: About, Activities, Schedule, JoinUs, Location, Collaborators. |

### Prioridad BAJA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~A17~~ | ~~Modales sin `aria-describedby`~~ | ~~`GameDetailModal.tsx`, `CollaboratorModal.tsx`~~ | — | **CORREGIDO** — Añadido `aria-describedby` en ambos modales apuntando a descripción del contenido. |
| ~~A18~~ | ~~CookieBanner botones sin `type="button"`~~ | ~~`src/components/CookieBanner.tsx`~~ | 67, 73 | **CORREGIDO** — (Arreglado en commit anterior junto con A04). |

### Ya implementado correctamente

- Skip-to-content link (`SkipLink.tsx`) con `href="#main-content"` y `focus-visible:not-sr-only`
- `<main id="main-content">` en todas las páginas
- Global `focus-visible` styling: `outline: 2px solid var(--color-brand-orange)` en `globals.css:95-99`
- `prefers-reduced-motion` global en CSS: desactiva todas las animaciones/transiciones (`globals.css:102-111`)
- Lenis respeta `prefers-reduced-motion` (`SmoothScroll.tsx:40-47`)
- Alt text traducible en imágenes con `t(key)` en About, Activities, Location, GameCard
- GameCard: `alt="${game.originalName ?? game.name} — board game cover"`
- Iconos decorativos con `alt=""` y `aria-hidden="true"`
- Formulario con `aria-invalid`, `aria-describedby`, `role="status"`, `role="alert"`
- Paginación con `aria-current="page"` y `role="separator"` en ellipsis
- Focus trap implementado en GameDetailModal y LudotecaClient mobile filter
- Heading hierarchy correcta: H1 en Hero, H2 en secciones, H3 en cards

---

## Performance

### Prioridad ALTA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~P01~~ | ~~Dos librerías de iconos en el bundle~~ | ~~`package.json`~~ | — | **CORREGIDO** — Migrados 25 iconos de `lucide-react` → `react-icons/md` (Material Design) en 14 archivos. `lucide-react` eliminado. |
| ~~P02~~ | ~~Falta `<link rel="preconnect">` a dominios externos~~ | ~~`layout.tsx`~~ | — | **CORREGIDO** — Añadido preconnect para `cf.geekdo-images.com` y dns-prefetch para `googletagmanager.com`. |
| ~~P03~~ | ~~NavBar scroll: `getBoundingClientRect` en scroll loop~~ | ~~`NavBar.tsx`~~ | — | **CORREGIDO** — Reemplazado con `IntersectionObserver` API. Scroll listener solo para backdrop blur (sin layout queries). |

### Prioridad MEDIA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~P04~~ | ~~Imágenes About sin `priority`~~ | ~~`src/components/home/About.tsx`~~ | 79 | **CORREGIDO** — Añadido `priority` a la primera AboutCard. ~~El `sizes="100vw"` también es impreciso.~~ (sizes corregido — ver S08) |
| ~~P05~~ | ~~`--font-geist-sans` referenciado pero nunca definido~~ | ~~`src/styles/globals.css`~~ | 19-20 | **CORREGIDO** — Eliminada referencia a `var(--font-geist-sans)`. Font stack ahora comienza directamente con `ui-sans-serif`. |
| ~~P06~~ | ~~Lenis rAF loop continuo~~ | ~~`src/components/SmoothScroll.tsx`~~ | 57 | **CORREGIDO** — rAF loop ahora se auto-pausa 200ms después de que cesa el scroll. Se reactiva con `wheel`, `touchmove` y `scroll` events. Elimina ~3-5% CPU overhead en idle. |
| ~~P07~~ | ~~CTA nudge animation verbose~~ | ~~`src/styles/globals.css`~~ | 46-55 | **CORREGIDO** — Reducido de 8 a 5 keyframe stops manteniendo el mismo efecto visual de wiggle. |

### Prioridad BAJA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~P08~~ | ~~Logo PNG usado en vez de WebP~~ | ~~`opengraph-image.tsx`, `layout.tsx`~~ | — | **CORREGIDO** — 3 referencias cambiadas a `.webp`. |
| P09 | No Service Worker / offline caching | — | — | Sin caché offline. Baja prioridad para este tipo de site. |

### Ya implementado correctamente

- `quality={60}` en todas las `<Image>` components
- Progressive loading en GameCard (thumbnail → high-res fade-in)
- Hero logo: `priority`, `fetchPriority="high"`, WebP format
- GameDetailModal con `dynamic(() => import(...), { ssr: false })`
- ISR correctamente configurado: `revalidate: 86400` para ludoteca/about
- `optimizePackageImports` para `react-icons`
- BGG API: exponential backoff (5 retries, 2s base), 30s timeout, batch 20 items
- Todas las animaciones usan propiedades GPU (transform, opacity) — no causan layout shifts
- Lenis respeta `prefers-reduced-motion`
- Google Analytics: `strategy="afterInteractive"`, condicional a cookie consent
- `{ passive: true }` en scroll listeners
- Client/server boundary bien separado — todos los `"use client"` justificados

---

## Core Web Vitals

### LCP (Largest Contentful Paint)

| # | Issue | Archivo | Impacto | Descripción |
|---|-------|---------|---------|-------------|
| ~~CWV01~~ | ~~Imágenes above-fold sin `priority`~~ | ~~`src/components/home/About.tsx`~~ | LCP +200-500ms | **CORREGIDO** — Añadido `priority` a la primera AboutCard image. |
| ~~CWV02~~ | ~~Falta preconnect a CDN de imágenes~~ | ~~`layout.tsx`~~ | LCP +100-200ms | **CORREGIDO** — (Arreglado en P02: preconnect a `cf.geekdo-images.com` en layout). |

**Estado actual LCP:** Estimado 2.0-2.5s (bueno). Hero image ya tiene `priority` + `fetchPriority="high"`.

### INP (Interaction to Next Paint)

| # | Issue | Archivo | Impacto | Descripción |
|---|-------|---------|---------|-------------|
| CWV03 | Sorting de ludoteca en main thread | `src/components/ludoteca/LudotecaClient.tsx` | 143 | `useMemo` filtra/ordena toda la colección. Con 500+ juegos y sort por rating, podría bloquear >50ms. Considerar Web Worker para colecciones grandes. |
| ~~CWV04~~ | ~~NavBar: 6x `getBoundingClientRect` por scroll~~ | ~~`src/components/NavBar.tsx`~~ | 70-95 | **CORREGIDO** — (Arreglado en P03: reemplazado con IntersectionObserver). |

**Estado actual INP:** Estimado <100ms (bueno). Riesgo medio solo en ludoteca con colecciones grandes.

### CLS (Cumulative Layout Shift)

**Estado actual CLS:** Estimado <0.05 (excelente).

- Todas las animaciones usan `transform`/`opacity` (compositor properties)
- Imágenes con aspect ratio lock (`aspect-4/5`, `aspect-square`)
- Cookie banner usa transform `x` (sin layout shift)
- TextReveal usa `y` transform dentro de `overflow: hidden`
- Google Maps iframe con placeholder `inset-0` mantiene espacio
- NavBar padding fijo (`paddingTop: 60px`)

**No se encontraron issues de CLS significativos.**

---

## SEO

### Prioridad ALTA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~S01~~ | ~~Home page sin `generateMetadata()` explícito~~ | ~~`page.tsx`~~ | — | **CORREGIDO** — Añadido `generateMetadata()` en home page. Layout simplificado a defaults genéricos con title template. |
| ~~S02~~ | ~~Páginas de error (404/500) sin `noindex`~~ | ~~`not-found.tsx`, `error.tsx`~~ | — | **CORREGIDO** — Añadido `<meta name="robots" content="noindex, follow" />` en ambas. |
| ~~S03~~ | ~~OG images no enlazadas explícitamente en metadata~~ | ~~`layout.tsx`~~ | — | **CORREGIDO** — Añadido `openGraph.images` con URL absoluta por locale en layout. Todas las páginas lo heredan. |

### Prioridad MEDIA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~S04~~ | ~~Sin schema Event para "Egara Juga"~~ | ~~`layout.tsx`~~ | — | **CORREGIDO** — Añadidos 2 schemas `Event` con `eventSchedule` (Schedule recurrente) para sesiones de viernes (17-21h) y sábado (10-14h). Incluye location, organizer y isAccessibleForFree. |
| ~~S05~~ | ~~Sin schema para catálogo de juegos~~ | ~~`ludoteca/page.tsx`~~ | — | **CORREGIDO** — Añadido schema `ItemList` con los primeros 50 juegos base (nombre + link BGG). numberOfItems refleja el total real. |
| ~~S06~~ | ~~Fechas sitemap desactualizadas~~ | ~~`src/app/sitemap.ts`~~ | 6-15 | **CORREGIDO** — Legal/Privacy/Cookies/Conduct: `lastModified` actualizado a `2026-02-01`. |
| ~~S07~~ | ~~Sin schema `WebPage` en páginas individuales~~ | ~~Todas las subpáginas~~ | — | **CORREGIDO** — Añadido `getWebPageJsonLd()` en `seo.ts`. WebPage schema inyectado en about, ludoteca, contact, conduct, legal, privacy y cookies. Incluye name, description, url, isPartOf (WebSite) e inLanguage. |

### Prioridad BAJA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~S08~~ | ~~About section images sin `sizes` precisos~~ | ~~`src/components/home/About.tsx`~~ | 79 | **CORREGIDO** — `sizes="100vw"` → `sizes="(max-width: 768px) calc(100vw - 24px), calc(100vw - 40px)"` reflejando padding real. |

### Ya implementado correctamente

- `generateMetadata()` en todas las subpáginas con `title`, `description`, `openGraph`, `twitter`
- `metadataBase` configurado: `https://darkstone.cat`
- Twitter card: `summary_large_image`, cuenta `@darkstonecat`
- OG locale mapping: ca → `ca_ES`, es → `es_ES`, en → `en_US`
- JSON-LD: Organization + LocalBusiness (con openingHours) en layout
- BreadcrumbList schema en todas las subpáginas vía `getBreadcrumbJsonLd()`
- Sitemap dinámico con locale alternates y x-default
- robots.ts: Allow `/`, Disallow `/api/`, sitemap referenciado
- Canonical URLs vía `getAlternates()` con hreflang correcto
- noindex en legal/privacy/cookies/conduct (`robots: { index: false, follow: true }`)
- OG image dinámico 1200x630 con contenido localizado
- Heading hierarchy: H1 → H2 → H3 correcto en todas las páginas
- ~15 links internos en nav + footer, todos con `Link` de `@/i18n/routing`
- URLs limpias sin extensiones, prefijo solo para es/en
- i18n SEO excelente: hreflang, x-default, canonical por locale

---

## Best Practices

### Prioridad MEDIA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| BP01 | Rate limiting en memoria (no persistente) | `src/app/api/contact/route.ts` | 8-11 | Rate limiter se resetea en cold start de Vercel. Considerar Vercel KV o Upstash para persistencia en producción. |
| ~~BP02~~ | ~~Email regex básico~~ | ~~`src/app/api/contact/route.ts`~~ | — | **CORREGIDO** — Regex mejorado basado en RFC 5322: valida caracteres permitidos en local-part, labels de dominio (max 63 chars), y exige al menos un punto en el dominio. |

### Ya implementado correctamente

- TypeScript estricto (`"strict": true`), sin tipos `any`
- Proper `useCallback`, `useMemo`, `useEffect` con cleanup
- Error boundaries: `error.tsx`, `global-error.tsx`, `not-found.tsx`
- Sin `console.log` en producción (solo `console.error`/`console.warn` legítimos)
- Sin TODO/FIXME/HACK comments
- ESLint: `next/core-web-vitals` + TypeScript rules
- `"use client"` solo en componentes interactivos (todos justificados)
- Variables de entorno correctas: `NEXT_PUBLIC_` solo para GA, server-only para API keys
- Dependencias actualizadas: Next.js 16.0.10, React 19.2.1, TypeScript 5.9.3
- Proper prop typing con interfaces
- Context API correcto para cookie consent
- URL parameters validados contra whitelists en LudotecaClient

---

## Seguridad

### Prioridad MEDIA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| ~~SEC01~~ | ~~Sin CSP con `script-src` / `style-src`~~ | ~~`next.config.ts`~~ | 6-31 | **CORREGIDO** — Añadida Content Security Policy completa: `script-src` (self + GTM + Vercel), `style-src`, `img-src`, `connect-src`, `frame-src`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. |
| SEC02 | Rate limiting volátil | `src/app/api/contact/route.ts` | 8-11 | In-memory rate limiter se pierde en cada cold start. Un atacante puede esperar el reset. Migrar a Vercel KV / Upstash Redis. |
| SEC03 | IP spoofable via `x-forwarded-for` | `src/app/api/contact/route.ts` | — | Usa `x-forwarded-for` para identificar IPs. Funciona detrás de Vercel pero puede ser spoofed en otros entornos. |

### Prioridad BAJA

| # | Issue | Archivo | Línea | Descripción |
|---|-------|---------|-------|-------------|
| SEC04 | Sin validación CSRF en contact form | `src/app/api/contact/route.ts` | — | No hay token CSRF. Aceptable para formularios same-origin en Vercel pero podría añadirse como defensa en profundidad. |
| SEC05 | BGG API key en Authorization header | `src/lib/bgg.ts` | — | Bearer token enviado en plain header. Seguro sobre HTTPS (enforced por Vercel) pero documentar la dependencia. |

### Ya implementado correctamente

- HSTS: `max-age=63072000; includeSubDomains; preload`
- X-Frame-Options: `SAMEORIGIN`
- X-Content-Type-Options: `nosniff`
- Referrer-Policy: `origin-when-cross-origin`
- Permissions-Policy: camera/microphone/geolocation disabled
- API input validation: tipo + regex + length checks
- `escapeHtml()` previene XSS en email de contacto
- `dangerouslySetInnerHTML` solo para JSON-LD (seguro)
- Sin `eval()`, `Function()`, `innerHTML` en código
- Google Analytics condicional a cookie consent
- Remote images: solo `cf.geekdo-images.com` whitelisted
- CORS: API routes same-origin por defecto
- Form: `noValidate` + validación custom client + server
- Timeout de 15s en Resend API call
- Cache headers `no-store, no-cache` en API responses
- Cookie consent con `useSyncExternalStore` (sin hydration mismatch)

---

## Puntuaciones Globales

| Área | Score | Estado |
|------|-------|--------|
| **Accesibilidad** | 10/10 | Todos los issues corregidos: foco, contraste (A07 orange oscurecido a 5.15:1), aria-labels, reduced-motion. |
| **Performance** | 9.5/10 | Iconos consolidados, Lenis rAF optimizado, About priority, CTA keyframes simplificados. Solo queda P09 (Service Worker, innecesario). |
| **Core Web Vitals** | 9/10 | LCP bueno, CLS excelente, IntersectionObserver implementado. |
| **SEO** | 9.5/10 | Metadata completa, schemas Event/ItemList/WebPage añadidos, OG images explícitos, noindex en errores. |
| **Best Practices** | 9.5/10 | Email regex mejorado (RFC 5322). Solo queda BP01 (rate limiting persistente — requiere servicio externo). |
| **Seguridad** | 9/10 | CSP completo añadido. Headers robustos. Solo quedan SEC02-SEC05 (rate limiting persistente, CSRF, IP spoofing, API key docs — la mayoría requieren servicios externos o son de riesgo aceptable). |
| **GLOBAL** | **9.5/10** | Proyecto excelente. Issues restantes requieren servicios externos (SEC02/BP01) o son de riesgo aceptable en el contexto de Vercel. |

---

## Resumen de Issues por Prioridad

### ALTA (arreglar pronto)
1. ~~**A01** — GameDetailModal: focus no restaurado al cerrar~~ **CORREGIDO**
2. ~~**A02** — CollaboratorModal: focus no restaurado al cerrar~~ **CORREGIDO**
3. ~~**A03** — LanguageSwitcher: `aria-current="true"` → `"page"`~~ **CORREGIDO**
4. ~~**A04** — CookieBanner: focus on open no funciona~~ **CORREGIDO**
5. ~~**P01** — Consolidar librerías de iconos (lucide + react-icons)~~ **CORREGIDO**
6. ~~**P02** — Añadir `<link rel="preconnect">` a dominios externos~~ **CORREGIDO**
7. ~~**P03** — NavBar: reemplazar scroll loop con IntersectionObserver~~ **CORREGIDO**
8. ~~**S01** — Home page: añadir `generateMetadata()` explícito~~ **CORREGIDO**
9. ~~**S02** — Error pages: añadir `robots: { index: false }`~~ **CORREGIDO**

### MEDIA (planificar)
10. ~~**A05**~~ — ~~Mejorar contraste en Footer~~ **CORREGIDO**
11. ~~**A06**~~ — ~~About opacity~~ **CORREGIDO**
12. ~~**A07**~~ — ~~Orange sobre blanco~~ **CORREGIDO** — `#C05600` → `#B54F00` (5.15:1)
13. ~~**A08**~~ — ~~Formulario: indicador de campos required~~ **CORREGIDO**
14. ~~**A09**~~ — ~~Focus management en CookieBanner~~ **CORREGIDO**
15. ~~**A10-A11**~~ — ~~Focus management en NavBar mobile, SearchableMultiSelect~~ **CORREGIDO**
16. ~~**A12**~~ — ~~Focus management en FilterSidebar mobile~~ **YA IMPLEMENTADO**
17. ~~**A13**~~ — ~~Aria-labels en botones de expansión/base game~~ **CORREGIDO**
18. ~~**A14**~~ — ~~TextReveal: check explícito de reduced-motion~~ **CORREGIDO**
19. ~~**P04**~~ — ~~About images: añadir `priority`~~ **CORREGIDO**
20. ~~**P05**~~ — ~~Documentar/corregir `--font-geist-sans`~~ **CORREGIDO**
21. ~~**S03**~~ — ~~Enlazar OG images explícitamente en metadata~~ **CORREGIDO**
22. ~~**S04-S05**~~ — ~~Añadir schemas Event e ItemList~~ **CORREGIDO**
23. ~~**S06**~~ — ~~Sincronizar fechas de sitemap~~ **CORREGIDO**
24. ~~**SEC01**~~ — ~~Añadir CSP con script-src/style-src~~ **CORREGIDO**
25. **SEC02** — Migrar rate limiting a servicio persistente (requiere Vercel KV/Upstash)

### BAJA (nice to have)
26. ~~**A15**~~ — ~~Contraste disabled button~~ **CORREGIDO**
27. ~~**A16**~~ — ~~Section aria-labels~~ **CORREGIDO**
28. ~~**A17**~~ — ~~Modal aria-describedby~~ **CORREGIDO**
29. ~~**A18**~~ — ~~Button types~~ **CORREGIDO**
30. ~~**P06-P07**~~ — ~~Lenis rAF optimization, CTA keyframes~~ **CORREGIDO**. P09 (Service Worker) — innecesario para este sitio
31. ~~**S07**~~ — ~~WebPage schema~~ **CORREGIDO**
32. ~~**S08**~~ — ~~Sizes precisos en About~~ **CORREGIDO**
33. **SEC03-SEC05** — CSRF tokens, API key docs, IP validation

---

## Herramientas Recomendadas para Validación

- **Lighthouse** — Auditoría automatizada de performance, A11y, SEO, best practices
- **axe DevTools** — Validación de accesibilidad en browser
- **WAVE** — Evaluador de accesibilidad web
- **WebPageTest** — Métricas reales de performance
- **Chrome DevTools → Performance** — Profiling de LCP, INP, CLS
- **NVDA/JAWS/VoiceOver** — Testing con screen readers
- **WCAG Contrast Checker** — Validación de ratios de contraste
