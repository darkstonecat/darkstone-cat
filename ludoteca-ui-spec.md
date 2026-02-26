# Ludoteca — Especificación de Diseño de Interfaz

## 1. Visión general

La Ludoteca es una interfaz de catálogo de juegos de mesa que permite explorar, filtrar, ordenar y visualizar una colección de juegos. El diseño sigue un layout a dos columnas en desktop y una experiencia adaptada de columna única en móvil.

El estilo visual toma como referencia la tienda francesa Philibert (ver imágenes de referencia `ludoteca_desktop_*.png` y `ludoteca_mobile_*.png`), con un enfoque limpio, funcional y orientado a la información esencial de cada juego.

---

## 2. Estructura general — Desktop

El layout se divide en **dos columnas** principales:

### 2.1 Columna izquierda — Filtros

Columna fija lateral que contiene todos los controles de búsqueda y filtrado. Ancho aproximado: **280–320px**. Si el contenido excede la altura visible, esta columna debe hacer scroll de forma independiente.

#### Contenido (de arriba a abajo):

**Búsqueda por nombre**
- Un campo de texto (`input text`) con placeholder tipo *"Buscar juego por nombre..."* e icono de lupa.
- Filtra en tiempo real o al pulsar Enter, según conveniencia de implementación.

**Número de jugadores**
- Botones en formato chip/tag con las opciones: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `Más de 10`.
- Selección múltiple permitida (se pueden marcar varios simultáneamente).
- Estado visual claro: chip relleno o con borde destacado cuando está activo.
- Referencia visual: sección "Number of players" en `ludoteca_desktop_0.png`.

**Duración de la partida**
- Botones chip/tag con las opciones: `< 30 min`, `30 min – 1h`, `1 – 2h`, `2 – 3h`, `3 – 4h`, `4h+`.
- Selección múltiple permitida.

**Complejidad**
- Botones chip/tag con las opciones: `Muy fácil`, `Fácil`, `Medio`, `Difícil`, `Muy difícil`.
- Selección múltiple permitida.

**Edad recomendada**
- Botones chip/tag con las opciones: `+3`, `+6`, `+8`, `+10`, `+12`, `+14`, `+16`, `+18`.
- Selección múltiple permitida.
- Referencia visual: sección "Age" en `ludoteca_desktop_0.png`.

**Temática** *(desplegable)*
- Select/dropdown con las temáticas disponibles.
- Al haber potencialmente muchas opciones, se usa un desplegable con búsqueda integrada (searchable select) en lugar de chips.
- Posibilidad de selección múltiple.

**Mecánicas** *(desplegable)*
- Mismo formato que Temática: searchable select con selección múltiple.
- Referencia visual: sección "Mechanism(s)" en `ludoteca_desktop_0.png`.

**Botón "Aplicar filtros"**
- Botón prominente al final de la columna de filtros (estilo call-to-action).
- Si se opta por filtrado en tiempo real, este botón se puede omitir o convertir en un botón de "Limpiar filtros".

**Botón "Limpiar filtros"**
- Enlace o botón secundario para resetear todos los filtros activos a su estado por defecto.

---

### 2.2 Columna derecha — Resultados

Ocupa todo el espacio restante a la derecha de la columna de filtros.

#### Barra superior de controles

Una fila horizontal con los siguientes elementos:

**Selector de ordenación** (alineado a la izquierda)
- Dropdown/select con las siguientes opciones, cada una en orden ascendente y descendente:
  - Nombre (A → Z / Z → A)
  - Puntuación (Mayor → Menor / Menor → Mayor)
  - Complejidad (Mayor → Menor / Menor → Mayor)
- Formato sugerido: un solo select que combine criterio y dirección, por ejemplo: *"Nombre (A–Z)"*, *"Puntuación ↓"*, etc.

**Botones de vista** (alineados a la derecha)
- Dos botones icono para alternar entre:
  - **Grid** (icono de cuadrícula)
  - **Lista** (icono de líneas horizontales)
- El botón activo debe tener un estado visual diferenciado.
- Referencia visual: iconos "Display" en `ludoteca_desktop_0.png`.

#### Paginación superior

Inmediatamente debajo de la barra de controles (o integrada en ella), una barra de paginación:
- Botones de navegación: `‹ Anterior` y `Siguiente ›`.
- Indicadores de página numéricos (1, 2, 3...) con la página actual destacada.
- Máximo fijo de **48 juegos por página** (no editable por el usuario).
- Referencia visual: paginación naranja en `ludoteca_desktop_0.png`.

