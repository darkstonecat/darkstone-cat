# Performance Fixes — Darkstone Catalunya

Plan de implementacion organizado por fases segun impacto y esfuerzo.

---

## Fase 1 — Quick Wins (5-10 min cada fix) ✅ COMPLETADA

Cambios minimos con alto impacto. No requieren refactoring.

### 1.1 Generacion estatica en paginas legales ✅

- [x] `src/app/[locale]/conduct/page.tsx`
- [x] `src/app/[locale]/legal/page.tsx`
- [x] `src/app/[locale]/privacy/page.tsx`
- [x] `src/app/[locale]/cookies/page.tsx`

### 1.2 Corregir lastModified del sitemap ✅

- [x] `src/app/sitemap.ts` — Cambiado `new Date()` → `new Date("2025-03-01")`

### 1.3 Estandarizar quality={60} en imagenes ✅

- [x] `src/components/home/About.tsx`
- [x] `src/components/home/Activities.tsx` (desktop + mobile)
- [x] `src/components/home/Location.tsx` (interior + exterior)
- [x] `src/components/NavBar.tsx`
- [x] `src/components/Footer.tsx`
- [x] `src/components/ludoteca/GameListRow.tsx`
- [x] `src/components/ludoteca/GameDetailModal.tsx` (cover + base game + expansion thumbnails)

Nota: SVGs (logos institucionales, BGG logo, Ludoya logo) excluidos — Next.js no optimiza SVGs.

### 1.4 optimizePackageImports en next.config ✅

- [x] `next.config.ts` — Anadido `experimental.optimizePackageImports` para lucide-react y react-icons

### 1.5 Eliminar Zustand de dependencias ✅

- [x] `package.json` — `npm uninstall zustand` ejecutado (confirmado: 0 imports en src/)

---

## Fase 2 — Code Splitting y SSR (15-30 min cada fix) ✅ COMPLETADA

Mejoras de bundle size y rendering server-side.

### 2.1 Dynamic import de modales ✅

- [x] `src/components/ludoteca/LudotecaClient.tsx` — `GameDetailModal` con `dynamic({ ssr: false })`
- [x] `src/components/about/AboutCollaborators.tsx` — `CollaboratorModal` con `dynamic({ ssr: false })`

### 2.2 generateStaticParams para locales ✅

- [x] `src/app/[locale]/layout.tsx` — Usa `routing.locales` de next-intl para generar los 3 locales
- Build ahora pre-genera 29 paginas estaticas (antes 5)

### 2.3 Suspense fallback en Ludoteca ✅

- [x] `src/app/[locale]/ludoteca/page.tsx` — Skeleton inline con toolbar + grid de 12 cards animadas

### 2.4 Convertir paginas legales a Server Components ✅

- [x] `src/components/legal/LegalContent.tsx` — Eliminado `"use client"`
- [x] `src/components/legal/PrivacyContent.tsx` — Eliminado `"use client"`
- [x] `src/components/legal/CookiesContent.tsx` — Eliminado `"use client"`

Nota: `LegalPageContent.tsx` y `ConductContent.tsx` permanecen como client components (usan `useTranslations` + `motion`).

### 2.5 Suspense para providers no criticos en layout ✅

- [x] `src/app/[locale]/layout.tsx` — CookieBanner, GoogleAnalytics, Analytics, SpeedInsights envueltos en `<Suspense>`

---

## Fase 3 — Memoizacion y Re-renders (15-20 min cada fix)

Optimizaciones de runtime React para evitar renders innecesarios.

### 3.1 Memoizar sortOptions en LudotecaClient

**Problema:** Array de opciones de ordenacion recreado en cada render.

**Archivo:**

- [ ] `src/components/ludoteca/LudotecaClient.tsx` (~linea 357)

**Cambio:** Envolver en `useMemo`:

```typescript
const sortOptions = useMemo(() => [
  { value: "name-asc", label: t("sort_name_asc") },
  // ...
], [t]);
```

---

### 3.2 Memoizar options en Pagination

**Problema:** `visibleSizeOptions.map(...)` crea array nuevo en cada render.

**Archivo:**

- [ ] `src/components/ludoteca/Pagination.tsx` (~lineas 95-98, 170-173)

