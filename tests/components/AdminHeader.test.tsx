import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

import AdminHeader from '@/components/admin/AdminHeader'

describe('AdminHeader', () => {
  it('renders the eyebrow, the view title and the signed-in member line with the role', () => {
    nav.pathname = '/admin/members'
    render(<AdminHeader memberName="Marta Puig" role="superadmin" />)
    expect(screen.getByText('header_eyebrow')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('tab_members')
    expect(screen.getByText('Marta Puig')).toBeInTheDocument()
    expect(screen.getByText('role_superadmin')).toBeInTheDocument()
  })

  it('labels a board member and the legacy admin role as Junta and hides Rols', () => {
    nav.pathname = '/admin'
    render(<AdminHeader memberName="Pau Ferrer" role="admin" />)
    expect(screen.getByText('role_board')).toBeInTheDocument()
    expect(screen.queryByText('tab_roles')).not.toBeInTheDocument()
  })

  it('falls back to the overview title on an unknown path', () => {
    nav.pathname = '/admin/whatever'
    render(<AdminHeader memberName="Pau Ferrer" role="board" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('tab_overview')
  })
})
