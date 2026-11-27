import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// "Perfil desat" notice of /profile/details, shown after /profile/edit saves (?saved=1).

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
// The router's search params follow the test URL.
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

import ProfileSavedNotice from '@/components/profile/ProfileSavedNotice'

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

describe('ProfileSavedNotice', () => {
  it('announces the save and drops ?saved=1 from the URL, keeping other params and the hash', async () => {
    window.history.replaceState(null, '', '/profile/details?saved=1&doc=conduct#account')
    render(<ProfileSavedNotice />)
    const notice = await screen.findByTestId('profile-saved-notice')
    expect(notice).toHaveTextContent('profile_saved')
    expect(notice.closest('[aria-live="polite"]')).not.toBeNull()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/profile/details?doc=conduct#account',
    )
  })

  it('hides itself after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    window.history.replaceState(null, '', '/profile/details?saved=1')
    render(<ProfileSavedNotice />)
    expect(await screen.findByTestId('profile-saved-notice')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(8_000)
    })
    expect(screen.queryByTestId('profile-saved-notice')).toBeNull()
  })
})
