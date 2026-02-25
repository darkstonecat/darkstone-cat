'use client'

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'darkstone_cookie_consent'

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

export function useCookieConsent(): UseCookieConsent {
  const [state, setState] = useState<{status: ConsentStatus, isLoaded: boolean}>(() => {
    if (typeof window === 'undefined') return { status: null, isLoaded: false }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data: ConsentData = JSON.parse(stored)
        return { status: data.status, isLoaded: true }
      }
    } catch {
      // localStorage not available or corrupted data
    }
    return { status: null, isLoaded: true }
  })

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
    setState(prev => ({ ...prev, status: newStatus }))
  }, [])

  const accept = useCallback(() => save('accepted'), [save])
  const reject = useCallback(() => save('rejected'), [save])

  return { status: state.status, accept, reject, isLoaded: state.isLoaded }
}
