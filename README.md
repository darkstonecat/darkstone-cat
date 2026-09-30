# Darkstone.cat — Board Games & RPG Association

> Official website for **Darkstone Catalunya**, a non-profit association in Terrassa (Barcelona) dedicated to board games, role-playing games, and promoting the Catalan language in the hobby.

🌐 **[darkstone.cat](https://darkstone.cat)**

---

## Features

- **Animated Landing Page** — Scroll-driven theme transitions, parallax galleries, and spring-based entrance animations
- **Ludoteca (Game Library)** — Browse the association's collection with filters, search, and BGG integration via the [BoardGameGeek API](https://boardgamegeek.com/)
- **Multilingual** — Fully localized in **Catalan** (default), **Spanish**, and **English**
- **Contact Form** — Server-side email delivery via Google Workspace SMTP (nodemailer)
- **Cookie Consent & Analytics** — GDPR-compliant banner with Google Analytics integration
- **SEO Optimized** — Dynamic OG images, JSON-LD structured data, sitemap, and robots.txt
- **Security Headers** — HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **Accessible** — WCAG AA color contrast, semantic HTML, and keyboard navigation

## Tech Stack

| Category | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Animations | [Motion v13](https://motion.dev) |
| Smooth Scroll | [Lenis](https://lenis.darkroom.engineering/) |
| i18n | [next-intl](https://next-intl-docs.vercel.app/) |
| XML Parsing | [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) |
| Email | Google Workspace SMTP ([nodemailer](https://nodemailer.com)) |
| Icons | [React Icons](https://react-icons.github.io/react-icons/) (Material Design) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Monitoring | [Vercel Analytics](https://vercel.com/analytics) + [Speed Insights](https://vercel.com/docs/speed-insights) (Speed Insights needs a paid plan, so it currently reports nothing) |
| Deployment | [Vercel](https://vercel.com) |

## Pages

| Route | Description |
|---|---|
| `/` | Landing page — Hero, About, Activities, Schedule, Join Us, Location |
| `/about` | Origin story, mission, and values |
| `/ludoteca` | Game library with filters, search, and BGG data |
| `/contact` | Contact form |
| `/events` | Upcoming events from Ludoya |
| `/events/images` | Internal tool to generate shareable event images (not indexed) |
| `/faq` | Frequently asked questions |
| `/conduct` | Code of conduct |
| `/legal` | Terms & conditions |
| `/privacy` | Privacy policy |
| `/cookies` | Cookie policy |
| `/login` | Login form |
| `/register` | Registration form |
| `/forgot-password` | Password recovery |
| `/reset-password` | Set new password (protected) |
| `/profile` | Member profile view (protected) |
| `/profile/details` | Profile details: hero, tabs and account (protected) |
| `/profile/edit` | Profile edit form (protected) |
| `/profile/card` | Member card preview & download (protected) |
| `/admin` | Admin dashboard with stats (admin only) |
| `/admin/members` | Member list with search, sort & CSV export (admin only) |
| `/data-protection` | Data protection policy (RGPD) |
| `/events/images` | Event image generator (admin only) |

All routes are localized under `/[locale]/` (`ca`, `es`, `en`).

## Project Structure

```
src/
├── app/
│   ├── [locale]/           # Localized pages (home, about, ludoteca, contact, etc.)
│   ├── api/contact/        # Contact form API endpoint
│   ├── api/events/         # Shareable event image generation
│   ├── sitemap.ts          # Dynamic sitemap generation
│   └── robots.ts           # Robots.txt configuration
├── components/
│   ├── home/               # Landing sections (Hero, About, Activities, Schedule, JoinUs, Location)
│   ├── about/              # About page sections
│   ├── ludoteca/           # Game library (grid, cards, filters, modal, pagination)
│   ├── contact/            # Contact form and info
│   ├── events/             # Events carousel and event images tool
│   ├── conduct/            # Code of conduct content
│   ├── legal/              # Legal, privacy, and cookies pages
│   ├── NavBar.tsx          # Navigation with language switcher
│   ├── Footer.tsx          # Site footer
│   ├── SmoothScroll.tsx    # Lenis smooth scrolling provider
│   ├── CookieBanner.tsx    # GDPR cookie consent
│   └── ...                 # ScrollProgress, TextReveal, etc.
├── hooks/                  # Custom hooks (useCookieConsent)
├── i18n/                   # next-intl routing and request config
├── messages/               # Translation files (ca.json, es.json, en.json)
├── lib/                    # Utilities (cn, API helpers)
└── styles/                 # Global CSS, Tailwind tokens, brand colors
```

## Getting Started

**Requires Node.js 22.19+ or 24.x** (`engines` in `package.json`). The repo ships
an `.nvmrc`, so `nvm use` picks the right one, and CI reads that same file. Older
versions fail the install on purpose instead of breaking later.

```bash
# Clone
git clone git@github.com:darkstonecat/darkstone-cat.git
cd darkstone-cat

# Use the project's Node version
nvm use

# Install
npm install

# Configure environment variables (see Environment Variables below)
# Create a .env.local file with the required keys

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the site.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run analyze` | Production build with the bundle analyzer |
| `npm run lighthouse` | Lighthouse audit (local build) |
| `npm run lighthouse:prod` | Lighthouse audit (production) |
| `npm test` | Run all Vitest tests (unit + integration) |
| `npm run test:unit` | Unit tests only (no Supabase needed) |
| `npm run test:integration` | Integration tests only (requires Supabase local) |
| `npm run test:e2e` | Playwright E2E tests (starts dev server on port 3100) |
| `npm run db:start` | Start local Supabase (requires Docker) |
| `npm run db:stop` | Stop local Supabase |
| `npm run ludoya:check` | Verify the Ludoya public API still matches what the site expects (needs `LUDOYA_API_KEY`) |

### Testing

The project has three test layers:

- **Unit tests** (Vitest) — Functions, hooks, components, API routes. No external dependencies needed.
- **Integration tests** (Vitest + Supabase local) — RLS policies, triggers, auth flows against a real local database.
- **E2E tests** (Playwright) — Full browser flows: auth, navigation, forms, profiles, admin, SEO.

To run integration and E2E tests, start the local Supabase instance first:

```bash
npm run db:start        # Once — starts PostgreSQL, Auth, etc. via Docker
npm test                # Unit + integration tests
npm run test:e2e        # E2E tests (auto-starts dev server on port 3100)
npm run db:stop         # When done
```

Integration and E2E tests read `.env.test.local` (gitignored), which must point at the local Supabase. Create it with the same values as the `env:` block of `.github/workflows/ci.yml` (local URL `http://127.0.0.1:54321`, the Supabase CLI demo keys and a dummy `ENCRYPTION_KEY`).

E2E tests that modify data must use the dedicated `editorPage` fixture, never the shared `memberPage`/`adminPage` users, because tests run fully in parallel.

CI runs all tests automatically via GitHub Actions on push/PR to `main`.

### Environment Variables

| Variable | Description |
|---|---|
| `SMTP_USER` | Google Workspace account that sends contact form email (`no-reply@darkstone.cat`) |
| `SMTP_PASSWORD` | App password of `SMTP_USER` (requires 2-Step Verification on that account) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID |
| `BGG_USERNAME` | BoardGameGeek username for the ludoteca collection |
| `BGG_API_KEY` | BoardGameGeek XML API key |
| `LUDOYA_API_KEY` | Ludoya public API key (server-side only), see `docs/ludoya-api-reference.md` |

### Development without API keys

The ludoteca works in **mock mode** when `BGG_API_KEY` is not set — it reads local XML fixtures from `/public/mock/` so you can develop the UI without hitting the BoardGameGeek API.

The events page can run offline with `LUDOYA_MOCK=1`, which reads JSON fixtures from `/public/mock/ludoya/v1/` (no API key needed).

## Architecture Highlights

**Scroll-Driven Theming** — The NavBar detects which section is at the viewport center via scroll events and applies alternating light/dark color schemes. Each home section has an `id` that maps to a theme; subpages use fixed themes per route.

**Ludoteca (Game Library)** — Server-side fetches the association's [BoardGameGeek](https://boardgamegeek.com/) collection via the XML API v2, enriches items with metadata (weight, categories, mechanics), links expansions to base games, and serves the result with ISR (daily revalidation). The client provides filtering, sorting, search, grid/list views, and pagination — all synced to URL query params.

**Activities Section** — Desktop uses scroll-pinned horizontal parallax with a sticky gallery and meeple animations; mobile uses stacked cards with direction-aware slide transitions. Completely separate implementations per breakpoint.

**Smooth Scrolling** — [Lenis](https://lenis.darkroom.engineering/) wraps the entire app in a React Context, providing buttery-smooth inertia scrolling with reduced-motion support.

**Cookie Consent** — GDPR-compliant consent banner backed by `useSyncExternalStore` for hydration-safe localStorage access. Google Analytics only loads after explicit user acceptance.

## Lighthouse Audit

The project maintains near-perfect Lighthouse scores across all 11 pages (100/100/100/100 on desktop, 91–100 Performance on mobile with 100 Accessibility/Best Practices/SEO).

Known audit limitations caused by Next.js framework constraints and expected page complexity are documented in [`docs/AUDIT.md`](docs/AUDIT.md).

## Future Improvements

### Persistent Rate Limiting

The contact form API (`src/app/api/contact/route.ts`) uses an in-memory `Map` for rate limiting (5 requests per IP per hour). This has two limitations:

1. **Cold starts**: When Vercel spins up a new serverless instance, the `Map` starts empty and previous request history is lost.
2. **Multiple instances**: If Vercel scales to 2+ instances, each has its own independent `Map`. Requests distributed across instances bypass the shared limit.

**Recommended solution**: Migrate to [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (built on Upstash Redis). The free Hobby plan includes 30,000 requests/month, more than enough for this use case. The change involves replacing `rateLimitMap.get()`/`.set()` with `kv.get()`/`kv.set()` with automatic TTL expiry.

Related: IP identification currently relies solely on the `x-forwarded-for` header (SEC03). This works correctly behind Vercel's proxy, but if the rate limiter is migrated to a persistent store, the IP identification strategy should also be reviewed.

---

Built with ❤️ in Terrassa, Catalunya
