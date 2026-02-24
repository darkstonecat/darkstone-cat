# Cookie Banner — Implementation Plan

**Darkstone Catalunya · Next.js 16 App Router · Motion v12 · Tailwind CSS v4 · next-intl**

---

## Contexte tècnic (verificat amb el codi actual)

- **Framework**: Next.js 16 App Router, React 19, TypeScript
- **Routing i18n**: `next-intl` v4.6 — locales `ca` (default), `es`, `en`
  - Traduccions a `src/messages/{ca,es,en}.json`
  - Components usen `useTranslations("namespace")` i `useLocale()`
  - Navegació via `Link`, `useRouter` de `@/i18n/routing`
- **Animacions**: Motion v12 (`motion/react`) — **MAI importar de `framer-motion`**
- **Scroll suau**: Lenis via `SmoothScroll.tsx` (Context + hook `useLenis()`)
- **Estils**: Tailwind CSS v4 amb configuració CSS (`@theme` a `globals.css`, sense `tailwind.config.ts`)
  - `bg-stone-custom` → `#1C1917` (fons fosc)
  - `bg-brand-beige` → `#EEE8DC` (fons clar)
  - `bg-brand-orange` → `#C45800` (accent principal, WCAG AA compliant)
  - Text blanc: `text-brand-white` o `text-white`
  - Text gris suau: `text-stone-white-base` → `#D6D3D1`
- **Utilitat CSS**: `cn()` de `@/lib/utils.ts` (clsx + tailwind-merge)
- **Path alias**: `@/*` → `./src/*`
- **Patró "use client"**: Tots els components interactius porten `"use client"`
- **CTA de referència**: `rounded-full bg-brand-orange px-8 py-4 text-lg font-semibold text-white hover:scale-105`

---

## Disseny del banner

**Tipus**: Drawer lateral (entra des de la dreta, baix)
**Posició**: `fixed bottom-6 right-6` — no cobreix el contingut principal
**Mida**: ~360px d'amplada màxima, compacte en altura
**Z-index**: `z-50`

### Visual

- Fons: `bg-stone-custom` (#1C1917)
- Borde esquerre: 2px sòlid `bg-brand-orange` com a accent
- Text principal: `text-white`
- Text secundari: `text-stone-white-base` (#D6D3D1)
- Border radius: `rounded-lg` — fidel a l'estètica del site

### Animació (Motion v12)

```
entrada:  x: 40, opacity: 0  →  x: 0, opacity: 1
          ease: [0.22, 1, 0.36, 1], duration: 0.5
          delay: 1.2s (per no competir amb l'animació de PageIntro)
sortida:  x: 40, opacity: 0
          ease: [0.55, 0, 1, 0.45], duration: 0.3
```

### Botons

- **Acceptar**: `bg-brand-orange text-white rounded-full px-5 py-2 font-semibold hover:scale-105 transition-transform`
- **Rebutjar**: `text-stone-white-base hover:text-white underline text-sm transition-colors` (subtil)

---

## Fitxers a crear

### 1. `src/hooks/useCookieConsent.ts`

Hook que gestiona l'estat del consentiment via `localStorage`.

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'darkstone_cookie_consent'

type ConsentStatus = 'accepted' | 'rejected' | null

interface ConsentData {
  status: 'accepted' | 'rejected'
  date: string
}

export interface UseCookieConsent {
  status: ConsentStatus       // null = no ha decidit encara
  accept: () => void
  reject: () => void
  isLoaded: boolean           // false durant SSR/hidratació
}

export function useCookieConsent(): UseCookieConsent {
  const [status, setStatus] = useState<ConsentStatus>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data: ConsentData = JSON.parse(stored)
        setStatus(data.status)
      }
    } catch {
      // localStorage no disponible o dades corruptes
    }
    setIsLoaded(true)
  }, [])

  const save = useCallback((newStatus: 'accepted' | 'rejected') => {
    const data: ConsentData = {
      status: newStatus,
      date: new Date().toISOString(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // localStorage no disponible
    }
    setStatus(newStatus)
  }, [])

  const accept = useCallback(() => save('accepted'), [save])
  const reject = useCallback(() => save('rejected'), [save])

  return { status, accept, reject, isLoaded }
}
```

**Nota**: El directori `src/hooks/` ja existeix però està buit. Aquest serà el primer hook custom del projecte.

---

### 2. `src/components/CookieConsentProvider.tsx`

Context React que exposa el hook globalment. Segueix el patró de `SmoothScroll.tsx` (context + hook al mateix fitxer).

**No es crea `src/context/`** — el projecte no té aquest directori i el patró existent és posar context dins `src/components/`.

```typescript
'use client'

