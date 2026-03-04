# SEO Fixes - Darkstone Catalunya

Plan de implementacion de correcciones SEO organizadas por fases.

---

## Fase 1: Critical - Crawlabilidad e indexacion

Impacto inmediato en como los buscadores descubren y entienden el sitio.

### 1.1 Añadir `/ludoteca` al sitemap

- **Archivo:** `src/app/sitemap.ts`
- **Cambio:** Añadir entrada al array `pages`:
  ```ts
  { path: "/ludoteca", changeFrequency: "daily" as const, priority: 0.8 }
  ```

### 1.2 Bloquear `/api/` en robots.txt

- **Archivo:** `src/app/robots.ts`
- **Cambio:** Añadir regla `disallow`:
  ```ts
  rules: {
    userAgent: "*",
    allow: "/",
    disallow: "/api/",
  }
  ```

### 1.3 Añadir URLs canonicas y hreflang

- **Archivo:** `src/app/[locale]/layout.tsx` (en `generateMetadata`)
- **Cambio:** Añadir `alternates` con canonical y languages:
  ```ts
  alternates: {
    canonical: locale === "ca"
      ? `https://darkstone.cat${path}`
      : `https://darkstone.cat/${locale}${path}`,
    languages: {
      ca: `https://darkstone.cat${path}`,
      es: `https://darkstone.cat/es${path}`,
      en: `https://darkstone.cat/en${path}`,
      "x-default": `https://darkstone.cat${path}`,
    },
  }
  ```
- **Nota:** Evaluar si es mejor hacerlo a nivel de layout (global) o por pagina. A nivel de layout es mas DRY pero requiere construir el `path` dinamicamente.

### 1.4 Añadir `x-default` al sitemap

- **Archivo:** `src/app/sitemap.ts`
- **Cambio:** Añadir `"x-default"` en el objeto `languages`:
  ```ts
  languages: {
    ...Object.fromEntries(locales.map(l => [l, ...])),
    "x-default": `${BASE_URL}${page.path}`,
  }
  ```

### Verificacion Fase 1

```bash
# 1. Build limpio — no debe haber errores
npm run build

# 2. Lint — sin warnings nuevos
npm run lint

# 3. Verificar sitemap generado (tras npm run build)
#    Comprobar que /ludoteca aparece y que x-default existe en cada entrada
curl -s http://localhost:3000/sitemap.xml | head -100

# 4. Verificar robots.txt
#    Debe mostrar "Disallow: /api/"
curl -s http://localhost:3000/robots.txt

# 5. Verificar hreflang en HTML de cada locale
#    Deben aparecer <link rel="alternate" hreflang="ca|es|en|x-default" ...>
curl -s http://localhost:3000/ | grep -i 'hreflang'
curl -s http://localhost:3000/es/ | grep -i 'hreflang'
curl -s http://localhost:3000/en/ | grep -i 'hreflang'

# 6. Verificar canonical
#    / debe apuntar a https://darkstone.cat/
#    /es/ debe apuntar a https://darkstone.cat/es/
curl -s http://localhost:3000/ | grep -i 'canonical'
curl -s http://localhost:3000/es/ | grep -i 'canonical'

