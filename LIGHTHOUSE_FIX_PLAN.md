# Plan: Fix Lighthouse Audit Issues

## Context

Lighthouse audit (2026-03-05) flagged 18 deduplicated tasks. After investigation, we exclude 4 non-actionable framework-level issues (Legacy JavaScript, bfcache, Network dependency tree — inherent to Next.js). This plan addresses the remaining **10 actionable issues** across SEO, Accessibility, and Performance.

---

## Phase 1: SEO — Fix domain mismatch (www.darkstone.cat)

**Root cause:** Code uses `https://darkstone.cat` but Vercel serves at `https://www.darkstone.cat`. Lighthouse sees canonical pointing to a different domain → "invalid canonical". This likely also causes the "missing meta description" false positives (7 pages).

**Fix:** Replace `https://darkstone.cat` with `https://www.darkstone.cat` in all SEO/canonical/structured-data URLs. Do NOT change email addresses (`darkstone.cat@gmail.com`) or social links.

**Files to modify:**

| File | Lines | Change |
|---|---|---|
| `src/lib/seo.ts` | 1 | `BASE_URL = "https://www.darkstone.cat"` |
| `src/app/sitemap.ts` | 3 | `BASE_URL = "https://www.darkstone.cat"` |
| `src/app/robots.ts` | 10 | sitemap URL → `https://www.darkstone.cat/sitemap.xml` |
| `src/app/[locale]/layout.tsx` | 36 | `metadataBase: new URL("https://www.darkstone.cat")` |
| `src/app/[locale]/layout.tsx` | 42-43 | OG image URLs → `https://www.darkstone.cat/opengraph-image/og` |
| `src/app/[locale]/layout.tsx` | 78-79, 107-109 | JSON-LD org/place IDs, url, logo, image |
| `src/app/[locale]/page.tsx` | 46-47 | OG image URLs |
| `src/app/[locale]/cookies/page.tsx` | 30-31 | OG image URLs |
| `src/app/[locale]/legal/page.tsx` | 30-31 | OG image URLs |
| `src/app/[locale]/privacy/page.tsx` | 30-31 | OG image URLs |
| `src/app/[locale]/opengraph-image.tsx` | 66 | Logo src URL |

**Also update `CLAUDE.md`:** Change `Metadata base: https://darkstone.cat` to `https://www.darkstone.cat`.

**Resolves tasks:** #3 (meta descriptions — likely false positive from domain mismatch), #4 (invalid canonical on about).

---

## Phase 2: Accessibility — Fix color contrast

**Root cause:** Text using `text-stone-600`, `text-stone-500`, and opacity modifiers (`text-stone-custom/70`, `/65`) on white backgrounds produces insufficient WCAG contrast ratios.

**Files and fixes:**

| File | Current | Fix | Elements |
|---|---|---|---|
| `src/components/ludoteca/FilterSidebar.tsx` :62-63 | `text-stone-600` | `text-stone-700` | Inactive filter chips |
| `src/components/ludoteca/SearchableMultiSelect.tsx` :145 | `text-stone-500` | `text-stone-700` | Dropdown trigger (no selection) |
| `src/components/ludoteca/SearchableMultiSelect.tsx` :214 | `text-stone-600` | `text-stone-700` | Unselected dropdown options |
| `src/components/ludoteca/Dropdown.tsx` :150 | `text-stone-600` | `text-stone-700` | Dropdown options |
| `src/components/contact/ContactForm.tsx` :144, :171 | `text-stone-custom/70` | `text-stone-custom/80` | Form labels |
| `src/components/contact/ContactInfo.tsx` :51 | `text-stone-custom/65` | `text-stone-custom/80` | Address text |
| `src/components/contact/ContactInfo.tsx` :55 | `text-stone-custom/65` | `text-stone-custom/80` | Schedule icon |

**Resolves task:** #1 (contrast on ludoteca + contact).

---

## Phase 3: Accessibility — Fix accessible names mismatch

**Root cause:** `SearchableMultiSelect` buttons have a static `aria-label` (e.g. "Categories") but visible text changes to "2 selected" when items are chosen. Lighthouse flags the mismatch.

**Fix in `src/components/ludoteca/SearchableMultiSelect.tsx`:**
- Remove the static `aria-label={label}` from the trigger `<button>`
- The visible text already describes the state; removing `aria-label` lets the button use its text content as the accessible name, which always matches

