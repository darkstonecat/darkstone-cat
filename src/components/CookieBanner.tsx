'use client'

import { useEffect, useRef, useCallback, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'

export default function CookieBanner() {
  const { status, accept, reject } = useCookieConsentContext()
  const t = useTranslations('cookies')
  const bannerRef = useRef<HTMLDivElement>(null)
  const acceptBtnRef = useRef<HTMLButtonElement>(null)
  const [isClosing, setIsClosing] = useState(false)

  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const showBanner = mounted && status === null

  const focusMainContent = useCallback(() => {
    const main = document.getElementById('main-content')
    if (main) {
      main.tabIndex = -1
      main.focus({ preventScroll: true })
    }
  }, [])

  const handleDismiss = useCallback(
    (action: 'accept' | 'reject') => {
      setIsClosing(true)
      setTimeout(() => {
        if (action === 'accept') accept()
        else reject()
        focusMainContent()
      }, 300)
    },
    [accept, reject, focusMainContent]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss('reject')
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
    [handleDismiss]
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

  if (!mounted || !showBanner) return null

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      aria-describedby="cookie-banner-desc"
      tabIndex={-1}
      className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] max-w-90 overflow-hidden rounded-2xl border border-stone-custom/15 bg-brand-beige shadow-[0_8px_30px_rgba(0,0,0,0.6)] outline-none sm:w-auto"
      style={{
        animation: isClosing
          ? 'cookie-banner-exit 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards'
          : 'cookie-banner-enter 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.2s both',
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
            onClick={() => handleDismiss('accept')}
            type="button"
            className="rounded-full bg-brand-orange px-5 py-2 font-semibold text-white transition-transform hover:scale-105"
          >
            {t('accept')}
          </button>
          <button
            onClick={() => handleDismiss('reject')}
            type="button"
            className="text-sm text-stone-custom/80 underline transition-colors hover:text-stone-custom"
          >
            {t('reject')}
          </button>
        </div>
      </div>
    </div>
  )
}