# 7. Validar sitemap online
#    Abrir en navegador: https://www.xml-sitemaps.com/validate-xml-sitemap.html
#    Pegar: https://darkstone.cat/sitemap.xml
```

**Criterios de exito:**
- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin warnings nuevos
- [ ] `/ludoteca` presente en `sitemap.xml` con `priority` 0.8
- [ ] `x-default` presente en cada entrada del sitemap
- [ ] `robots.txt` contiene `Disallow: /api/`
- [ ] Cada pagina HTML tiene `<link rel="canonical" ...>` apuntando a su URL correcta
- [ ] Cada pagina HTML tiene 4 `<link rel="alternate" hreflang="...">` (ca, es, en, x-default)

---

## Fase 2: High - Open Graph, Twitter y datos estructurados

Impacto en como se muestra el sitio al compartirlo y en rich results.

### 2.1 Metadata OG/Twitter en subpaginas

- **Archivos:**
  - `src/app/[locale]/about/page.tsx`
  - `src/app/[locale]/ludoteca/page.tsx`
  - `src/app/[locale]/contact/page.tsx`
  - `src/app/[locale]/conduct/page.tsx`
  - `src/app/[locale]/legal/page.tsx`
  - `src/app/[locale]/privacy/page.tsx`
  - `src/app/[locale]/cookies/page.tsx`
- **Cambio:** Añadir `openGraph` y `twitter` en cada `generateMetadata`:
  ```ts
  return {
    title: t("page_title"),
    description: t("page_description"),
    openGraph: {
      title: t("page_title"),
      description: t("page_description"),
    },
    twitter: {
      title: t("page_title"),
      description: t("page_description"),
    },
  };
  ```

### 2.2 Añadir Twitter `site` handle

- **Archivo:** `src/app/[locale]/layout.tsx`
- **Cambio:** Añadir `site` al objeto `twitter`:
  ```ts
  twitter: {
    card: "summary_large_image",
    site: "@darkstonecat",
    title: t("title"),
    description: t("description"),
  }
  ```

### 2.3 Corregir OG `url` hardcodeado

- **Archivo:** `src/app/[locale]/layout.tsx`
- **Cambio:** Hacer que `openGraph.url` sea dinamico en lugar de `"https://darkstone.cat"` fijo. Puede resolverse en combinacion con la fase 1.3 (alternates).

### 2.4 Localizar imagen OG

- **Archivo:** `src/app/[locale]/opengraph-image.tsx`
- **Cambio:** Usar el parametro `locale` de `params` para traducir:
  - Subtitulo ("Associacio de jocs de taula i rol - Terrassa")
  - Badges de horario ("Divendres", "Dissabtes")
  - `alt` text del export
- **Opcion A:** Usar `getTranslations` de `next-intl/server` con un namespace `og_image`.
- **Opcion B:** Map inline con las 3 traducciones (mas simple, sin nuevas translation keys).

### 2.5 Localizar JSON-LD

- **Archivo:** `src/app/[locale]/layout.tsx`
- **Cambio:** Mover la constante `jsonLd` dentro del componente y usar traducciones para `description`. Añadir Facebook al array `sameAs`:
  ```ts
  sameAs: [
    "https://instagram.com/darkstone.cat",
    "https://www.facebook.com/profile.php?id=61560270602862",
    "https://x.com/darkstonecat",
    "https://t.me/darkstonecat",
    "https://app.ludoya.com/darkstonecat",
  ]
  ```

### Verificacion Fase 2

```bash
# 1. Build limpio
npm run build

# 2. Lint
npm run lint

# 3. Verificar OG/Twitter tags en subpaginas
#    Cada subpagina debe tener og:title y twitter:title propios (no los del home)
curl -s http://localhost:3000/about | grep -E 'og:title|twitter:title'
curl -s http://localhost:3000/es/about | grep -E 'og:title|twitter:title'
curl -s http://localhost:3000/ludoteca | grep -E 'og:title|twitter:title'
curl -s http://localhost:3000/contact | grep -E 'og:title|twitter:title'

# 4. Verificar twitter:site handle
curl -s http://localhost:3000/ | grep 'twitter:site'

# 5. Verificar OG URL dinamico (debe variar por pagina)
curl -s http://localhost:3000/ | grep 'og:url'
curl -s http://localhost:3000/about | grep 'og:url'

# 6. Verificar imagen OG localizada
#    Acceder en navegador y comprobar visualmente que el texto cambia por locale:
#    http://localhost:3000/opengraph-image
#    http://localhost:3000/es/opengraph-image
#    http://localhost:3000/en/opengraph-image

# 7. Verificar JSON-LD localizado
#    La description debe cambiar segun locale
curl -s http://localhost:3000/ | grep -o '"description":"[^"]*"' | head -1
curl -s http://localhost:3000/es/ | grep -o '"description":"[^"]*"' | head -1
curl -s http://localhost:3000/en/ | grep -o '"description":"[^"]*"' | head -1

