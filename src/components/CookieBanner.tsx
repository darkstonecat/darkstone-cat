'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'motion/react'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'

export default function CookieBanner() {
  const { status, accept, reject, isLoaded } = useCookieConsentContext()
  const t = useTranslations('cookies')
  const bannerRef = useRef<HTMLDivElement>(null)
  const acceptBtnRef = useRef<HTMLButtonElement>(null)

  const showBanner = isLoaded && status === null

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        reject()
      }
    },
    [reject]
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

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          ref={bannerRef}
          key="cookie-banner"
          role="dialog"
          aria-label={t('title')}
          tabIndex={-1}
          className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] max-w-90 overflow-hidden rounded-2xl border border-stone-custom/15 bg-brand-beige shadow-[0_8px_30px_rgba(0,0,0,0.6)] outline-none sm:w-auto"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
            delay: 1.2,
          }}
        >
          {/* Content */}
          <div className="p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-stone-custom">
              {t('title')}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-custom/70">
              {t('description')}
            </p>

            {/* Buttons */}
            <div className="mt-4 flex items-center gap-3">
              <button
                ref={acceptBtnRef}
                onClick={accept}
                type="button"
                className="rounded-full bg-brand-orange px-5 py-2 font-semibold text-white transition-transform hover:scale-105"
              >
                {t('accept')}
              </button>
              <button
                onClick={reject}
                type="button"
                className="text-sm text-stone-custom/80 underline transition-colors hover:text-stone-custom"
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
