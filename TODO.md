# TODO — Publicació i SEO web Darkstone Catalunya

## 🚀 Abans de publicar

### Tècnic (codi)
- [x] Afegir meta tags bàsiques a totes les pàgines (title, description, og:image, twitter card) — `src/app/[locale]/layout.tsx` + pàgines individuals
- [x] Comprovar que el web és correcte en mòbil (responsive) — Activities té variants desktop/mobile
- [x] Integrar Google Analytics 4 a `layout.tsx` usant `<Script>` de Next.js — `src/components/GoogleAnalytics.tsx`
- [x] Gestionar el Measurement ID via variable d'entorn `NEXT_PUBLIC_GA_MEASUREMENT_ID` — `.env.local`
- [x] Afegir un banner de cookies RGPD — `src/components/CookieBanner.tsx` + `CookieConsentProvider.tsx`
- [x] Contrast de colors WCAG AA — brand-orange ajustat a `#C05600`
- [x] Generar `sitemap.xml` — `src/app/sitemap.ts` (4 pàgines × 3 locales, amb alternates hreflang)
- [x] Generar `robots.txt` — `src/app/robots.ts`
- [x] Afegir `og:image` generada dinàmicament — `src/app/[locale]/opengraph-image.tsx` (logo + branding)
- [x] Afegir dades estructurades JSON-LD (Schema.org `Organization`) a `layout.tsx`

### Verificació manual
- [ ] Passar Lighthouse al 100% en totes les categories (Performance, Accessibility, Best Practices, SEO)
- [ ] Crear compte a [analytics.google.com](https://analytics.google.com) i obtenir el Measurement ID (`G-XXXXXXXXXX`)

## 📊 Just després de publicar

### Google Search Console
- [ ] Accedir a [search.google.com/search-console](https://search.google.com/search-console)
- [ ] Afegir el domini i verificar la propietat (via meta tag o arxiu HTML)
- [ ] Enviar el `sitemap.xml` a Google Search Console
- [ ] Revisar que no hi ha errors d'indexació
- [ ] Monitoritzar les primeres setmanes: impressions, clics i posicions per paraules clau com "associació jocs de taula Terrassa"

### Google Analytics 4 (activació)
- [ ] Afegir el Measurement ID real a les variables d'entorn de producció (Vercel)
- [ ] Verificar que funciona a la vista "Temps real" de GA4
- [ ] Configurar esdeveniments bàsics: clics a botó de contacte, visites a pàgines clau...

### Google Rich Results
- [ ] Validar dades estructurades amb [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Considerar afegir schema `Event` si es publiquen esdeveniments (Egara Juga, etc.)

## 🔍 SEO continu (un cop publicat)

- [ ] Revisar Core Web Vitals reals a Google Search Console (poden diferir de Lighthouse)
- [ ] Comprovar que les pàgines noves s'indexen correctament
- [ ] Fer una auditoria de links interns i broken links amb Screaming Frog (gratis fins 500 URLs)

## 💡 Notes

- **Lighthouse** → SEO tècnic i rendiment. Executar amb `lighthouse https://url --output json`
- **Google Search Console** → Dades reals de Google. Requereix tràfic, pot trigar setmanes.
- **Rich Results Test** → Valida dades estructurades (Schema.org)
- **Google Analytics 4** → Analítica de comportament d'usuaris. Diferent de GSC (que és com et troben).
- El codi de GA4 ja està integrat i condicionat al consentiment de cookies. Només cal afegir el Measurement ID real a Vercel.

## 📋 Resum d'estat

| Element | Estat | Detall |
|---------|-------|--------|
| Meta tags (title, description, og, twitter) | ✅ Fet | Layout + pàgines individuals |
| Responsive / mòbil | ✅ Fet | Variants desktop/mobile |
| Google Analytics 4 (codi) | ✅ Fet | Component + env var |
| Cookie banner RGPD | ✅ Fet | Amb consentiment i traduccions |
| Contrast WCAG AA | ✅ Fet | brand-orange ajustat |
| `sitemap.xml` | ✅ Fet | `src/app/sitemap.ts` — 4 pàgines × 3 locales |
| `robots.txt` | ✅ Fet | `src/app/robots.ts` |
| `og:image` dinàmica | ✅ Fet | `src/app/[locale]/opengraph-image.tsx` |
| JSON-LD (Schema.org) | ✅ Fet | `Organization` a layout.tsx |
| Lighthouse 100% | ⚠️ No verificat | Cal executar auditoria |
| GA4 Measurement ID | ⏳ Post-publicació | Afegir a Vercel env vars |
| Google Search Console | ⏳ Post-publicació | Quan el domini estigui actiu |