# 8. Verificar Facebook en sameAs del JSON-LD
curl -s http://localhost:3000/ | grep -o '"sameAs":\[[^]]*\]'

# 9. Validar JSON-LD con Google
#    Abrir: https://search.google.com/test/rich-results
#    Probar con: https://darkstone.cat/
#    Probar con: https://darkstone.cat/es/
#    Probar con: https://darkstone.cat/en/

# 10. Validar OG tags con herramienta de debug
#     https://developers.facebook.com/tools/debug/
#     https://cards-dev.twitter.com/validator (o compartir enlace en X)
```

**Criterios de exito:**
- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin warnings nuevos
- [ ] Cada subpagina tiene `og:title` y `twitter:title` propios (no heredados del home)
- [ ] `twitter:site` muestra `@darkstonecat`
- [ ] `og:url` es dinamico y coincide con la URL de cada pagina
- [ ] Imagen OG muestra texto en catalan/castellano/ingles segun locale
- [ ] JSON-LD `description` cambia segun locale
- [ ] JSON-LD `sameAs` incluye Facebook
- [ ] Google Rich Results Test no reporta errores
- [ ] Facebook/Twitter debug tools muestran preview correcto

---

## Fase 3: Medium - Accesibilidad, rendimiento e imagen

Mejoras que refuerzan la calidad tecnica general.

### 3.1 Alt text descriptivo en imagenes About

- **Archivo:** `src/components/home/About.tsx`
- **Cambio:** Reemplazar `alt=""` por texto descriptivo traducido. Añadir translation keys (p.ej. `about.image_alt_1`, `about.image_alt_2`, `about.image_alt_3`) en los 3 idiomas.

### 3.2 `aria-label` en elementos `<nav>`

- **Archivos:**
  - `src/components/NavBar.tsx` — Añadir `aria-label="Main navigation"` al `<motion.nav>` principal y `aria-label="Mobile navigation"` al nav movil.
  - `src/components/Footer.tsx` — Añadir `aria-label="Footer navigation"` al `<nav>`.

### 3.3 Mejorar `lastModified` del sitemap

- **Archivo:** `src/app/sitemap.ts`
- **Cambio:** Usar fechas reales por pagina en lugar de `new Date()`:
  ```ts
  const pages = [
    { path: "/", changeFrequency: "weekly", priority: 1.0, lastModified: "2025-01-15" },
    { path: "/about", changeFrequency: "monthly", priority: 0.7, lastModified: "2025-01-10" },
    // ...
  ];
  ```
  Alternativa: usar la fecha de build (`process.env.BUILD_TIME` o similar).

### 3.4 Añadir `generateStaticParams` para locales

- **Archivo:** `src/app/[locale]/layout.tsx`
- **Cambio:**
  ```ts
  export function generateStaticParams() {
    return [{ locale: "ca" }, { locale: "es" }, { locale: "en" }];
  }
  ```

### 3.5 Reducir redundancia del sitemap

- **Archivo:** `src/app/sitemap.ts`
- **Cambio (opcional):** Generar 1 entrada por pagina (locale por defecto) con alternates, en lugar de 3 entradas por pagina. Simplifica el sitemap y evita warnings en herramientas SEO.

### Verificacion Fase 3

```bash
# 1. Build limpio
npm run build

# 2. Lint
npm run lint

# 3. Verificar alt text en imagenes About
#    Buscar que ya no haya alt="" vacio en About.tsx
grep -n 'alt=""' src/components/home/About.tsx
# Resultado esperado: sin coincidencias

# 4. Verificar aria-labels en navegacion
grep -n 'aria-label' src/components/NavBar.tsx
grep -n 'aria-label' src/components/Footer.tsx
# Resultado esperado: "Main navigation", "Mobile navigation", "Footer navigation"

# 5. Verificar lastModified en sitemap
#    No debe mostrar la fecha de hoy en todas las entradas
curl -s http://localhost:3000/sitemap.xml | grep '<lastmod>'