#### Área de visualización de juegos

**Vista Grid (tarjetas)**

Cada tarjeta contiene:
- **Imagen del juego**: ocupa aproximadamente el **60% superior** de la tarjeta. Aspecto ratio consistente. La imagen debe llenar el espacio sin distorsionarse (object-fit: cover o contain según convenga).
- **Información debajo de la imagen** (40% restante):
  - Nombre del juego (texto principal, puede truncarse con ellipsis si es largo).
  - Información concisa en formato compacto:
    - Número de jugadores (icono + texto, ej: 👥 2–4).
    - Duración estimada (icono + texto, ej: ⏱ 30–60 min).
    - Edad recomendada (icono + texto, ej: 🎂 +10).
    - Puntuación / rating (estrellas o nota numérica).
    - Complejidad (indicador visual, ej: barra o etiqueta).
- Referencia visual: tarjetas en `ludoteca_desktop_0.png`.

Columnas del grid según ancho:
| Ancho de pantalla        | Columnas |
|--------------------------|----------|
| Desktop amplio (≥1200px) | 3        |
| Desktop medio / tablet   | 2        |

**Vista Lista**

Cada fila contiene:
- **Imagen del juego** a la izquierda: más pequeña que en grid, formato thumbnail cuadrado o ligeramente apaisado.
- **Información a la derecha**: mismos datos que en grid pero con más espacio horizontal para mostrarlos sin truncar.
  - Nombre del juego (más prominente).
  - Fila de metadatos: jugadores, duración, edad, puntuación, complejidad.
- Toda la fila es un elemento interactivo (hover con feedback visual).
- Referencia visual: vista lista en `ludoteca_desktop_1.png` y `ludoteca_desktop_mini_1.png`.

#### Paginación inferior

Réplica exacta de la paginación superior, al final del listado de resultados. Permite navegar sin necesidad de hacer scroll hasta arriba.

---

## 3. Estructura general — Móvil

En pantallas pequeñas (< 768px aprox.) el layout cambia completamente a una sola columna.

### 3.1 Cabecera fija

Dos botones prominentes en la parte superior que se mantienen **fijos (sticky)** al hacer scroll hacia abajo:

| Botón Filter | Botón Sort |
|--------------|------------|

- **Botón Filter**: abre el panel de filtros (ver sección 3.2).
- **Botón Sort**: despliega el selector de ordenación directamente debajo del botón (dropdown inline o modal pequeño).
- Referencia visual: `ludoteca_mobile_0.png`.

Estos dos botones deben quedar flotantes en la parte superior de la pantalla al hacer scroll, asegurando que el usuario siempre tenga acceso rápido a filtros y ordenación.

### 3.2 Panel de filtros (popup fullscreen)

Al pulsar "Filter", se abre un panel que **ocupa toda la pantalla** (overlay modal fullscreen).

Contenido:
- **Cabecera**: botón de cierre (X) y título "Filtros" o "Refinar búsqueda".
- **Cuerpo**: todos los filtros de la columna izquierda de desktop en el mismo orden:
  - Búsqueda por nombre.
  - Número de jugadores (chips).
  - Duración (chips).
  - Complejidad (chips).
  - Edad (chips).
  - Temática (select).
  - Mecánicas (select).
- **Footer persistente (sticky bottom)**: botón "Aplicar filtros" siempre visible en la parte inferior del panel, sin importar cuánto se haga scroll en los filtros.
- Referencia visual: `ludoteca_mobile_filter.png`.

### 3.3 Paginación móvil

Dos botones simples de navegación sin indicador numérico de página:

| ‹ Anterior | Siguiente › |

- Sin mostrar número de página actual.
- Referencia visual: botones de flecha en `ludoteca_mobile_0.png`.

### 3.4 Grid de juegos

- **Grid de 2 columnas** fijo.
- Solo vista tarjeta (no hay opción de lista en móvil).
- Las tarjetas mantienen la misma estructura que en desktop pero adaptadas al espacio disponible.
- Referencia visual: `ludoteca_mobile_0.png`.

---

## 4. Comportamiento de las tarjetas — Detalle

### 4.1 Tarjeta en Grid

