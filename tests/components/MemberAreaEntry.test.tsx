import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  value: { user: null as { id: string } | null, role: null as string | null, loading: false },
}))

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
vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => authState.value }))
vi.mock('@/lib/supabase/session-actions', () => ({ signOutCurrentSession: vi.fn() }))

import NavBar from '@/components/NavBar'
import LoginSignupCard from '@/components/auth/LoginSignupCard'
import { MEMBERSHIP_FORM_URL } from '@/lib/member-area'

type Variant = 'desktop' | 'mobile'

/**
 * Renders the NavBar and returns the region of one variant. The mobile menu
 * only mounts while open, so it is opened first; with it closed, the whole
 * render is the desktop bar.
 */
function renderNav(variant: Variant): HTMLElement {
  const { container } = render(<NavBar />)
  if (variant === 'desktop') return container
  fireEvent.click(screen.getByRole('button', { name: 'menu_button' }))
  return screen.getByRole('dialog')
}

function loginLinks(region: HTMLElement) {
  return within(region)
    .queryAllByRole('link')
    .filter((a) => a.getAttribute('href') === '/login')
}

const VARIANTS: Variant[] = ['desktop', 'mobile']

describe('member area entry points', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    authState.value = { user: null, role: null, loading: false }
  })

  describe('while the member area is hidden (flag unset)', () => {
    // A local .env* may set the flag; Vitest loads it, so clear it here.
    beforeEach(() => vi.stubEnv('NEXT_PUBLIC_MEMBER_AREA_PUBLIC', ''))

    it.each(VARIANTS)('the %s navbar shows no login link to a visitor', (variant) => {
      const region = renderNav(variant)
      expect(loginLinks(region)).toHaveLength(0)
      expect(within(region).queryByText('login')).toBeNull()
    })

    it.each(VARIANTS)('the %s navbar shows no login placeholder while the session loads', (variant) => {
      authState.value = { user: null, role: null, loading: true }
      const region = renderNav(variant)
      expect(within(region).queryByText('login')).toBeNull()
    })

    it('the desktop navbar still shows the user pill to a signed-in member', () => {
      authState.value = { user: { id: 'u1' }, role: 'member', loading: false }
      renderNav('desktop')
      expect(screen.getByRole('button', { name: 'profile' })).toBeTruthy()
    })

    it('the mobile navbar still shows the profile link and logout to a signed-in member', () => {
      authState.value = { user: { id: 'u1' }, role: 'member', loading: false }
      const region = renderNav('mobile')
      expect(
        within(region).queryAllByRole('link').some((a) => a.getAttribute('href') === '/profile'),
      ).toBe(true)
      expect(within(region).getByText('logout')).toBeTruthy()
    })

    it('the login page sign-up card links to the Google Form, not /register', () => {
      render(<LoginSignupCard />)
      const cta = screen.getByRole('link', { name: /login_cta_button/ })
      expect(cta.getAttribute('href')).toBe(MEMBERSHIP_FORM_URL)
      expect(cta.getAttribute('target')).toBe('_blank')
      expect(cta.getAttribute('rel')).toBe('noopener noreferrer')
    })
  })

  describe('once the member area is public (flag "1")', () => {
    beforeEach(() => vi.stubEnv('NEXT_PUBLIC_MEMBER_AREA_PUBLIC', '1'))

    it.each(VARIANTS)('the %s navbar shows the login link to a visitor', (variant) => {
      const region = renderNav(variant)
      expect(loginLinks(region)).toHaveLength(1)
    })

    it.each(VARIANTS)('the %s navbar shows the login placeholder while the session loads', (variant) => {
      authState.value = { user: null, role: null, loading: true }
      const region = renderNav(variant)
      expect(within(region).getByText('login')).toBeTruthy()
      expect(loginLinks(region)).toHaveLength(0)
    })

    it('the login page sign-up card links to /register', () => {
      render(<LoginSignupCard />)
      const cta = screen.getByRole('link', { name: /login_cta_button/ })
      expect(cta.getAttribute('href')).toBe('/register')
    })
  })
})
