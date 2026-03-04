# Plan de Corrección de Accesibilidad — Darkstone Catalunya

Auditoría realizada: 2026-03-04
Total de problemas: 22 (5 críticos, 9 importantes, 8 moderados)

---

## Fase 1 — Críticos (Impacto alto, esfuerzo bajo-medio) — COMPLETADA

> Todos los fixes de esta fase ya estaban implementados en el código. Verificado el 2026-03-04.

### 1.1 Añadir Skip Link

- [ ] Crear componente `SkipLink` con enlace "Saltar al contenido principal" (traducido a ca/es/en)
- [ ] Añadirlo al layout principal (`src/app/[locale]/layout.tsx`) antes del NavBar
- [ ] Asegurar que `<main>` tenga `id="main-content"` en todas las páginas
- [ ] Estilizar: oculto por defecto, visible al recibir foco
- [ ] Añadir claves de traducción en `src/messages/{ca,es,en}.json`

**Archivos a modificar:**
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/page.tsx` (verificar id en `<main>`)
- `src/messages/ca.json`, `es.json`, `en.json`
- Nuevo: `src/components/SkipLink.tsx`

---

### 1.2 Formulario de contacto: `aria-invalid` + `aria-describedby` + `autocomplete`

- [ ] Añadir `aria-invalid={!!errors.fieldName}` a cada input/textarea
- [ ] Añadir `id` a cada mensaje de error (ej: `id="name-error"`)
- [ ] Añadir `aria-describedby="name-error"` a cada input (condicionalmente cuando hay error)
- [ ] Añadir `autocomplete="name"` al input de nombre
- [ ] Añadir `autocomplete="email"` al input de email

**Archivos a modificar:**
- `src/components/contact/ContactForm.tsx` (líneas 144, 167, 190, 214)

---

### 1.3 Corregir `outline-none` que sobreescribe `:focus-visible`

- [ ] Reemplazar `outline-none` por `outline-none focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2` en los inputs afectados
- [ ] Alternativa: eliminar `outline-none` y dejar que el estilo global de `:focus-visible` funcione

**Archivos a modificar:**
- `src/components/contact/ContactForm.tsx` (4 inputs)
- `src/components/ludoteca/FilterSidebar.tsx` (1 input)
- `src/components/ludoteca/SearchableMultiSelect.tsx` (1 input)

---

### 1.4 Añadir `aria-live` regions para contenido dinámico

- [ ] **ContactForm**: envolver el mensaje de éxito/error en `<div role="status" aria-live="polite">`
- [ ] **LudotecaClient**: añadir `aria-live="polite"` al texto "Mostrando X-Y de Z resultados"
- [ ] **LudotecaClient**: envolver mensaje "sin resultados" en `<div role="status" aria-live="polite">`
- [ ] **Pagination**: añadir `aria-live="polite"` al texto de conteo de resultados

**Archivos a modificar:**
- `src/components/contact/ContactForm.tsx`
- `src/components/ludoteca/LudotecaClient.tsx`
- `src/components/ludoteca/Pagination.tsx`

---

### Verificación Fase 1

#### Build y lint

```bash
npm run build        # Debe compilar sin errores
npm run lint         # Sin warnings nuevos de ESLint
```

#### Revisión de código (grep)

```bash
# 1.1 — Skip Link existe y está conectado
grep -r "skip" src/components/SkipLink.tsx          # Componente creado
grep -r "SkipLink" src/app/\[locale\]/layout.tsx    # Incluido en layout
grep -r "main-content" src/app/                     # id="main-content" en <main>
grep -r "skip" src/messages/ca.json                 # Clave de traducción existe

# 1.2 — Formulario: aria-invalid, aria-describedby, autocomplete
grep -n "aria-invalid" src/components/contact/ContactForm.tsx    # Debe aparecer 4 veces (name, email, subject, message)
grep -n "aria-describedby" src/components/contact/ContactForm.tsx # Debe aparecer 4 veces
grep -n "autocomplete" src/components/contact/ContactForm.tsx     # "name" y "email"

# 1.3 — outline-none corregido con focus-visible
grep -n "outline-none" src/components/contact/ContactForm.tsx              # Si aparece, debe ir acompañado de focus-visible:outline
grep -n "outline-none" src/components/ludoteca/FilterSidebar.tsx
grep -n "outline-none" src/components/ludoteca/SearchableMultiSelect.tsx