```
┌──────────────────────┐
│                      │
│    Imagen del juego  │  ← ~60% de la altura
│    (cover/contain)   │
│                      │
├──────────────────────┤
│ Nombre del juego     │
│ 👥 2–4  ⏱ 45min     │  ← Info compacta
│ 🎂 +10  ★ 4.2/5     │
│ Complejidad: ██░░░   │
└──────────────────────┘
```

### 4.2 Fila en Lista

```
┌───────┬──────────────────────────────────────────┐
│       │ Nombre del juego                         │
│ IMG   │ 👥 2–4  ⏱ 45min  🎂 +10  ★ 4.2  ██░░░  │
│       │                                          │
└───────┴──────────────────────────────────────────┘
```

---

## 5. Responsive breakpoints

| Breakpoint       | Layout                                                    |
|------------------|-----------------------------------------------------------|
| ≥1200px          | 2 columnas. Grid de juegos: 3 columnas. Vista grid/lista. |
| 768px – 1199px   | 2 columnas. Grid de juegos: 2 columnas. Vista grid/lista. |
| < 768px          | 1 columna. Grid de juegos: 2 columnas. Solo vista grid.   |

---

## 6. Estados y feedback visual

### Filtros
- **Chip activo**: fondo sólido (color primario) con texto blanco o invertido.
- **Chip inactivo**: fondo neutro con borde, texto oscuro.
- **Selects**: indicador visual cuando hay un valor seleccionado (ej: badge con contador).

### Paginación
- **Página actual**: botón con fondo destacado (color primario).
- **Otras páginas**: botón con fondo neutro.
- **Botones anterior/siguiente**: deshabilitados visualmente cuando no aplican (primera/última página).

### Vistas grid/lista
- **Vista activa**: icono con color primario o fondo destacado.
- **Vista inactiva**: icono en gris o sin fondo.

### Tarjetas
- **Hover (desktop)**: elevación sutil (sombra) o borde destacado para indicar interactividad.
- **Estado de carga**: skeleton placeholders con la forma de las tarjetas mientras se cargan los datos.

---

## 7. Consideraciones adicionales

- **Sin resultados**: cuando los filtros aplicados no devuelvan juegos, mostrar un mensaje amigable centrado en el área de resultados con una sugerencia de limpiar filtros.
- **Contador de resultados**: indicar en algún punto visible cuántos juegos coinciden con los filtros aplicados (ej: *"Se han encontrado 342 juegos"*).
- **Scroll to top**: al cambiar de página, hacer scroll automático al inicio del área de resultados.
- **Persistencia de filtros**: al navegar entre páginas los filtros y ordenación deben mantenerse. Idealmente reflejados en la URL (query params) para permitir compartir búsquedas.
- **Accesibilidad**: todos los controles interactivos deben ser accesibles por teclado. Los chips de filtro deben funcionar como toggles con roles ARIA adecuados. El panel fullscreen de filtros en móvil debe atrapar el foco (focus trap).

---

## 8. Imágenes de referencia

| Archivo                         | Descripción                                              |
|---------------------------------|----------------------------------------------------------|
| `ludoteca_desktop_0.png`        | Desktop – vista grid con filtros laterales               |
| `ludoteca_desktop_1.png`        | Desktop – vista lista con filtros laterales              |
| `ludoteca_desktop_mini_0.png`   | Desktop reducido – vista grid 2 columnas                 |
| `ludoteca_desktop_mini_1.png`   | Desktop reducido – vista lista                           |
| `ludoteca_mobile_0.png`         | Móvil – vista principal con grid 2 columnas              |
| `ludoteca_mobile_filter.png`    | Móvil – panel de filtros fullscreen                      |
| `ludoteca_mobile_order.png`     | Móvil – dropdown de ordenación visible                   |

---

## 9. Plan de implementación

### 9.1 Análisis de gaps (estado actual vs. spec)

