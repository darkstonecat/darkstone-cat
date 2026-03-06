# SEO — Plan de Posicionamiento en Google

**Fecha:** 2026-03-06
**Estado actual:** Lighthouse SEO 100 en todas las paginas. Sitemap enviado a GSC el 2026-03-02. Propiedad verificada en Google Search Console.

## Situacion Actual

Buscando "Darkstone Catalunya" en Google (incognito) aparecemos en **posicion ~10**. Por delante: darkstone.es, Instagram, Facebook, Linktree y otras menciones. Para busquedas locales como "Juegos de mesa Terrassa" o "Jocs de taula Terrassa" no aparecemos.

## Diagnostico

El SEO tecnico esta resuelto al maximo — el problema **no es tecnico**. Lo que falta es:

1. **Presencia local** — Sin Google Business Profile somos invisibles en el Local Pack (mapa)
2. **Autoridad de dominio** — darkstone.cat es un dominio nuevo (meses). Google no confia en dominios nuevos
3. **Fragmentacion de marca** — Google ve Instagram/Facebook/Linktree como entidades separadas, no como una marca unica con web principal
4. **Falta de contenido recurrente** — El sitio es un folleto estatico; sin contenido nuevo Google no tiene razon para rastrearlo frecuentemente
5. **Pocos backlinks** — Casi ninguna web externa enlaza a darkstone.cat

## Plan de Accion

### Fase 1 — Inmediato (esta semana)

#### 1. Google Business Profile (MAXIMA PRIORIDAD)

Para busquedas locales ("juegos de mesa Terrassa", "jocs de taula Terrassa") Google muestra un **Local Pack** (resultados con mapa) por encima de los resultados organicos. Sin Google Business Profile (GBP) no existimos ahi.

**Pasos:**
- Crear perfil en [business.google.com](https://business.google.com)
- **Nombre:** "Darkstone Catalunya" (exactamente igual que en la web)
- **Categoria principal:** "Board Game Club" o "Social Club" (la mas cercana que ofrezca Google)
- **Categorias secundarias:** "Nonprofit Organization", "Recreation Center" si estan disponibles
- **Direccion:** Placa del Tint, 4, 08224 Terrassa, Barcelona (identica a la web y JSON-LD)
- **Horario:** Viernes 17:00–21:00, Sabado 10:00–14:00
- **Web:** https://www.darkstone.cat
- **Descripcion:** Usar la descripcion en catalan/castellano con keywords naturales ("jocs de taula", "jocs de rol", "Terrassa")
- **Fotos:** Subir 10+ fotos de sesiones de juego, el local, la coleccion, fotos de grupo. Google premia perfiles con fotos
- **Posts:** Publicar semanalmente (proximas sesiones, juegos nuevos, eventos especiales)
- **Verificacion:** Google enviara una postal con PIN a la direccion. Asegurar que se puede recibir correo en el Casal

**Impacto estimado:** Puede moveros de posicion ~10 al Local Pack (top 3 del mapa) en 2-4 semanas tras la verificacion.

#### 2. Consolidar Perfiles Sociales

Ahora mismo Google ve Instagram, Facebook y Linktree como entidades separadas que compiten con darkstone.cat. Hay que unificarlas.

**Acciones:**
- **Instagram:** El link del bio debe ser `https://www.darkstone.cat` (no Linktree)
- **Facebook:** Campo "Sitio web" = `https://www.darkstone.cat`. Seccion "Informacion" completa con NAP identico a la web
- **X/Twitter:** Bio con link a `https://www.darkstone.cat`
- **Telegram:** Descripcion del grupo/canal con link a darkstone.cat
- **Linktree:** Eliminar o hacer que darkstone.cat sea el primer link y mas destacado. Idealmente, dejar de usar Linktree — la web ya cumple esa funcion
- **Ludoya:** Verificar que el perfil enlaza a darkstone.cat

**Clave:** El nombre "Darkstone Catalunya" debe ser identico en todas partes. La direccion tambien. Esto se llama **consistencia NAP** (Name, Address, Phone) y es un factor de ranking local.

#### 3. Solicitar Indexacion en Google Search Console

- Ir a GSC > Inspeccion de URLs
- Introducir las 4 paginas principales (locale catalan): `/`, `/about`, `/ludoteca`, `/contact`
- Pulsar "Solicitar indexacion" en cada una
- No hacerlo para las 24 variantes de locale a la vez — primero las de catalan

#### 4. Conseguir Backlink de darkstone.es

Si darkstone.es es una entidad relacionada o aliada, pedir que anada un enlace visible a darkstone.cat. Un texto como "Visita nuestra seccion en Catalunya: darkstone.cat" pasaria autoridad de un dominio que ya tiene ranking.

### Fase 2 — Primera-segunda semana

#### 5. Directorios y Citations Locales

Cada mencion del nombre + direccion + web en directorios ayuda a Google a confirmar que la entidad existe.

| Directorio | Accion | Autoridad |
|---|---|---|
| **Ajuntament de Terrassa** | Pedir inclusion en el directorio de asociaciones. Ya nos apoyan (logo en footer). Probablemente tienen un listado de entidades en su web | Alta (dominio .cat gubernamental) |
| **Registre d'Associacions de la Generalitat** | Verificar si la info publica incluye la web | Alta |
| **BoardGameGeek** | Crear una guild page de Darkstone Catalunya con link a darkstone.cat | Alta (DA 80+ en el nicho de juegos) |
| **Paginas Amarillas** (paginasamarillas.es) | Listing gratuito con NAP + web | Media |
| **Wikidata** | Crear una entrada para "Darkstone Catalunya" como organizacion, con link a darkstone.cat | Media (senal para Knowledge Panel) |

#### 6. Pedir Reviews en Google

Una vez verificado el GBP:
- Pedir a los socios que dejen resenas en Google
- Incluso 5-10 resenas genuinas con menciones naturales de "jocs de taula" o "juegos de mesa" ayudan significativamente
- Responder a todas las resenas (Google valora perfiles activos)

### Fase 3 — Mes 1-2

#### 7. Mejoras Tecnicas Menores

El SEO tecnico ya esta al 100%, pero hay schema adicional que puede generar **rich results** (resultados enriquecidos en Google):

**a) FAQPage Schema**
Anadir una seccion de preguntas frecuentes en la home o about con datos estructurados. Google puede mostrar las preguntas directamente en los resultados de busqueda:
- "Quant costa ser soci?"
- "Cal portar jocs?"
- "A quina edat es pot venir?"
- "On ens trobem?"