# 6. Verificar generateStaticParams
#    En el output de build, las paginas deben marcarse como estaticas (●)
#    en lugar de dinamicas (λ) donde sea posible
npm run build 2>&1 | grep -E '(\/ca|\/es|\/en|● |λ )'

# 7. Verificar redundancia del sitemap (si se aplico 3.5)
#    Contar entradas — debe haber ~8 (1 por pagina) en lugar de ~24 (3 por pagina)
curl -s http://localhost:3000/sitemap.xml | grep -c '<url>'

# 8. Audit de accesibilidad rapido con Lighthouse
#    Abrir Chrome DevTools > Lighthouse > Accessibility
#    Ejecutar en: http://localhost:3000/
#    Puntuacion objetivo: >= 95
```

**Criterios de exito:**
- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin warnings nuevos
- [ ] Sin `alt=""` vacio en `About.tsx`
- [ ] `aria-label` presente en los 3 elementos `<nav>` (main, mobile, footer)
- [ ] `lastModified` en sitemap no es identico para todas las paginas
- [ ] `generateStaticParams` presente en layout (paginas se generan estaticamente)
- [ ] Lighthouse Accessibility score >= 95

---

## Fase 4: Low - Mejoras opcionales

Optimizaciones de bajo impacto que mejoran marginalmente el SEO.

### 4.1 Expandir titulos cortos

- **Archivos:** `src/messages/ca.json`, `src/messages/es.json`, `src/messages/en.json`
- **Cambio:** Alargar titulos de subpaginas para acercarse a 50-60 chars:
  - `"Qui som"` → `"Qui som - Jocs de taula i rol a Terrassa"`
  - `"Ludoteca"` → `"Ludoteca - Cataleg de jocs de taula"`
  - `"Contacte"` → `"Contacte - Associacio Darkstone Catalunya"`

### 4.2 `noindex` en paginas legales (opcional)

- **Archivos:** `conduct/page.tsx`, `legal/page.tsx`, `privacy/page.tsx`, `cookies/page.tsx`
- **Cambio:**
  ```ts
  robots: { index: false, follow: true }
  ```
- **Nota:** Decisio de negocio. Indexar paginas legales no perjudica, pero consumeix crawl budget.

### 4.3 Schema `BreadcrumbList` en subpaginas

- **Archivo:** Crear utilidad reutilizable o añadir inline en cada subpagina.
- **Ejemplo:**
  ```json
  {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Inici", "item": "https://darkstone.cat" },
      { "@type": "ListItem", "position": 2, "name": "Qui som", "item": "https://darkstone.cat/about" }
    ]
  }
  ```

### 4.4 Schema `LocalBusiness` con horarios

- **Archivo:** `src/app/[locale]/layout.tsx` (junto al JSON-LD existente)
- **Cambio:** Complementar el schema `Organization` con `LocalBusiness` o `SportsActivityLocation`:
  ```json
  {
    "@type": "LocalBusiness",
    "name": "Darkstone Catalunya",
    "address": { ... },
    "openingHoursSpecification": [
      { "dayOfWeek": "Friday", "opens": "17:00", "closes": "21:00" },
      { "dayOfWeek": "Saturday", "opens": "10:00", "closes": "14:00" }
    ]
  }
  ```

### Verificacion Fase 4

```bash
# 1. Build limpio
npm run build

# 2. Lint
npm run lint

# 3. Verificar longitud de titulos (objetivo: 50-60 chars)
#    Comprobar manualmente en los archivos de traduccion
#    o inspeccionar el HTML generado:
curl -s http://localhost:3000/about | grep '<title>' | wc -c
curl -s http://localhost:3000/ludoteca | grep '<title>' | wc -c
curl -s http://localhost:3000/contact | grep '<title>' | wc -c

# 4. Verificar noindex en paginas legales (si se aplico 4.2)
curl -s http://localhost:3000/legal | grep 'robots'
curl -s http://localhost:3000/privacy | grep 'robots'
curl -s http://localhost:3000/cookies | grep 'robots'
curl -s http://localhost:3000/conduct | grep 'robots'
# Resultado esperado: content="noindex, follow"

