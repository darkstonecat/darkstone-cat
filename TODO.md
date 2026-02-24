# TODO — Publicació i SEO web Darkstone Catalunya

## 🚀 Abans de publicar

- [ ] Passar Lighthouse al 100% en totes les categories (Performance, Accessibility, Best Practices, SEO)
- [ ] Verificar que el `sitemap.xml` és generat correctament (Next.js ho pot fer automàticament)
- [ ] Verificar que el `robots.txt` és correcte
- [ ] Afegir meta tags bàsiques a totes les pàgines (title, description, og:image...)
- [ ] Comprovar que el web és correcte en mòbil (responsive)

### Google Analytics 4 (preparació prèvia)
- [ ] Crear compte a [analytics.google.com](https://analytics.google.com) i obtenir el Measurement ID (`G-XXXXXXXXXX`)
- [ ] Integrar el codi a `app/layout.tsx` usant el component `<Script>` de Next.js
- [ ] Gestionar el Measurement ID via variable d'entorn `NEXT_PUBLIC_GA_MEASUREMENT_ID` (buida en dev, activa en producció)
- [ ] Afegir un banner de cookies RGPD (obligatori per a usuaris europeus) — llibreries recomanades: `cookie-consent`

## 📊 Just després de publicar

### Google Search Console
- [ ] Accedir a [search.google.com/search-console](https://search.google.com/search-console)
- [ ] Afegir el domini i verificar la propietat (via meta tag o arxiu HTML)
- [ ] Enviar el `sitemap.xml` a Google Search Console
- [ ] Revisar que no hi ha errors d'indexació
- [ ] Monitoritzar les primeres setmanes: impressions, clics i posicions per paraules clau com "associació jocs de taula Terrassa"

### Google Analytics 4 (activació)
- [ ] Afegir el Measurement ID real a les variables d'entorn de producció
- [ ] Verificar que funciona a la vista "Temps real" de GA4 (obrir la web i comprovar que apareix una visita)
- [ ] Configurar esdeveniments bàsics: clics a botó de contacte, visites a pàgines clau...

### Google Rich Results
- [ ] Afegir dades estructurades (Schema.org) per a l'associació: `Organization`, `Event` si hi ha events...
- [ ] Validar amb [Rich Results Test](https://search.google.com/test/rich-results)

## 🔍 SEO continu (un cop publicat)

- [ ] Revisar Core Web Vitals reals a Google Search Console (poden diferir de Lighthouse)
- [ ] Comprovar que les pàgines noves s'indexen correctament
- [ ] Fer una auditoria de links interns i broken links amb Screaming Frog (gratis fins 500 URLs)

## 💡 Notes

- **Lighthouse** → SEO tècnic i rendiment. Executar amb `lighthouse https://url --output json`
- **Google Search Console** → Dades reals de Google. Requereix tràfic per tenir dades útils, pot trigar setmanes.
- **Rich Results Test** → Valida dades estructurades (Schema.org)
- **Screaming Frog** → Auditoria de rastreig i indexació
- **Google Analytics 4** → Analítica de comportament d'usuaris (què fan dins la web). Diferent de GSC (que és com et troben). Preparar el codi abans de publicar, activar quan el domini estigui actiu.
- Per ara (web no publicat) no cal configurar GSC ni GA4. Tornar a aquest fitxer quan el domini estigui actiu.