import { createContext, useContext } from 'react'
import { useCookieConsent, type UseCookieConsent } from '@/hooks/useCookieConsent'

const CookieConsentContext = createContext<UseCookieConsent>({
  status: null,
  accept: () => {},
  reject: () => {},
  isLoaded: false,
})

export function useCookieConsentContext(): UseCookieConsent {
  return useContext(CookieConsentContext)
}

export default function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const consent = useCookieConsent()

  return (
    <CookieConsentContext.Provider value={consent}>
      {children}
    </CookieConsentContext.Provider>
  )
}
```

---

### 3. `src/components/CookieBanner.tsx`

Component principal del banner. Usa `next-intl` per traduccions (com tots els altres components).

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'motion/react'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'

export default function CookieBanner() {
  const { status, accept, reject, isLoaded } = useCookieConsentContext()
  const t = useTranslations('cookies')

  const showBanner = isLoaded && status === null

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="cookie-banner"
          role="dialog"
          aria-label={t('title')}
          className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] max-w-[360px] overflow-hidden rounded-lg bg-stone-custom shadow-2xl sm:w-auto"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
            delay: 1.2,
          }}
        >
          {/* Accent bar esquerra */}
          <div className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-brand-orange" />

          {/* Contingut */}
          <div className="p-5 pl-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-white">
              {t('title')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-white-base">
              {t('description')}
            </p>

            {/* Botons */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={accept}
                className="rounded-full bg-brand-orange px-5 py-2 font-semibold text-white transition-transform hover:scale-105"
              >
                {t('accept')}
              </button>
              <button
                onClick={reject}
                className="text-sm text-stone-white-base underline transition-colors hover:text-white"
              >
                {t('reject')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Diferències respecte el pla original**:
- ❌ ~~Rep `locale` com a prop~~ → ✅ Usa `useTranslations('cookies')` de `next-intl`
- ❌ ~~Textos hardcodejats~~ → ✅ Traduccions als JSON (`src/messages/{ca,es,en}.json`)
- ❌ ~~Importa de `framer-motion`~~ → ✅ Importa de `motion/react`
- ❌ ~~Link a política de cookies~~ → ✅ Eliminat (no hi ha pàgina de política de cookies al projecte)
- ✅ Afegit `role="dialog"` i `aria-label` per accessibilitat
- ✅ Responsive: `w-[calc(100%-3rem)]` en mòbil, `max-w-[360px]` en desktop

---

### 4. `src/components/GoogleAnalytics.tsx`

Component que carrega GA4 **només si** hi ha consentiment acceptat.

```typescript
'use client'