| Funcionalidad | Estado | Notas |
|---|---|---|
| Layout 2 columnas (sidebar 300px + resultados) | ✅ Existe | `LudotecaClient.tsx` — sidebar sticky con scroll independiente |
| Búsqueda por nombre con debounce | ✅ Existe | 300ms debounce en `LudotecaClient.tsx` |
| Chips: jugadores (1–10, +10) | ✅ Existe | `FilterSidebar.tsx` — `PLAYER_OPTIONS`, toggle múltiple |
| Chips: duración (6 rangos) | ✅ Existe | `FilterSidebar.tsx` — `DURATION_OPTIONS` |
| Chips: complejidad (1–5) | ✅ Existe | `FilterSidebar.tsx` — `WEIGHT_OPTIONS` |
| Chips: edad (+3 a +18) | ✅ Existe | `FilterSidebar.tsx` — `AGE_OPTIONS` |
| Grid/List view toggle | ✅ Existe | Botones con icono en toolbar desktop |
| Paginación 48/página (numbered desktop, prev/next mobile) | ✅ Existe | `Pagination.tsx` — doble (top + bottom) |
| Mobile sticky bar (Filter/Sort) | ✅ Existe | Sticky `top-16` con badge de filtros activos |
| Mobile fullscreen filter panel | ✅ Existe | Slide-in desde izquierda con `AnimatePresence` |
| Tarjeta de juego (imagen ~60%, info ~40%) | ✅ Existe | `GameCard.tsx` — aspect-ratio 4/5 |
| Vista lista con thumbnail | ✅ Existe | `GameListRow.tsx` — thumbnail 80×80px |
| Contador de resultados | ✅ Existe | `"{count} de {total} jocs"` |
| Scroll to top al cambiar página | ✅ Existe | `scrollIntoView({ behavior: "smooth" })` |
| Estado "sin resultados" con CTA limpiar | ✅ Existe | Mensaje centrado + botón "Netejar filtres" |
| Modal detalle de juego | ✅ Existe | `GameDetailModal.tsx` — focus trap, ESC, scroll lock |
| Filtro tipo juego (base/expansión) | ✅ Existe | Select dropdown — no está en spec pero es útil, mantener |
| **Filtro Temática** (searchable multi-select) | ❌ No existe | Requiere datos de BGG + componente nuevo |
| **Filtro Mecánicas** (searchable multi-select) | ❌ No existe | Requiere datos de BGG + componente nuevo |
| **Persistencia filtros en URL** (query params) | ❌ No existe | Para compartir búsquedas |
| **Skeleton loading** placeholders | ❌ No existe | Spec §6 — tarjetas skeleton durante carga |
| **Focus trap** en panel filtros móvil | ❌ No existe | Spec §7 — accesibilidad |
| **Breakpoint 3 cols a ≥1200px** | ⚠️ Usa `lg:` (1024px) | Spec dice ≥1200px para 3 columnas |

---

### 9.2 Fases de implementación

#### Fase 1 — Data Layer: enriquecer `BggGame` con categorías y mecánicas

**Archivo:** `src/lib/bgg.ts`

**Cambios:**

1. Extender `BggGame` con dos nuevos campos:
   ```ts
   categories: string[];  // ej: ["Strategy", "Fantasy", "Economic"]
   mechanics: string[];   // ej: ["Worker Placement", "Deck Building"]
   ```

2. Extender `ThingData` con `categories: string[]` y `mechanics: string[]`.

3. En `fetchThingData()` — el endpoint thing ya se llama y parsea el array `link`. Añadir extracción de:
   - `link[@type="boardgamecategory"]` → campo `@_value` → `categories`
   - `link[@type="boardgamemechanic"]` → campo `@_value` → `mechanics`

4. En `enrichWithThingData()` — asignar `categories` y `mechanics` a cada juego desde `ThingData`.

5. En `rawToGame()` — inicializar `categories: []` y `mechanics: []`.

6. Modo mock — los XML de colección no contienen categorías/mecánicas. Opción recomendada: generar `public/mock/bgg-things.json` con datos pre-parseados. Alternativa aceptable: dejar arrays vacíos (los filtros simplemente no muestran opciones).

**Riesgo:** Nulo. La API thing ya se llama en batches de 20 — solo se parsean más campos de la respuesta existente, sin llamadas adicionales.

---

#### Fase 2 — Componente nuevo: `SearchableMultiSelect`

**Archivo nuevo:** `src/components/ludoteca/SearchableMultiSelect.tsx`

**Props:**
```ts
interface SearchableMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  label: string;
}
```

**Comportamiento:**
- **Trigger:** Botón que muestra el placeholder o un badge con el count de seleccionados.
- **Dropdown:** Al hacer click abre un panel con:
  - Input de búsqueda en la parte superior.
  - Lista filtrable de opciones con checkboxes.
  - Scroll interno si hay muchas opciones (`max-h-60 overflow-y-auto`).
