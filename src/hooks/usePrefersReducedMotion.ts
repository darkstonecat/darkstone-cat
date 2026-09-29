'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

// The server cannot know the preference. During hydration React uses this
// server snapshot on the client too, so the first render matches the server
// HTML, and it re-renders with the real preference right after.
function getServerSnapshot() {
  return false
}

/**
 * Hydration-safe `prefers-reduced-motion`. Use it to change animation values,
 * such as collapsing a scroll-linked `useTransform` range; it is `false` until
 * hydration completes. Motion's `useReducedMotion` returns the real value on
 * the first client render, which breaks hydration if it changes the markup.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
