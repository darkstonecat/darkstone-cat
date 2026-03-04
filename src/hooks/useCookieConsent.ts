'use client'

import { useSyncExternalStore, useCallback } from 'react'

const STORAGE_KEY = 'darkstone_cookie_consent'
const CONSENT_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000 // 12 months

type ConsentStatus = 'accepted' | 'rejected' | null

interface ConsentData {
  status: 'accepted' | 'rejected'
  date: string
}

export interface UseCookieConsent {
  status: ConsentStatus
  accept: () => void
  reject: () => void
  isLoaded: boolean
}

// --- localStorage as an external store ---

let listeners: Array<() => void> = []

function emitChange() {
  for (const listener of listeners) listener()
}

function subscribe(callback: () => void) {
  listeners.push(callback)
  return () => {
    listeners = listeners.filter((l) => l !== callback)
  }
}

function getSnapshot(): ConsentStatus {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data: ConsentData = JSON.parse(stored)
      // Check if consent has expired (12 months)
      const consentDate = new Date(data.date).getTime()
      if (Date.now() - consentDate > CONSENT_EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return data.status
    }
  } catch {
    // localStorage not available or corrupted data
  }
  return null
}

function getServerSnapshot(): ConsentStatus {
  return null
}

// isLoaded: false on server, true on client (prevents banner flash during SSR)
const noopSubscribe = () => () => {}

export function useCookieConsent(): UseCookieConsent {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const isLoaded = useSyncExternalStore(noopSubscribe, () => true, () => false)

  const save = useCallback((newStatus: 'accepted' | 'rejected') => {
    const data: ConsentData = {
      status: newStatus,
      date: new Date().toISOString(),
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // localStorage not available
    }
    emitChange()
  }, [])

  const accept = useCallback(() => save('accepted'), [save])
  const reject = useCallback(() => save('rejected'), [save])

  return { status, accept, reject, isLoaded }
}
