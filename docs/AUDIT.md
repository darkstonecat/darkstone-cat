# Lighthouse Audit — Known Limitations

This document tracks Lighthouse audit issues that are **not actionable** due to Next.js framework limitations or inherent page complexity. These should be ignored in future audits unless the framework provides a fix.

Last verified: 2026-03-06 (production audit, all 8 pages, mobile + desktop)

## Scores at time of verification

- **Desktop**: 100/100/100/100 (Performance/Accessibility/Best Practices/SEO) — all 8 pages
- **Mobile**: 91–100 Performance, 100/100/100 remaining — all 8 pages
- **CLS**: 0 everywhere | **TBT**: 10–50 ms

## Next.js Framework Limitations

### Legacy JavaScript

Next.js ships `Array.prototype.at` polyfills in a shared chunk (`8008d994f91f0fb6.js`, ~14 KiB). This polyfill bundle is controlled by Next.js's internal browserslist and cannot be removed without ejecting from the framework.

Affects: all pages, both devices.

### Back/Forward Cache (bfcache)

Lighthouse itself marks both failure reasons as **"Not actionable"**:
- `MainResourceHasCacheControlNoStore` — Next.js serves SSR pages with `cache-control: no-store`
- `JsNetworkRequestReceivedCacheControlNoStoreResource` — same root cause

Affects: all pages, both devices.

### Network Dependency Tree

Next.js code-splitting creates chained requests (HTML → CSS → JS chunks → more JS). This is the framework's loading strategy and cannot be shortened without fundamentally changing how Next.js loads pages.

Affects: 7/8 pages (all except about), both devices.

### Render Blocking Requests

A single Next.js-extracted CSS file (~13 KB) is render-blocking by design. This prevents Flash of Unstyled Content (FOUC). Removing it would cause visible layout shifts.

Affects: 7/8 pages (all except about), both devices.

### Unused JavaScript

Flagged shared chunks (`8008d994f91f0fb6.js` at 36% unused, `0b842590e6a7ae2a.js` at 59% unused on certain pages) are Next.js shared bundles loaded across multiple pages. Code-splitting granularity is controlled at the framework level.

Affects: about, legal, privacy, cookies (both devices).

### Forced Reflow

Source reported as `[unattributed]` (63 ms total on desktop). Likely caused by Lenis smooth scrolling or Motion v12 querying layout properties. Not attributable to specific application code and impact is negligible.

Affects: home, about (desktop only).

## Expected Behavior (Page Complexity)

### Ludoteca Mobile LCP (3.3s)

The LCP element is a game card cover image (`img.object-cover` in game grid). Breakdown:
- TTFB: 37 ms (excellent)
- Resource load delay: ~3s (bottleneck — image can't be discovered until the grid renders)
- Resource load duration: 203 ms (fine)
- Element render delay: 197 ms (fine)

The 3s resource load delay is inherent to the ludoteca architecture: ISR page with ~200+ game cards using external BGG images from `cf.geekdo-images.com`. The image already has `fetchpriority="high"`. Reducing this would require fundamentally changing the page (e.g., removing the game grid above the fold).

### Ludoteca Mobile Main-Thread Work (2.2s)

Script evaluation: 739 ms, Style & Layout: 406 ms. Expected for a page rendering hundreds of game cards with filter/sort interactivity. Still scores 91 on Performance.

### Image Delivery (home + ludoteca)

Home: 108 KiB estimated savings, Ludoteca: 273 KiB. All images already pass through Next.js Image optimization with `quality={60}` and WebP. Remaining savings are marginal and come from external BGG images that are already optimized by the CDN.

### Speed Index (about 3.8s, ludoteca 3.7s mobile)

About uses heavy scroll-driven animations (sticky scroll-pin, parallax) that affect visual completeness progression. Ludoteca renders a large image grid. Both are expected given the pages' visual complexity.
