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
