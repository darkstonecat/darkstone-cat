# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Darkstone Catalunya is a landing page for a board gaming association in Terrassa, built with Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4. Deployed on Vercel.

### Key Reference Files
- `DARKSTONE-CATALUNYA.md` — Association context: identity, activities, schedule, social links, membership info, prepared web copy
- `PLANNING.md` — Development roadmap with step-by-step tasks for improving the website

### Language Convention
The primary language of the association and website is **Catalan**. All user-facing text must be translated to the 3 locales (ca, es, en). Code comments and commit messages can be in any language.

## Commands

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

No test runner is configured.

## Architecture

### Routing & i18n

Next.js App Router with `next-intl` for internationalization. Routes are under `src/app/[locale]/`. Three locales: `ca` (Catalan, default), `es`, `en`. Translation files live in `src/messages/{ca,es,en}.json`. i18n routing config is in `src/i18n/routing.ts`.

### Theme System

A scroll-driven theme system animates background and text colors as the user scrolls between sections:
- **Store**: `src/stores/useThemeStore.ts` (Zustand) holds `backgroundColor`, `textColor`, `invertTexture`
- **Hook**: `src/hooks/useThemeSection.ts` — each section calls `useThemeSection(bg, text, options?)` to register its theme colors, using Motion's `useInView` to detect visibility
- **Providers**: `ThemeProvider` wraps the page for animated text color; `FixedBackground` renders the animated background color + texture overlay

### Smooth Scrolling

Lenis library provides smooth scrolling, wrapped in a React Context via `src/components/SmoothScroll.tsx`. Access the instance with `useLenis()`. Lenis is integrated with `ScrollToTop` for scroll position tracking.

### Animation Patterns

Uses the `motion/react` library (Motion v12, framer-motion compatible):
- Spring physics for entrance animations (Hero)
- `useScroll` + `useTransform` for scroll-driven parallax
- `whileInView` for viewport-triggered fade/slide animations
- Scroll-pinned sections via sticky positioning + tall containers

### Styling

Tailwind CSS v4 with CSS-based configuration (no `tailwind.config.ts`). Color tokens defined as CSS custom properties in `src/styles/globals.css`:
- `--color-brand-red`, `--color-brand-orange`, `--color-brand-beige`, `--color-brand-blue`
- `--color-stone-custom` (dark theme), `--color-brand-white`

Use the `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional class merging.

### Component Structure

All interactive components use `"use client"` directive. The page is a single-page landing composed of sections rendered in `src/app/[locale]/page.tsx`:

Hero → About → Activities → Schedule → JoinUs → Location → Footer

**Activities** is the most complex component — it has separate desktop (scroll-pinned parallax gallery) and mobile (stacked cards) implementations with direction-aware slide transitions.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig).

### Assets

Images are in `/public/images/` — activity photos use `.webp` format under `/public/images/photos/`.

### Key Dependencies
- **Motion v12** (`motion/react`) — animations. Never import from `framer-motion` directly.
- **Lenis** — smooth scrolling
- **Zustand** — state management (theme store)
- **next-intl** — i18n routing and translations
- **react-icons** + **lucide-react** — icon libraries
- **clsx** + **tailwind-merge** — class utilities (via `cn()`)
