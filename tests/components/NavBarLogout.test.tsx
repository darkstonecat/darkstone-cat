import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockSignOut = vi.hoisted(() => vi.fn())

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/about',
}))

vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => null }))
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))
vi.mock('@/hooks/useAuthUser', () => ({
  useAuthUser: () => ({ user: { id: 'u1' }, role: 'member', loading: false }),
}))
vi.mock('@/lib/supabase/session-actions', () => ({ signOutCurrentSession: mockSignOut }))

import NavBar from '@/components/NavBar'

describe('NavBar logout', () => {
  const originalLocation = window.location
  let hrefSetter: ReturnType<typeof vi.fn<(v: string) => void>>

  beforeEach(() => {
    vi.clearAllMocks()
    hrefSetter = vi.fn<(v: string) => void>()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: Object.defineProperty({}, 'href', { set: hrefSetter, get: () => 'http://localhost/' }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  function openMenuAndLogout() {
    render(<NavBar />)
    // The desktop user button (no first name in the mock, so it reads "profile") opens the dropdown
    fireEvent.click(screen.getByRole('button', { name: 'profile' }))
    fireEvent.click(screen.getAllByText('logout')[0])
  }

  it('revokes the session server-side before the hard redirect', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    openMenuAndLogout()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/'))
  })

  it('still redirects when the server action fails', async () => {
    mockSignOut.mockRejectedValue(new Error('network'))
    openMenuAndLogout()
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/'))
  })

  it('stops waiting for a hung server action after about three seconds', async () => {
    vi.useFakeTimers()
    mockSignOut.mockReturnValue(new Promise(() => {}))
    openMenuAndLogout()
    expect(hrefSetter).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })
    expect(hrefSetter).toHaveBeenCalledWith('/')
  })
})
