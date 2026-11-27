import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
}))
// Render motion.<tag> as the plain tag; scroll values are not needed here.
vi.mock('motion/react-client', async () => {
  const React = await import('react')
  const tag = (name: string) => {
    const Tag = ({ children, style: _style, ...props }: { children?: ReactNode; style?: unknown }) =>
      React.createElement(name, props, children)
    Tag.displayName = `m.${name}`
    return Tag
  }
  return { section: tag('section'), div: tag('div'), h1: tag('h1') }
})
vi.mock('motion/react', () => ({
  useScroll: () => ({ scrollYProgress: 0 }),
  useTransform: () => 0,
}))
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => authState.value }))

import Hero from '@/components/home/Hero'

function heroCta() {
  return screen.getByRole('link', { name: /cta/ })
}

describe('home hero call to action', () => {
  afterEach(() => {
    authState.value = { user: null, role: null, loading: false }
  })

  it('a visitor is sent to the web sign-up', () => {
    render(<Hero />)
    expect(heroCta().getAttribute('href')).toBe('/register')
    expect(heroCta().textContent).toContain('cta')
    expect(heroCta().textContent).not.toContain('cta_member')
  })

  it('shows the visitor button while the session loads', () => {
    authState.value = { user: null, role: null, loading: true }
    render(<Hero />)
    expect(heroCta().getAttribute('href')).toBe('/register')
  })

  it('a signed-in member is sent to the events', () => {
    authState.value = { user: { id: 'u1' }, role: 'member', loading: false }
    render(<Hero />)
    expect(heroCta().getAttribute('href')).toBe('/events')
    expect(heroCta().textContent).toContain('cta_member')
  })
})
