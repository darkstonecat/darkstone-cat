import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const nav = vi.hoisted(() => ({ pathname: '/admin' }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => nav.pathname,
}))

import AdminTabs from '@/components/admin/AdminTabs'

describe('AdminTabs', () => {
  beforeEach(() => {
    nav.pathname = '/admin'
  })

  it('shows five tabs to a board member, in the mockup order, without Rols', () => {
    render(<AdminTabs isSuperadmin={false} />)
    const links = within(screen.getByRole('navigation', { name: 'tabs_label' })).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/members',
      '/admin/activity',
      '/admin/procedures',
      '/admin/tools',
    ])
  })

  it('adds Rols for a superadmin (six tabs)', () => {
    render(<AdminTabs isSuperadmin />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(6)
    expect(links[5]).toHaveAttribute('href', '/admin/roles')
    expect(links[5]).toHaveTextContent('tab_roles')
  })

  it('marks only the current tab with aria-current', () => {
    nav.pathname = '/admin/activity'
    render(<AdminTabs isSuperadmin />)
    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '/admin/activity')
  })

  it('keeps Socis active on a member file (nested path) but not Resum', () => {
    nav.pathname = '/admin/members/000-203'
    render(<AdminTabs isSuperadmin={false} />)
    expect(screen.getByRole('link', { name: 'tab_members' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'tab_overview' })).not.toHaveAttribute('aria-current')
  })
})
