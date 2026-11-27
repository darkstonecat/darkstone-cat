import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { ReactNode } from 'react'

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

// Motion's whileInView needs IntersectionObserver, which jsdom lacks: render
// every motion.<tag> as the plain tag without its animation props.
vi.mock('motion/react', async () => {
  const React = await import('react')
  const ANIMATION_PROPS = ['initial', 'animate', 'exit', 'whileInView', 'whileHover', 'whileTap', 'viewport', 'transition', 'variants']
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => {
          for (const key of ANIMATION_PROPS) delete props[key]
          return React.createElement(tag, props, children)
        },
    },
  )
  return { motion }
})

vi.mock('@/components/TextReveal', () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/home/SocialLinks', () => ({ default: () => null }))
vi.mock('@/components/documents/DocumentLink', () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => null }))
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))
vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => authState.value }))
vi.mock('@/lib/supabase/session-actions', () => ({ signOutCurrentSession: vi.fn() }))

import NavBar from '@/components/NavBar'
import LoginSignupCard from '@/components/auth/LoginSignupCard'
import JoinUs from '@/components/home/JoinUs'
import AboutWhyJoin from '@/components/about/AboutWhyJoin'
import AboutCTA from '@/components/about/AboutCTA'

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

/** A sign-up link: the in-site /register page, in the same tab. */
function expectRegisterLink(link: HTMLElement) {
  expect(link.getAttribute('href')).toBe('/register')
  expect(link.getAttribute('target')).toBeNull()
}

const VARIANTS: Variant[] = ['desktop', 'mobile']

describe('member area entry points', () => {
  afterEach(() => {
    authState.value = { user: null, role: null, loading: false }
  })

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

  it('the desktop navbar shows the user pill, not the login link, to a signed-in member', () => {
    authState.value = { user: { id: 'u1' }, role: 'member', loading: false }
    const { container } = render(<NavBar />)
    expect(screen.getByRole('button', { name: 'profile' })).toBeTruthy()
    expect(loginLinks(container)).toHaveLength(0)
  })

  it('the mobile navbar shows the profile link and logout to a signed-in member', () => {
    authState.value = { user: { id: 'u1' }, role: 'member', loading: false }
    const region = renderNav('mobile')
    expect(
      within(region).queryAllByRole('link').some((a) => a.getAttribute('href') === '/profile'),
    ).toBe(true)
    expect(within(region).getByText('logout')).toBeTruthy()
    expect(loginLinks(region)).toHaveLength(0)
  })

  it('the login page sign-up card links to /register', () => {
    render(<LoginSignupCard />)
    expectRegisterLink(screen.getByRole('link', { name: /login_cta_button/ }))
  })

  it('the home "join us" button links to /register', () => {
    render(<JoinUs />)
    expectRegisterLink(screen.getByRole('link', { name: /cta_button/ }))
  })

  it('the /about "why join" button links to /register', () => {
    render(<AboutWhyJoin />)
    expectRegisterLink(screen.getByRole('link', { name: /why_join_cta/ }))
  })

  it('the /about closing button links to /register', () => {
    render(<AboutCTA />)
    expectRegisterLink(screen.getByRole('link', { name: /cta_primary_button/ }))
  })
})
