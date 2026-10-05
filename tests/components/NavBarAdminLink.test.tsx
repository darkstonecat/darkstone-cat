import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'member' as string | null }))

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
  useAuthUser: () => ({ user: { id: 'u1' }, role: auth.role, loading: false }),
}))
vi.mock('@/lib/supabase/session-actions', () => ({ signOutCurrentSession: vi.fn() }))

import NavBar from '@/components/NavBar'

function adminLinks() {
  render(<NavBar />)
  fireEvent.click(screen.getByRole('button', { name: 'profile' }))
  return document.querySelectorAll('a[href="/admin"]')
}

describe('NavBar admin link', () => {
  beforeEach(() => {
    auth.role = 'member'
  })

  it.each(['board', 'admin', 'superadmin'])('is shown to %s', (role) => {
    auth.role = role
    expect(adminLinks().length).toBeGreaterThan(0)
  })

  it.each(['member', null, 'owner'])('is hidden from %s', (role) => {
    auth.role = role
    expect(adminLinks()).toHaveLength(0)
  })
})