import Script from 'next/script'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function GoogleAnalytics() {
  const { status } = useCookieConsentContext()

  if (status !== 'accepted') return null
  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
```

---

## Fitxers a modificar

### 5. `src/messages/{ca,es,en}.json`

Afegir el namespace `"cookies"` a cada fitxer de traduccions:

**ca.json:**
```json
"cookies": {
  "title": "Cookies",
  "description": "Usem Google Analytics per entendre com s'usa la web. Cap dada es ven a tercers.",
  "accept": "Acceptar",
  "reject": "Rebutjar"
}
```

**es.json:**
```json
"cookies": {
  "title": "Cookies",
  "description": "Usamos Google Analytics para entender cómo se usa la web. Ningún dato se vende a terceros.",
  "accept": "Aceptar",
  "reject": "Rechazar"
}
```

**en.json:**
```json
"cookies": {
  "title": "Cookies",
  "description": "We use Google Analytics to understand how the site is used. No data is sold to third parties.",
  "accept": "Accept",
  "reject": "Reject"
}
```

---

### 6. `src/app/[locale]/layout.tsx`

Afegir el provider i els components al layout. **Important**: El layout és un server component async amb `params: Promise<{locale: string}>`. El `CookieConsentProvider` és client, s'ha d'aniuar dins `NextIntlClientProvider`.

**Modificació concreta** — afegir dins `<SmoothScroll>`, després de `{children}`:

```tsx
// Imports a afegir:
import CookieConsentProvider from '@/components/CookieConsentProvider'
import CookieBanner from '@/components/CookieBanner'
import GoogleAnalytics from '@/components/GoogleAnalytics'

// Dins el return, canviar:
<SmoothScroll>
  {children}
</SmoothScroll>

// Per:
<SmoothScroll>
  <CookieConsentProvider>
    {children}
    <CookieBanner />
    <GoogleAnalytics />
  </CookieConsentProvider>
</SmoothScroll>
```

**Nota**: El `CookieConsentProvider` va DINS de `NextIntlClientProvider` (que ja està a sobre) perquè `CookieBanner` necessita `useTranslations()`. Va dins de `SmoothScroll` per coherència amb l'arbre de components existent. No cal tocar res més del layout.

---

### 7. `.env.local` (crear si no existeix)

El projecte ja té `.env` amb credencials de Supabase. Crear `.env.local` separat:

```env
# Google Analytics 4 - afegir el Measurement ID quan la web estigui publicada
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

---

## Checklist de verificació

Un cop implementat, verificar:

- [ ] El banner NO apareix en el primer render (SSR) — `isLoaded` evita flash
- [ ] El banner apareix amb delay d'~1.2s (no solapa amb PageIntro)
- [ ] En acceptar: desapareix amb animació suau (`exit` de Motion)
- [ ] En rebutjar: desapareix igual
- [ ] Refresh després d'acceptar/rebutjar: el banner NO torna a aparèixer
- [ ] Sense `NEXT_PUBLIC_GA_MEASUREMENT_ID`: cap script de GA4 es carrega
- [ ] El banner es veu correctament en mòbil (responsive amb `w-[calc(100%-3rem)]`)
- [ ] Textos surten en l'idioma correcte (ca/es/en) via `useTranslations`
- [ ] Navegant entre locales, l'estat del banner es manté (localStorage)
- [ ] `npm run build` passa sense errors
- [ ] Accessibilitat: `role="dialog"` i `aria-label` presents

---

## Estructura final de fitxers

```
src/
├── app/
│   └── [locale]/
│       └── layout.tsx                         ← MODIFICAR (afegir provider + components)
├── components/
│   ├── CookieBanner.tsx                       ← CREAR
│   ├── CookieConsentProvider.tsx              ← CREAR (context + hook consumer)
│   └── GoogleAnalytics.tsx                    ← CREAR
├── hooks/
│   └── useCookieConsent.ts                    ← CREAR
├── messages/
│   ├── ca.json                                ← MODIFICAR (afegir namespace "cookies")
│   ├── es.json                                ← MODIFICAR (afegir namespace "cookies")
│   └── en.json                                ← MODIFICAR (afegir namespace "cookies")
└── .env.local                                 ← CREAR (variable GA buida)
```

---

## Notes per a Claude Code

1. **No instal·lar cap dependència nova** — Motion v12 i next-intl ja són al projecte
2. **No modificar `globals.css`** — Tailwind v4 amb `@theme`, els colors ja existeixen
3. **Importar sempre de `motion/react`** — mai de `framer-motion`
4. **Usar `useTranslations()`** per traduccions — mai hardcodejar textos
5. **Default exports** per components (patró del projecte) — Named exports per hooks/utilitats
6. **Path alias `@/`** → `./src/` — mantenir consistència
7. **Layout async**: `params` és `Promise<{locale: string}>` — no trencar la signatura
8. **`.env` existent**: conté credencials Supabase — NO tocar, crear `.env.local` apart