- **Interacción:** Toggle por opción (selección múltiple). Cierre al click fuera (`useRef` + listener).
- **ARIA:** `role="listbox"`, `aria-multiselectable="true"`, navegación por teclado (flechas + Enter + Escape).
- **Estilo:** Coherente con los chips — `border-brand-orange` activo, `border-stone-300` inactivo.

**Patrón:** Componente controlado — el estado vive en el padre. Solo gestiona internamente la apertura del dropdown y el texto de búsqueda.

---

#### Fase 3 — Integrar filtros Temática y Mecánicas

**Archivos:** `src/components/ludoteca/LudotecaClient.tsx`, `src/components/ludoteca/FilterSidebar.tsx`

**Cambios en `LudotecaClient.tsx`:**

1. Extender `Filters`:
   ```ts
   interface Filters {
     search: string;
     gameType: "" | "boardgame" | "boardgameexpansion";
     players: number[];
     duration: string[];
     weight: number[];
     age: number[];
     categories: string[];  // NUEVO
     mechanics: string[];   // NUEVO
   }
   ```

2. Actualizar `DEFAULT_FILTERS` con `categories: []`, `mechanics: []`.

3. Añadir lógica de filtrado — un juego pasa si tiene **al menos una** de las categorías/mecánicas seleccionadas (OR dentro del mismo filtro, AND entre filtros distintos):
   ```ts
   if (filters.categories.length > 0) {
     result = result.filter(g =>
       filters.categories.some(c => g.categories.includes(c))
     );
   }
   if (filters.mechanics.length > 0) {
     result = result.filter(g =>
       filters.mechanics.some(m => g.mechanics.includes(m))
     );
   }
   ```

4. Computar listas únicas de opciones disponibles:
   ```ts
   const allCategories = useMemo(() =>
     [...new Set(games.flatMap(g => g.categories))].sort(), [games]
   );
   const allMechanics = useMemo(() =>
     [...new Set(games.flatMap(g => g.mechanics))].sort(), [games]
   );
   ```

5. Pasar `allCategories` y `allMechanics` como props a `FilterSidebar`.

6. Actualizar `hasActiveFilters` para incluir `categories.length` y `mechanics.length`.

**Cambios en `FilterSidebar.tsx`:**

1. Nuevas props: `availableCategories: string[]`, `availableMechanics: string[]`.
2. Importar `SearchableMultiSelect`.
3. Añadir dos secciones después del bloque de edad (antes del botón "Limpiar"):
   - **Temática** → `SearchableMultiSelect` con `availableCategories`.
   - **Mecánicas** → `SearchableMultiSelect` con `availableMechanics`.

---

#### Fase 4 — Persistencia de filtros en URL (query params)

**Archivo:** `src/components/ludoteca/LudotecaClient.tsx`

**Estrategia:** Sincronizar `Filters` + `sortBy` + `viewMode` + `currentPage` con search params.

**Implementación:**

1. Usar `useSearchParams()` de `next/navigation` para leer params al montar.
2. Usar `useRouter().replace()` para actualizar la URL sin navegación completa.
3. Esquema de serialización:
   ```
   ?q=catan&players=2,4&duration=30-60,60-120&weight=3&age=10
   &cat=Strategy,Fantasy&mech=Worker+Placement&sort=rating-desc&view=grid&page=2
   ```
4. Debounce la actualización de URL del campo de búsqueda (no actualizar en cada keystroke).
5. Al cambiar cualquier filtro → resetear `page` a 1 en la URL.

**Nota:** `next-intl` gestiona `[locale]` en el path. Los query params son independientes y no interfieren.

---

#### Fase 5 — Skeleton loading states

**Archivos nuevos:**
- `src/components/ludoteca/GameCardSkeleton.tsx`
- `src/components/ludoteca/GameListRowSkeleton.tsx`

**Diseño:**

- Misma estructura visual que `GameCard` / `GameListRow` pero con bloques `animate-pulse bg-stone-200` en lugar de contenido real.
- `GameCardSkeleton`: rectángulo imagen (aspect 4/5) + 3 líneas de texto.
- `GameListRowSkeleton`: cuadrado 80×80 + 2 líneas de texto a la derecha.

**Integración en `GameGrid.tsx`:**

