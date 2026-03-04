'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-client'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'

export default function CookieBanner() {
  const { status, accept, reject } = useCookieConsentContext()
  const t = useTranslations('cookies')
  const bannerRef = useRef<HTMLDivElement>(null)
  const acceptBtnRef = useRef<HTMLButtonElement>(null)

  // Prevent SSR rendering of motion components (AnimatePresence uses
  // React.lazy internally which produces a <Suspense> on the server
  // but a <div> on the client, causing a hydration mismatch).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount detection requires setState in effect
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const showBanner = mounted && status === null

  const focusMainContent = useCallback(() => {
    const main = document.getElementById('main-content')
    if (main) {
      main.tabIndex = -1
      main.focus({ preventScroll: true })
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        reject()
        focusMainContent()
        return
      }

      // Focus trap within the dialog
      if (e.key === 'Tab') {
        const banner = bannerRef.current
        if (!banner) return
        const focusable = banner.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [reject, focusMainContent]
  )

  // Focus the accept button when banner appears and listen for Escape
  useEffect(() => {
    if (!showBanner) return
    const timer = setTimeout(() => {
      acceptBtnRef.current?.focus()
    }, 1800) // after entry animation (1.2s delay + 0.5s duration)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showBanner, handleKeyDown])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {showBanner && (
        <m.div
          ref={bannerRef}
          key="cookie-banner"
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          aria-describedby="cookie-banner-desc"
          tabIndex={-1}
          className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] max-w-90 overflow-hidden rounded-2xl border border-stone-custom/15 bg-brand-beige shadow-[0_8px_30px_rgba(0,0,0,0.6)] outline-none sm:w-auto"
          initial={{ x: 40, opacity: 0 }}
          animate={{
            x: 0,
            opacity: 1,
            transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 1.2 },
          }}
          exit={{
            x: 40,
            opacity: 0,
            transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
          }}
        >
          {/* Content */}
          <div className="p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-stone-custom">
              {t('title')}
            </p>
            <p id="cookie-banner-desc" className="mt-1 text-sm leading-relaxed text-stone-custom/70">
              {t('description')}
            </p>

            {/* Buttons */}
            <div className="mt-4 flex items-center gap-3">
              <button
                ref={acceptBtnRef}
                onClick={() => { accept(); focusMainContent() }}
                type="button"
                className="rounded-full bg-brand-orange px-5 py-2 font-semibold text-white transition-transform hover:scale-105"
              >
                {t('accept')}
              </button>
              <button
                onClick={() => { reject(); focusMainContent() }}
                type="button"
                className="text-sm text-stone-custom/80 underline transition-colors hover:text-stone-custom"
              >
                {t('reject')}
              </button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
