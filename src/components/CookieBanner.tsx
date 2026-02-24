'use client'

import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'motion/react'
import { useCookieConsentContext } from '@/components/CookieConsentProvider'

export default function CookieBanner() {
  const { status, accept, reject, isLoaded } = useCookieConsentContext()
  const t = useTranslations('cookies')

  const showBanner = isLoaded && status === null

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="cookie-banner"
          role="dialog"
          aria-label={t('title')}
          className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] max-w-[360px] overflow-hidden rounded-2xl border border-stone-custom/15 bg-brand-beige shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:w-auto"
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
                onClick={accept}
                className="rounded-full bg-brand-orange px-5 py-2 font-semibold text-white transition-transform hover:scale-105"
              >
                {t('accept')}
              </button>
              <button
                onClick={reject}
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