**Cambio:** Envolver en `useMemo` con dependencia en `visibleSizeOptions`.

---

### 3.3 Extraer objetos inline de props de motion

**Problema:** Objetos `animate={{...}}`, `transition={{...}}` creados inline fuerzan recalculos de animacion en cada render padre.

**Archivos prioritarios:**

- [ ] `src/components/NavBar.tsx` — `animate` del backdrop
- [ ] `src/components/ludoteca/GameGrid.tsx` — `transition` con delay calculado
- [ ] `src/components/ludoteca/Pagination.tsx` — `transition` objects

**Cambio:** Extraer a constantes o `useMemo`:

```typescript
const backdropAnimate = useMemo(() => ({
  backgroundColor: scrolled ? hexToRgba(theme.bg, 0.8) : "rgba(0,0,0,0)",
}), [scrolled, theme.bg]);
```

**Nota:** En GameGrid, el `transition` depende del indice `i`, asi que se puede extraer a una funcion helper fuera del componente o usar una constante para la parte fija.

---

### 3.4 Extraer FOCUSABLE como constante de modulo

**Problema:** String selector recreado dentro de useEffect.

**Archivo:**

- [ ] `src/components/ludoteca/LudotecaClient.tsx` (~linea 285)

**Cambio:** Mover fuera del componente:

```typescript
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
```

---

## Fase 4 — Seguridad y Robustez de API (30-45 min cada fix)

Proteccion del endpoint y resiliencia ante servicios externos.

### 4.1 Rate limiting en API de contacto

**Problema:** Sin limite de peticiones, cualquiera puede agotar la cuota de Resend.

**Archivo:**

- [ ] `src/app/api/contact/route.ts`

**Opciones:**

- **Opcion A (simple):** Map en memoria con IP + timestamp, limite de 5 envios/hora por IP. Funciona en single-instance (Vercel serverless resetea entre cold starts).
- **Opcion B (robusta):** Usar Vercel KV o Upstash Redis para rate limiting persistente.
- **Opcion C (middleware):** Rate limiting a nivel de middleware con headers.

**Cambio minimo (Opcion A):**

```typescript
const rateLimit = new Map<string, number[]>();
const WINDOW_MS = 3600000; // 1 hora
const MAX_REQUESTS = 5;
```

---

### 4.2 Timeout en fetch a BGG API

**Problema:** Sin timeout, las peticiones a BGG pueden colgar indefinidamente.

**Archivo:**

- [ ] `src/lib/bgg.ts` (~linea 73)

**Cambio:** Anadir `AbortSignal.timeout()`:

```typescript
const response = await fetch(url, {
  headers,
  signal: AbortSignal.timeout(30000),
  next: { revalidate: 86400 },
});
```

---

### 4.3 Timeout en Resend API

**Problema:** Sin timeout en el envio de email.

**Archivo:**

- [ ] `src/app/api/contact/route.ts`

**Cambio:** Anadir timeout de 10-15 segundos al call de Resend o envolver en `Promise.race`.

---

### 4.4 Cache-Control en respuesta de API

**Problema:** Sin headers de cache explicitos, el browser podria cachear respuestas POST.

**Archivo:**

- [ ] `src/app/api/contact/route.ts`

**Cambio:** Anadir header `Cache-Control: no-store` en las respuestas.

---

## Fase 5 — Optimizacion de Ludoteca (45-60 min total)

Mejoras de rendimiento en el flujo de filtrado y renderizado de juegos.

### 5.1 Pre-computar mapa inverso de expansiones

**Problema:** Filtro de rankTypes recorre todo `allGamesMap` por cada expansion — O(n²).

**Archivo:**

- [ ] `src/components/ludoteca/LudotecaClient.tsx` (~lineas 170-176)

**Cambio:** Crear mapa inverso una sola vez:

```typescript
const expansionToBaseMap = useMemo(() => {
  const map = new Map<number, number>();
  for (const game of games) {
    for (const exp of game.expansions) {
      map.set(exp.id, game.id);
    }
  }
  return map;
}, [games]);
```

Luego en el filtro: `const baseId = expansionToBaseMap.get(g.id)` — O(1).

---

### 5.2 Limitar animaciones de stagger en GameGrid