**b) WebSite Schema con SearchAction**
Indicar a Google que la ludoteca tiene buscador:
```json
{
  "@type": "WebSite",
  "name": "Darkstone Catalunya",
  "url": "https://www.darkstone.cat",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.darkstone.cat/ludoteca?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

**c) Enriquecer Organization Schema**
Anadir campos adicionales al JSON-LD existente:
- `areaServed`: `{"@type": "City", "name": "Terrassa"}`
- `knowsLanguage`: `["ca", "es", "en"]`

**d) Anadir `offers` a Event Schema**
Explicitar que los eventos son gratuitos (puede mostrarse como "Gratis" en resultados):
```json
"offers": {
  "@type": "Offer",
  "price": "0",
  "priceCurrency": "EUR",
  "availability": "https://schema.org/InStock"
}
```

#### 8. Estrategia de Contenido

El sitio actual es estatico. Google favorece sitios con contenido nuevo y recurrente.

**Opciones ordenadas por esfuerzo/impacto:**

| Contenido | Esfuerzo | Impacto | Keywords que captaria |
|---|---|---|---|
| **Pagina de eventos/activitats** | Medio | Alto | "eventos juegos de mesa Terrassa", "partides jocs de taula" |
| **Blog** (1-2 posts/mes) | Alto | Muy alto (largo plazo) | Long-tail: "millors jocs de taula cooperatius", "on jugar jocs de taula Terrassa" |
| **Paginas individuales por juego** en ludoteca | Medio | Medio | Nombres de juegos especificos |
| **Seccion FAQ** | Bajo | Medio | Preguntas conversacionales y voice search |

**Ideas de articulos:**
- "Els millors jocs de taula per a principiants" (mejores juegos para principiantes)
- "On jugar a jocs de taula a Terrassa" (donde jugar en Terrassa — nosotros somos la respuesta principal)
- "Guia de jocs de taula cooperatius" (guia de juegos cooperativos)
- Resenas de juegos de la coleccion
- Cronicas de sesiones con fotos

#### 9. Backlinks Adicionales

| Fuente | Accion | Esfuerzo |
|---|---|---|
| **Diari de Terrassa / El 9 Nou / Tot Terrassa** | Nota de prensa sobre un evento o hito (aniversario, juego 200 en ludoteca) | Medio |
| **Asociaciones locales de Terrassa** | Cross-linking con otras entidades culturales o juveniles | Bajo |
| **UPC Campus Terrassa** | Asociaciones de estudiantes, tablones de eventos | Medio |
| **Reddit** (r/boardgames, r/barcelona) | Participar en la comunidad, link natural cuando sea relevante | Bajo |
| **Foros de BGG** | Participar en threads de grupos locales | Bajo |

### Fase 4 — Acciones en Google Search Console (continuo)

| Accion | Cuando | Que buscar |
|---|---|---|
| **Revisar Paginas indexadas** (GSC > Paginas) | Semanal | Que todas las paginas esten indexadas, no "Crawled - currently not indexed" |
| **Informe de Rendimiento** | Semanal | Queries con impresiones pero bajo CTR — oportunidades de mejorar titulos/descripciones |
| **Core Web Vitals** | Cuando haya datos | Comparar datos reales (CrUX) con Lighthouse sintetico |
| **Mejoras** (Enhancements) | Tras cambios de schema | Validar que Google reconoce BreadcrumbList, Event, FAQPage, etc. |
| **Segmentacion Internacional** | Una vez | Verificar que Google detecta correctamente el hreflang |

## Expectativas de Tiempo

| Periodo | Resultado esperado |
|---|---|
| **Semana 1-2** | Google indexa las paginas del sitemap. Pueden aparecer en posiciones 20-50+ |
| **Semana 2-4** | Con GBP creado, posible aparicion en el Local Pack para queries locales |
| **Mes 1-3** | Busqueda de marca ("Darkstone Catalunya") deberia subir a posicion 1-5. Local Pack consolidado |
| **Mes 3-6** | Queries no-marca ("juegos de mesa Terrassa") empiezan a aparecer en pagina 1. El efecto sandbox de dominios nuevos se levanta tipicamente en este periodo |
| **Mes 6-12** | Con contenido recurrente y backlinks, posicion #1 para "Darkstone Catalunya" y pagina 1 para queries locales de juegos |

**Nota importante:** Llevamos solo 4 dias desde el envio del sitemap. Es extremadamente pronto. Las mejoras de ranking son graduales. No esperar resultados significativos hasta 4-8 semanas minimo. Las acciones de este plan (especialmente GBP) aceleraran los tiempos significativamente.

## Resumen de Prioridades

| # | Accion | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | Crear Google Business Profile | Muy alto | 1-2 horas |
| 2 | Unificar links sociales a darkstone.cat | Alto | 30 min |
| 3 | Solicitar indexacion en GSC | Medio | 15 min |
| 4 | Pedir link desde darkstone.es | Medio | 1 email |
| 5 | Directorios: Ajuntament, BGG, Wikidata | Alto | 2-3 horas |
| 6 | Reviews de socios en Google | Alto | Continuo |
| 7 | FAQ con schema FAQPage | Medio | 2-3 horas (dev) |
| 8 | Schema adicional (WebSite, offers, areaServed) | Bajo-medio | 1 hora (dev) |
| 9 | Pagina de eventos | Alto | 1-2 dias (dev) |
| 10 | Blog / contenido recurrente | Muy alto (largo plazo) | Continuo |

## Lo que YA esta bien (no tocar)

- Sitemap con hreflang y alternates para 3 locales
- JSON-LD: Organization (NGO), Place (GeoCoordinates), Event (recurring), BreadcrumbList, WebPage, ItemList
- Meta descriptions con keywords locales en los 3 idiomas
- Canonical tags + hreflang en todas las paginas
- OpenGraph + Twitter Cards con imagen dinamica por locale
- Robots.txt correcto
- Paginas legales con noindex (conduct, legal, privacy, cookies)
- ISR con revalidacion apropiada por pagina
- Lighthouse SEO 100 en todas las paginas