# 1.4 — aria-live regions
grep -n "aria-live" src/components/contact/ContactForm.tsx       # Mensaje éxito/error
grep -n "aria-live" src/components/ludoteca/LudotecaClient.tsx   # Conteo resultados + sin resultados
grep -n "aria-live" src/components/ludoteca/Pagination.tsx        # Conteo
```

#### Criterio de paso Fase 1

> `npm run build` y `npm run lint` pasan sin errores. Todos los greps confirman la presencia de los atributos ARIA esperados en los archivos correctos.

---

## Fase 2 — Importantes (Impacto alto, esfuerzo medio) — COMPLETADA

> Todos los fixes de esta fase ya estaban implementados en el código. Verificado el 2026-03-04.

### 2.1 `aria-current="page"` en navegación

- [ ] Añadir `aria-current="page"` al link activo en NavBar desktop (comparar pathname)
- [ ] Añadir `aria-current="page"` al link activo en NavBar mobile

**Archivos a modificar:**
- `src/components/NavBar.tsx` (líneas 152-182 desktop, 253-268 mobile)

---

### 2.2 `aria-current="page"` en paginación

- [ ] Añadir `aria-current="page"` al botón de página activa
- [ ] Añadir `aria-label` descriptivo a los botones de página (ej: "Página 3")

**Archivos a modificar:**
- `src/components/ludoteca/Pagination.tsx` (línea 139-150)

---

### 2.3 Navegación de teclado en Dropdown

- [ ] Implementar `onKeyDown` handler: ArrowDown/ArrowUp para navegar opciones, Enter/Space para seleccionar, Escape para cerrar
- [ ] Gestionar foco dentro del dropdown abierto
- [ ] Añadir `aria-controls` vinculando el botón trigger con el menú
- [ ] Añadir `id` al contenedor del menú

**Archivos a modificar:**
- `src/components/ludoteca/Dropdown.tsx`
- `src/components/ludoteca/SortDropdown.tsx` (hereda mejoras)

---

### 2.4 CookieBanner: foco y teclado

- [ ] Añadir handler para tecla Escape (aceptar o cerrar)
- [ ] Mover foco al banner cuando aparece
- [ ] Considerar focus trap si el banner es modal

**Archivos a modificar:**
- `src/components/CookieBanner.tsx`

---

### 2.5 GameCard/GameListRow: `aria-label` con nombre del juego

- [ ] Modificar `aria-label` para incluir el nombre del juego: `t("card_aria", { name: game.name })`
- [ ] Actualizar claves de traducción para aceptar interpolación: `"card_aria": "Veure detalls de {name}"`

**Archivos a modificar:**
- `src/components/ludoteca/GameCard.tsx` (línea 82)
- `src/components/ludoteca/GameListRow.tsx` (línea 41)
- `src/messages/ca.json`, `es.json`, `en.json` (clave `ludoteca.card_aria`)

---

### 2.6 FilterSidebar: corregir roles ARIA en chips

- [ ] Cambiar `role="switch"` + `aria-checked` por `aria-pressed` en chips de filtro multi-selección
- [ ] Eliminar `role="switch"` (los `<button>` nativos no lo necesitan)

**Archivos a modificar:**
- `src/components/ludoteca/FilterSidebar.tsx` (líneas 115-226, todos los chips)

---

### 2.7 View toggle y botón de filtros mobile

- [ ] Añadir `aria-pressed={viewMode === "grid"}` y `aria-pressed={viewMode === "list"}` a los botones de vista
- [ ] Añadir `aria-expanded={mobileFilterOpen}` al botón de filtros mobile

**Archivos a modificar:**
- `src/components/ludoteca/LudotecaClient.tsx` (líneas 461-512 view toggle, 371 filtros)

---

### 2.8 `aria-controls` en dropdowns y comboboxes

- [ ] Añadir `aria-controls="dropdown-{id}"` al botón trigger de `Dropdown.tsx`
- [ ] Añadir `id="dropdown-{id}"` al contenedor del menú
- [ ] Hacer lo mismo en `SearchableMultiSelect.tsx`: `aria-controls` en trigger, `id` en listbox

**Archivos a modificar:**
- `src/components/ludoteca/Dropdown.tsx`
- `src/components/ludoteca/SearchableMultiSelect.tsx`

---

### Verificación Fase 2

#### Build y lint

```bash
npm run build        # Debe compilar sin errores
npm run lint         # Sin warnings nuevos de ESLint
```

#### Revisión de código (grep)

```bash
# 2.1 — aria-current en NavBar
grep -n "aria-current" src/components/NavBar.tsx    # Debe aparecer en links desktop y mobile

