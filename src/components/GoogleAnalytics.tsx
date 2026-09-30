'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'
import { usePathname } from '@/i18n/routing'
import { VERIFY_PATH_PATTERN, isVerifyPath } from '@/lib/analytics-scrub'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function GoogleAnalytics() {
  const { status } = useCookieConsentContext()
  const pathname = usePathname()

  // Card verify URLs contain a token: GA is switched off (documented `ga-disable-<ID>` flag) while
  // the visitor is on them, including after a client-side navigation.
  useEffect(() => {
    if (!GA_ID) return
    ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = isVerifyPath(pathname)
  }, [pathname])

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
          window['ga-disable-${GA_ID}'] = /${VERIFY_PATH_PATTERN.source}/.test(window.location.pathname);
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}