**Resolves task:** #2 (accessible names on ludoteca).

---

## Phase 4: Performance — Fix forced reflow in Activities

**Root cause:** `DesktopActivities` in `src/components/home/Activities.tsx` reads `scrollWidth` synchronously on mount (line 27), triggering a layout calculation (forced reflow).

**Fix:** Wrap the measurement in `requestAnimationFrame` to defer it to after the browser's layout pass:

```js
useEffect(() => {
  let timer: ReturnType<typeof setTimeout>;
  let rafId: number;
  const measure = () => {
    rafId = requestAnimationFrame(() => {
      setViewportWidth(window.innerWidth);
      if (innerRef.current) {
        setScrollRange(innerRef.current.scrollWidth - window.innerWidth);
      }
    });
  };
  measure();
  const handleResize = () => {
    clearTimeout(timer);
    timer = setTimeout(measure, 150);
  };
  window.addEventListener("resize", handleResize);
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", handleResize);
  };
}, []);
```

**Also check:** `src/components/NavBar.tsx` — the scroll-based section detection uses `getBoundingClientRect` inside a scroll handler. If this is causing reflow on about/contact, wrap in `requestAnimationFrame` too.

**Resolves task:** #10 (forced reflow on about/contact).

---

## Phase 5: Performance — Code-split Motion from NavBar & CookieBanner

**Root cause:** Motion library (~30KB gzipped) loads on every page because NavBar and CookieBanner import it. Legal/conduct/privacy/cookies pages don't need animation.

**Fix:** Replace Motion animations with CSS transitions in NavBar (mobile menu) and CookieBanner (slide-in). This removes the Motion import from the two components that force it onto every page.

**NavBar mobile menu** (`src/components/NavBar.tsx`):
- Replace `<AnimatePresence>` + `<motion.div>` with CSS `transition` + conditional classes
- The menu open/close is a simple slide-down + fade — achievable with `max-height`, `opacity`, and `transition`

**CookieBanner** (`src/components/CookieBanner.tsx`):
- Replace `<motion.div>` slide-in with CSS `@keyframes` or `transition` + mount class
- Simple bottom slide-up animation

**Resolves task:** #6 (reduce unused JavaScript — Motion no longer loads on static pages).

---

## Phase 6: Performance — Improve LCP on ludoteca

**Root cause:** Ludoteca LCP element (first game card image) is not discoverable from HTML — it loads after client-side JS hydration.

**Fix in `src/app/[locale]/ludoteca/page.tsx`:**
- Add `<link rel="preload">` for the first game card image in the page head (if the first image URL is deterministic from server data)
- In `GameCard.tsx`, ensure the first visible card uses `priority={true}` and `fetchPriority="high"` on its `<Image>`

**Fix in `src/components/ludoteca/GameGrid.tsx` / `GameCard.tsx`:**
- Pass a prop to mark the first N cards (e.g. first 4) as priority images
- Use `loading="eager"` instead of `loading="lazy"` for above-the-fold cards

**Resolves tasks:** #9 (image delivery), #11 (LCP breakdown), #12 (LCP request discovery), #13 (LCP), #17 (TTI), #16 (Speed Index), #18 (FCP) — all related to ludoteca mobile loading bottleneck.

---

## Excluded Issues (non-actionable)

| Task | Why excluded |
|---|---|
| #5 Legacy JavaScript | Next.js framework polyfills, not configurable |
| #7 bfcache | Next.js client-side router prevents bfcache on all SPAs |
| #8 Network dependency tree | Diagnostic audit, always scores 0, no direct fix |
| #14 Render blocking requests | Next.js CSS injection, framework-controlled |
| #15 Image width/height on home desktop | Needs verification — all images have explicit dimensions; may be a transient Lighthouse issue |

---

## Verification

1. Run `npm run build` to ensure no build errors
2. Run `npm run lint` to check for issues
3. Deploy to Vercel preview or run locally
4. Run `npm run lighthouse:prod` (or local) and compare TASKS.md:
   - SEO tasks should disappear (meta description + canonical fixed)
   - Accessibility tasks should disappear (contrast + aria)
   - Performance scores should improve on ludoteca mobile
5. Check total task count drops from 18 to ≤5 (only framework-level issues remain)
