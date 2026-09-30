import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => 'ca'),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import MemberHero from '@/components/profile/MemberHero'
import MemberTabs from '@/components/profile/MemberTabs'

describe('MemberTabs', () => {
  it('links the three tabs to their routes', () => {
    render(<MemberTabs active="details" />)
    const nav = screen.getByRole('navigation', { name: 'tabs_label' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['tab_home', '/profile'],
      ['tab_details', '/profile/details'],
      ['tab_card', '/profile/card'],
    ])
  })

  it.each([
    ['home', 'tab_home'],
    ['details', 'tab_details'],
    ['card', 'tab_card'],
  ] as const)('marks only the %s tab as the current page', (active, label) => {
    render(<MemberTabs active={active} />)
    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(label)
  })
})

describe('MemberHero', () => {
  const props = {
    firstName: 'Anna',
    lastName: 'Puig',
    memberNumber: '000-001',
    membershipStartDate: '2026-09-14',
    active: 'details' as const,
  }

  it('shows the name as h1, the initials avatar (hidden from AT), number and start date', () => {
    render(<MemberHero {...props} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna Puig')
    const avatar = screen.getByTestId('member-avatar')
    expect(avatar).toHaveTextContent('AP')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('000-001')).toBeInTheDocument()
    expect(screen.getByText(/hero_since/)).toHaveTextContent('14/9/2026')
  })

  it('omits the start date when there is none', () => {
    render(<MemberHero {...props} membershipStartDate={null} />)
    expect(screen.queryByText(/hero_since/)).not.toBeInTheDocument()
  })
})