# 5. Verificar BreadcrumbList JSON-LD (si se aplico 4.3)
curl -s http://localhost:3000/about | grep -o 'BreadcrumbList'
curl -s http://localhost:3000/ludoteca | grep -o 'BreadcrumbList'

# 6. Verificar LocalBusiness JSON-LD (si se aplico 4.4)
curl -s http://localhost:3000/ | grep -o 'LocalBusiness'
curl -s http://localhost:3000/ | grep -o 'openingHoursSpecification'

# 7. Validar todos los schemas con Google
#    https://search.google.com/test/rich-results
#    Probar con: https://darkstone.cat/
#    Probar con: https://darkstone.cat/about

# 8. Audit SEO completo con Lighthouse
#    Abrir Chrome DevTools > Lighthouse > SEO
#    Ejecutar en todas las paginas principales
#    Puntuacion objetivo: 100
```

**Criterios de exito:**
- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin warnings nuevos
- [ ] Titulos de subpaginas entre 45-60 caracteres
- [ ] Paginas legales con `noindex, follow` (si se decidio aplicar)
- [ ] `BreadcrumbList` JSON-LD valido en subpaginas (si se aplico)
- [ ] `LocalBusiness` JSON-LD valido con horarios (si se aplico)
- [ ] Google Rich Results Test sin errores en ningun schema
- [ ] Lighthouse SEO score = 100 en todas las paginas

---

## Verificacion final post-deploy

Tras desplegar todas las fases en produccion:

```bash
# 1. Validar sitemap en produccion
curl -s https://darkstone.cat/sitemap.xml | head -50

# 2. Validar robots.txt en produccion
curl -s https://darkstone.cat/robots.txt

# 3. Google Search Console
#    - Enviar sitemap: https://darkstone.cat/sitemap.xml
#    - Solicitar indexacion de paginas actualizadas
#    - Verificar cobertura de indexacion tras 48h
#    - Comprobar que no hay errores de hreflang

# 4. Rich Results Test en produccion
#    https://search.google.com/test/rich-results?url=https://darkstone.cat

# 5. Facebook Sharing Debugger
#    https://developers.facebook.com/tools/debug/?q=https://darkstone.cat
#    https://developers.facebook.com/tools/debug/?q=https://darkstone.cat/about
#    https://developers.facebook.com/tools/debug/?q=https://darkstone.cat/es/about

# 6. PageSpeed Insights (incluye Lighthouse SEO)
#    https://pagespeed.web.dev/analysis?url=https://darkstone.cat

# 7. Verificar hreflang con herramienta especializada
#    https://technicalseo.com/tools/hreflang/
#    Introducir: https://darkstone.cat
```

**Criterios de exito finales:**
- [ ] Sitemap accesible y valido en produccion
- [ ] robots.txt correcto en produccion
- [ ] Google Search Console sin errores criticos
- [ ] Rich Results Test sin errores
- [ ] Facebook/Twitter previews correctos en los 3 idiomas
- [ ] Lighthouse SEO = 100
- [ ] Hreflang correctamente implementado y validado

---

## Resumen

| Fase | Items | Esfuerzo estimado | Archivos afectados |
|------|-------|--------------------|--------------------|
| 1 - Critical | 4 | Bajo | `sitemap.ts`, `robots.ts`, `layout.tsx` |
| 2 - High | 5 | Medio | `layout.tsx`, `opengraph-image.tsx`, 7 subpaginas |
| 3 - Medium | 5 | Medio | `About.tsx`, `NavBar.tsx`, `Footer.tsx`, `sitemap.ts`, `layout.tsx` |
| 4 - Low | 4 | Bajo-Medio | Translations, subpaginas, `layout.tsx` |

### Orden de ejecucion recomendado

1. **Fase 1** primero — impacto directo en indexacion, cambios minimos.
2. **Fase 2** a continuacion — mejora la presencia en redes y rich results.
3. **Fase 3** en paralelo o despues — calidad tecnica y accesibilidad.
4. **Fase 4** cuando haya tiempo — nice-to-haves.