**Problema:** Con 192 items, se lanzan 192 animaciones simultaneas causando jank.

**Archivo:**

- [ ] `src/components/ludoteca/GameGrid.tsx`

**Cambio:** Limitar delay maximo y/o desactivar animaciones cuando hay muchos items:

```typescript
const shouldAnimate = games.length <= 48;
// O reducir delay maximo:
delay: Math.min(i * 0.02, 0.2) // Cap 200ms en vez de 400ms
```

---

### 5.3 Optimizar About page — no fetchar toda la coleccion BGG

**Problema:** La pagina About fetcha y parsea toda la coleccion BGG solo para obtener `gameCount`.

**Archivo:**

- [ ] `src/app/[locale]/about/page.tsx` (~linea 34)

**Opciones:**

- **Opcion A:** Crear funcion `fetchBggCollectionCount()` que solo devuelva el count sin parsear items.
- **Opcion B:** Cachear el count como variable de entorno o constante actualizada periodicamente.
- **Opcion C:** Pasar el count como dato estatico si no cambia frecuentemente.

---

## Fase 6 — Mejoras de UX y CLS (20-30 min total)

Prevenir layout shifts y mejorar experiencia visual.

### 6.1 Aspect ratio en imagenes con fill

**Problema:** Imagenes con `fill` sin aspect-ratio explicito pueden causar layout shift.

**Archivos:**

- [ ] `src/components/home/About.tsx` — cards de imagenes
- [ ] `src/components/home/Activities.tsx` — cards de actividades
- [ ] `src/components/home/Location.tsx` — fotos de la casa
- [ ] `src/components/about/AboutCollaborators.tsx` — logos de colaboradores

**Cambio:** Anadir clase Tailwind `aspect-video`, `aspect-square` o `aspect-[4/5]` al contenedor padre de cada imagen.

---

### 6.2 Reemplazar NavBar scroll con IntersectionObserver

**Problema:** `getBoundingClientRect()` en 6 elementos por cada evento scroll puede causar layout thrashing.

**Archivo:**

- [ ] `src/components/NavBar.tsx` (~lineas 77-85)

**Cambio:** Reemplazar la deteccion manual por `IntersectionObserver` con `rootMargin` centrado en viewport. Cada seccion registra su observer y notifica al NavBar del tema activo.

---

### 6.3 Usar Image en vez de motion.img para meeple

**Archivo:**

- [ ] `src/components/home/Activities.tsx` (~linea 58)

**Cambio:** Reemplazar `<motion.img src="/images/icons/meeple.svg" />` por `<Image>` envuelto en `<motion.div>`, o mantener `<img>` si el SVG es decorativo y pequeno (<5KB).

---

## Fase 7 — Mejoras opcionales (baja prioridad)

### 7.1 Virtual scrolling para listas grandes

Implementar `react-window` o `@tanstack/virtual` en GameGrid cuando `itemsPerPage > 48`. Solo si la coleccion crece significativamente.

### 7.2 OG image — embeber logo como base64

Evitar fetch HTTP externo en `opengraph-image.tsx` embebiendo el logo como buffer local.

### 7.3 Optimizar generacion de alternates en sitemap

Refactorizar el triple loop para pre-calcular alternates una sola vez por pagina en vez de por locale.

### 7.4 TextReveal — animacion batch

Para titulos largos (>5 palabras), considerar animar por grupos de palabras en vez de individualmente.

---

## Checklist de Verificacion Post-Fix

Despues de cada fase, ejecutar:

```bash
npm run build          # Verificar que el build completa sin errores
npm run lint           # Sin warnings nuevos
npm run start          # Verificar navegacion manual
```

Verificaciones adicionales:

- [ ] Lighthouse performance score (objetivo: >90)
- [ ] Comprobar que ISR funciona: visitar pagina, esperar, verificar cache HIT
- [ ] Verificar que modales siguen funcionando tras dynamic import
- [ ] Testear filtros de ludoteca con coleccion completa
- [ ] Verificar que sitemap.xml se genera correctamente
- [ ] Comprobar que los 3 idiomas funcionan tras generateStaticParams
- [ ] Revisar Network tab: bundle sizes reducidos
- [ ] Testear en mobile: animaciones fluidas, sin jank
