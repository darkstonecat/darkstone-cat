import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

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
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => null }))

import AdminSidebar from '@/components/admin/nav/AdminSidebar'
import AdminSectionSwitcher from '@/components/admin/nav/AdminSectionSwitcher'
import AdminHeader from '@/components/admin/AdminHeader'

const BOARD_ORDER = [
  '/admin',
  '/admin/members',
  '/admin/activity',
  '/admin/badges',
  '/admin/benefits',
  '/admin/tools',
  '/admin/procedures',
]

function hrefs(root: HTMLElement) {
  return within(root).getAllByRole('link').map((l) => l.getAttribute('href'))
}

beforeEach(() => {
  nav.pathname = '/admin'
})

describe('AdminSidebar', () => {
  it('lists a board member’s sections in group order, without Rols', () => {
    render(<AdminSidebar isSuperadmin={false} />)
    const sidebar = screen.getByRole('navigation', { name: 'tabs_label' })
    expect(hrefs(sidebar)).toEqual(BOARD_ORDER)
    expect(within(sidebar).queryByText('tab_roles')).not.toBeInTheDocument()
  })

  it('adds Rols after Activitat for a superadmin, with the Super chip', () => {
    render(<AdminSidebar isSuperadmin />)
    const sidebar = screen.getByRole('navigation', { name: 'tabs_label' })
    expect(hrefs(sidebar)).toEqual([...BOARD_ORDER.slice(0, 3), '/admin/roles', ...BOARD_ORDER.slice(3)])
    expect(within(sidebar).getByRole('link', { name: /tab_roles/ })).toHaveTextContent('nav_superadmin_chip')
  })

  it('labels the Junta, content and maintenance groups and names their lists', () => {
    render(<AdminSidebar isSuperadmin={false} />)
    expect(screen.getByRole('list', { name: 'nav_group_board' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'nav_group_content' })).getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('list', { name: 'nav_group_maintenance' })).toBeInTheDocument()
  })

  it('marks only the section of a nested path as current', () => {
    nav.pathname = '/admin/members/000-012'
    render(<AdminSidebar isSuperadmin />)
    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')
    expect(current.map((l) => l.getAttribute('href'))).toEqual(['/admin/members'])
  })
})

describe('AdminSectionSwitcher', () => {
  it('shows the current section and opens a dialog with every section', () => {
    nav.pathname = '/admin/badges/first_game'
    render(<AdminSectionSwitcher isSuperadmin={false} />)
    const button = screen.getByRole('button', { name: /tab_badges/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')

    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: 'tabs_label' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(hrefs(dialog)).toEqual(BOARD_ORDER)
    expect(within(dialog).getByRole('link', { name: 'tab_badges' })).toHaveAttribute('aria-current', 'page')
    expect(within(dialog).getByRole('link', { name: 'tab_badges' })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the button', () => {
    render(<AdminSectionSwitcher isSuperadmin={false} />)
    const button = screen.getByRole('button', { name: /tab_overview/ })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes on the close button, on a link and on the backdrop', () => {
    render(<AdminSectionSwitcher isSuperadmin={false} />)
    const button = screen.getByRole('button', { name: /tab_overview/ })

    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: 'dialog_close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(button)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'tab_members' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(button)
    fireEvent.click(screen.getByTestId('admin-nav-backdrop'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the path changes while open', () => {
    const { rerender } = render(<AdminSectionSwitcher isSuperadmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /tab_overview/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    nav.pathname = '/admin/activity'
    rerender(<AdminSectionSwitcher isSuperadmin={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tab_activity/ })).toBeInTheDocument()
  })

  it('lists Rols in the sheet only for a superadmin', () => {
    render(<AdminSectionSwitcher isSuperadmin />)
    fireEvent.click(screen.getByRole('button', { name: /tab_overview/ }))
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: /tab_roles/ })).toHaveAttribute(
      'href',
      '/admin/roles',
    )
  })
})

describe('AdminHeader', () => {
  it('renders the eyebrow, the section title and the signed-in line with the role', () => {
    nav.pathname = '/admin/members'
    render(<AdminHeader memberName="Marta Puig" role="superadmin" />)
    expect(screen.getByText('header_eyebrow')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('tab_members')
    expect(screen.getByText('Marta Puig')).toBeInTheDocument()
    expect(screen.getAllByText('role_superadmin').length).toBeGreaterThan(0)
  })

  it('labels a board member as Junta and has no tabs of its own', () => {
    render(<AdminHeader memberName="Pau Ferrer" role="board" />)
    expect(screen.getAllByText('role_board').length).toBeGreaterThan(0)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tab_overview/ })).toBeInTheDocument()
  })

  it('falls back to the overview title on an unknown path', () => {
    nav.pathname = '/admin/whatever'
    render(<AdminHeader memberName="Pau Ferrer" role="board" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('tab_overview')
  })
})
