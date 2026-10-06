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

import MemberHeader from '@/components/profile/MemberHeader'
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

describe('MemberHeader', () => {
  const props = {
    title: 'Anna Puig',
    memberNumber: '000-001',
    membershipStartDate: '2026-09-14',
    active: 'details' as const,
  }

  it('shows eyebrow, title as h1, number, start date and tabs, with children below the tabs', () => {
    render(
      <MemberHeader {...props}>
        <p>extra</p>
      </MemberHeader>
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna Puig')
    expect(screen.getByText('card.eyebrow')).toBeInTheDocument()
    expect(screen.getByText('000-001', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/hero_since/)).toHaveTextContent('14/9/2026')
    const nav = screen.getByRole('navigation', { name: 'tabs_label' })
    expect(nav.compareDocumentPosition(screen.getByText('extra')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('omits the start date when there is none and renders the aside', () => {
    render(<MemberHeader {...props} membershipStartDate={null} aside={<div>side</div>} />)
    expect(screen.queryByText(/hero_since/)).not.toBeInTheDocument()
    expect(screen.getByText('side')).toBeInTheDocument()
  })
})