# 2.2 — aria-current y aria-label en paginación
grep -n "aria-current" src/components/ludoteca/Pagination.tsx   # En botón de página activa
grep -n "aria-label" src/components/ludoteca/Pagination.tsx     # En cada botón de página

# 2.3 — Keyboard nav y aria-controls en Dropdown
grep -n "onKeyDown\|handleKeyDown\|ArrowDown\|ArrowUp" src/components/ludoteca/Dropdown.tsx  # Handler de teclado
grep -n "aria-controls" src/components/ludoteca/Dropdown.tsx    # Vinculación trigger-menú

# 2.4 — CookieBanner: Escape y foco
grep -n "Escape\|useEffect\|useRef\|focus" src/components/CookieBanner.tsx  # Handler Escape + gestión foco

# 2.5 — GameCard/GameListRow: aria-label con nombre
grep -n "card_aria" src/components/ludoteca/GameCard.tsx      # Debe incluir { name: ... }
grep -n "card_aria" src/components/ludoteca/GameListRow.tsx
grep -n "card_aria" src/messages/ca.json                      # Debe tener placeholder {name}

# 2.6 — FilterSidebar: sin role="switch", con aria-pressed
grep -n "role=\"switch\"" src/components/ludoteca/FilterSidebar.tsx     # NO debe aparecer
grep -n "aria-checked" src/components/ludoteca/FilterSidebar.tsx        # NO debe aparecer
grep -n "aria-pressed" src/components/ludoteca/FilterSidebar.tsx        # Debe aparecer

# 2.7 — View toggle y filtros mobile
grep -n "aria-pressed" src/components/ludoteca/LudotecaClient.tsx     # Botones grid/list
grep -n "aria-expanded" src/components/ludoteca/LudotecaClient.tsx    # Botón filtros mobile

# 2.8 — aria-controls en SearchableMultiSelect
grep -n "aria-controls" src/components/ludoteca/SearchableMultiSelect.tsx  # Trigger → listbox
```

#### Criterio de paso Fase 2

> `npm run build` y `npm run lint` pasan sin errores. Los greps confirman: `aria-current` en NavBar y Pagination, keyboard handler en Dropdown, `aria-pressed` reemplaza `role="switch"` en FilterSidebar, `aria-controls` en todos los dropdowns, interpolación de nombre en `card_aria`.

---

## Fase 3 — Moderados (Impacto medio, esfuerzo bajo) — COMPLETADA

> Todos los fixes de esta fase ya estaban implementados en el código. Verificado el 2026-03-04.

### 3.1 Mejorar contraste de placeholders y textos con opacidad

- [ ] **ContactForm**: cambiar `placeholder:text-stone-custom/30` a `placeholder:text-stone-custom/50` (mínimo)
- [ ] **SocialLinks**: cambiar `opacity-40` del título a `opacity-60` o superior
- [ ] **ContactInfo**: cambiar `text-stone-custom/50` a `text-stone-custom/70`

**Archivos a modificar:**
- `src/components/contact/ContactForm.tsx`
- `src/components/home/SocialLinks.tsx` (línea 141)
- `src/components/contact/ContactInfo.tsx` (líneas 30, 44)

---

### 3.2 Añadir `<fieldset>/<legend>` a grupos de filtros

- [ ] Envolver cada grupo de chips (tipo, jugadores, duración, peso, edad) en `<fieldset>`
- [ ] Convertir los `<h3>` existentes en `<legend>` con el mismo estilo
- [ ] Aplicar `border-0 p-0 m-0` al fieldset para evitar estilos por defecto del navegador

**Archivos a modificar:**
- `src/components/ludoteca/FilterSidebar.tsx` (líneas 106-226)

---

### 3.3 Paginación: ellipsis accesible

- [ ] Añadir `role="separator"` y `aria-label` al span de ellipsis (ej: `aria-label="Más páginas"`)
- [ ] Añadir claves de traducción

**Archivos a modificar:**
- `src/components/ludoteca/Pagination.tsx` (líneas 132-137)
- `src/messages/ca.json`, `es.json`, `en.json`

---

### 3.4 SVG checkmark de éxito sin `aria-hidden`

- [ ] Añadir `aria-hidden="true"` al SVG del checkmark en el mensaje de éxito del formulario

**Archivos a modificar:**
- `src/components/contact/ContactForm.tsx` (líneas 87-99)

---

### 3.5 Heading hierarchy en Schedule

- [ ] Cambiar los `<span>` de los días (Viernes, Sábado) por `<h3>` con las clases de estilo actuales

**Archivos a modificar:**
- `src/components/home/Schedule.tsx` (líneas 33, 62)

---

### 3.6 Iconos de metadatos de juegos: contexto accesible

- [ ] Añadir `aria-hidden="true"` a los iconos decorativos (Users, Clock, Baby, Star)
- [ ] Añadir `<span className="sr-only">` con texto descriptivo antes de cada valor (ej: "Jugadores:", "Duración:", "Edad mínima:", "Puntuación:")
- [ ] O alternativamente, usar `aria-label` en el contenedor de cada métrica

**Archivos a modificar:**
- `src/components/ludoteca/GameCard.tsx` (líneas 111-126)
- `src/components/ludoteca/GameListRow.tsx` (líneas 74-90)

---

### Verificación Fase 3

#### Build y lint

```bash
npm run build        # Debe compilar sin errores
npm run lint         # Sin warnings nuevos de ESLint
```

#### Revisión de código (grep)

```bash
# 3.1 — Contraste mejorado (verificar que opacidades antiguas no existen)
grep -n "stone-custom/30" src/components/contact/ContactForm.tsx       # NO debe aparecer (cambiado a /50+)
grep -n "opacity-40" src/components/home/SocialLinks.tsx               # NO debe aparecer (cambiado a 60+)
grep -n "stone-custom/50" src/components/contact/ContactInfo.tsx       # NO debe aparecer (cambiado a /70+)

