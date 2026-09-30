'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

// Same pattern as `usePrefersReducedMotion`: `false` while hydrating, so the
// first client render matches the server HTML, then the real value.
const getServerSnapshot = () => false

/** Hydration-safe "below the `md` breakpoint" (Tailwind `md` = 768 px). */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
