'use client'

import { useState, useEffect, useCallback } from 'react'

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
      // localStorage not available or corrupted data
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
      // localStorage not available
    }
    setStatus(newStatus)
  }, [])

  const accept = useCallback(() => save('accepted'), [save])
  const reject = useCallback(() => save('rejected'), [save])

  return { status, accept, reject, isLoaded }
}