# 3.2 — Fieldsets en filtros
grep -n "<fieldset" src/components/ludoteca/FilterSidebar.tsx          # Debe aparecer por cada grupo
grep -n "<legend" src/components/ludoteca/FilterSidebar.tsx            # Debe aparecer por cada grupo

# 3.3 — Ellipsis accesible
grep -n "separator\|aria-label" src/components/ludoteca/Pagination.tsx # En el span de "..."

# 3.4 — SVG checkmark oculto
grep -n "aria-hidden" src/components/contact/ContactForm.tsx           # En el SVG de éxito

# 3.5 — Headings en Schedule
grep -n "<h3\|<span" src/components/home/Schedule.tsx                  # Días deben ser h3, no span

# 3.6 — Iconos con contexto accesible
grep -n "aria-hidden\|sr-only" src/components/ludoteca/GameCard.tsx    # Iconos ocultos + texto sr-only
grep -n "aria-hidden\|sr-only" src/components/ludoteca/GameListRow.tsx
```

#### Criterio de paso Fase 3

> `npm run build` y `npm run lint` pasan sin errores. Los greps confirman: opacidades bajas eliminadas, fieldsets en filtros, ellipsis con aria-label, SVG con aria-hidden, días como h3, iconos con sr-only.

---

## Verificación final post-implementación

### Build completo

```bash
npm run build && npm run lint
```

### Grep global de atributos ARIA clave

```bash
# Resumen de atributos ARIA en todo el proyecto
echo "=== aria-label ===" && grep -rl "aria-label" src/components/ | wc -l
echo "=== aria-live ===" && grep -rl "aria-live" src/components/
echo "=== aria-current ===" && grep -rl "aria-current" src/components/
echo "=== aria-invalid ===" && grep -rl "aria-invalid" src/components/
echo "=== aria-pressed ===" && grep -rl "aria-pressed" src/components/
echo "=== aria-expanded ===" && grep -rl "aria-expanded" src/components/
echo "=== aria-controls ===" && grep -rl "aria-controls" src/components/
echo "=== aria-describedby ===" && grep -rl "aria-describedby" src/components/
echo "=== sr-only ===" && grep -rl "sr-only" src/components/
echo "=== skip ===" && grep -rl "skip\|main-content" src/components/ src/app/
```

### Verificar que no quedan anti-patterns

```bash
# NO deben aparecer (anti-patterns eliminados)
grep -rn "role=\"switch\"" src/components/ludoteca/          # Eliminado en Fase 2
grep -rn "aria-checked" src/components/ludoteca/FilterSidebar.tsx  # Reemplazado por aria-pressed
grep -rn "stone-custom/30" src/components/                   # Contraste insuficiente
grep -rn "opacity-40" src/components/home/SocialLinks.tsx    # Contraste insuficiente
```

### Verificar traducciones completas

```bash
# Todas las claves nuevas deben existir en los 3 idiomas
for lang in ca es en; do
  echo "=== $lang ==="
  grep -c "skip\|card_aria\|page_aria\|more_pages\|ellipsis" src/messages/$lang.json
done
```

### Criterio de paso final

> `npm run build` sin errores. Todos los greps de atributos ARIA devuelven resultados en los archivos esperados. Los anti-patterns grep devuelven 0 resultados. Las claves de traducción existen en los 3 idiomas.