- Nueva prop `loading?: boolean`.
- Si `loading` es `true`, renderizar 12 skeletons en lugar de tarjetas reales.
- Uso principal: durante la carga inicial de la página (SSR → hydration). Para cambios de paginación client-side los datos ya están en memoria, así que la transición es instantánea.

---

#### Fase 6 — Accesibilidad y ajustes responsive

**Archivos:** `LudotecaClient.tsx`, `GameGrid.tsx`

**6a. Focus trap en panel filtros móvil** (`LudotecaClient.tsx`):
- Implementar focus trap manual: interceptar Tab y Shift+Tab en los bordes del panel para ciclar el foco.
- Al abrir: mover foco al primer elemento interactivo (botón cerrar o input búsqueda).
- Al cerrar: devolver foco al botón "Filter" de la sticky bar.
- Alternativa: usar `focus-trap-react` si se prefiere evitar código custom (~30 líneas).

**6b. Breakpoint del grid** (`GameGrid.tsx`):
- Actual: `grid-cols-2 lg:grid-cols-3` (`lg` = 1024px en Tailwind).
- Spec: 3 columnas a ≥1200px.
- Cambiar a: `grid-cols-2 min-[1200px]:grid-cols-3` (breakpoint arbitrario de Tailwind v4).

---

#### Fase 7 — Traducciones

**Archivos:** `src/messages/ca.json`, `src/messages/es.json`, `src/messages/en.json`

**Nuevas claves (namespace `ludoteca`):**

| Clave | ca | es | en |
|---|---|---|---|
| `filter_categories_title` | Temàtica | Temática | Theme |
| `filter_categories_placeholder` | Cercar temàtica... | Buscar temática... | Search theme... |
| `filter_mechanics_title` | Mecàniques | Mecánicas | Mechanics |
| `filter_mechanics_placeholder` | Cercar mecànica... | Buscar mecánica... | Search mechanic... |
| `filter_select_placeholder` | Seleccionar... | Seleccionar... | Select... |
| `filter_selected_count` | {count} seleccionat(s) | {count} seleccionado(s) | {count} selected |

**Nota sobre nombres de categorías/mecánicas:** BGG los devuelve en inglés. Son términos estándar del hobby ("Worker Placement", "Deck Building") y se pueden mostrar tal cual. Opcionalmente, se puede crear un mapa de traducción para los más comunes en una fase posterior.

---

### 9.3 Orden de ejecución y dependencias

```
Fase 1 (Data Layer)
  └──→ Fase 2 (SearchableMultiSelect)
         └──→ Fase 3 (Integrar filtros)
                └──→ Fase 7 (Traducciones)

Fase 4 (URL params)          ← independiente, en paralelo con fases 2–3
Fase 5 (Skeletons)           ← independiente, en paralelo
Fase 6 (A11y + breakpoints)  ← al final, polish
```

---

### 9.4 Inventario de archivos impactados

| Archivo | Acción |
|---|---|
| `src/lib/bgg.ts` | Modificar — extender tipos y parseo de categories/mechanics |
| `src/components/ludoteca/SearchableMultiSelect.tsx` | **Crear** — componente reutilizable |
| `src/components/ludoteca/LudotecaClient.tsx` | Modificar — filtros, URL params, focus trap |
| `src/components/ludoteca/FilterSidebar.tsx` | Modificar — añadir Temática y Mecánicas |
| `src/components/ludoteca/GameGrid.tsx` | Modificar — breakpoint 1200px, prop loading |
| `src/components/ludoteca/GameCardSkeleton.tsx` | **Crear** — skeleton para vista grid |
| `src/components/ludoteca/GameListRowSkeleton.tsx` | **Crear** — skeleton para vista lista |
| `src/components/ludoteca/Pagination.tsx` | Sin cambios |
| `src/components/ludoteca/GameCard.tsx` | Sin cambios |
| `src/components/ludoteca/GameListRow.tsx` | Sin cambios |
| `src/components/ludoteca/GameDetailModal.tsx` | Sin cambios |
| `src/components/ludoteca/LudotecaHero.tsx` | Sin cambios |
| `src/app/[locale]/ludoteca/page.tsx` | Sin cambios |
| `src/messages/ca.json` | Modificar — 6 claves nuevas |
| `src/messages/es.json` | Modificar — 6 claves nuevas |
| `src/messages/en.json` | Modificar — 6 claves nuevas |
| `public/mock/bgg-things.json` | **Crear** (opcional) — mock data para categories/mechanics |
