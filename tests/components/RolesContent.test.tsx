import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import RolesContent from '@/components/admin/roles/RolesContent'

const holder = (id: string, number: string, name: string, since: string | null = '2026-09-14T09:00:00Z') => ({
  id,
  member_number: number,
  name,
  role_since: since,
})

describe('RolesContent', () => {
  it('lists holders with the date, a link to their file and a "you" marker', () => {
    render(
      <RolesContent
        superadmins={[holder('a', '000-001', 'Marta Puig'), holder('b', '000-002', 'Pau Ferrer', null)]}
        board={[holder('c', '000-014', 'Núria Vidal')]}
        viewerId="a"
      />
    )
    const supers = screen.getByRole('region', { name: 'superadmins_title' })
    expect(within(supers).getByText('you')).toBeInTheDocument()
    expect(within(supers).getByText(/since:.*14\/9\/2026/)).toBeInTheDocument()
    expect(within(supers).getByText(/since_unknown/)).toBeInTheDocument()
    expect(within(supers).getAllByRole('link', { name: 'view_file' })[0]).toHaveAttribute('href', '/admin/members/000-001')
    const board = screen.getByRole('region', { name: 'board_title' })
    expect(within(board).getByText('Núria Vidal')).toBeInTheDocument()
    expect(within(board).queryByText('you')).not.toBeInTheDocument()
  })

  it('explains the minimum of two superadmins and shows an empty state and a load error', () => {
    render(<RolesContent superadmins={[]} board={[]} viewerId="a" loadError />)
    expect(screen.getByText('min_two')).toBeInTheDocument()
    expect(screen.getAllByText('empty')).toHaveLength(2)
    expect(screen.getByRole('alert')).toHaveTextContent('load_error')
  })
})
