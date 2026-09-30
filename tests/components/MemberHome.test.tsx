import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key
  ),
  useLocale: vi.fn(() => 'ca'),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo

import HomeHero from '@/components/profile/HomeHero'
import ProfileChecklist from '@/components/profile/ProfileChecklist'
import BadgesSection from '@/components/profile/BadgesSection'
import type { ChecklistStep } from '@/lib/profile/completion'
import type { BadgeItem } from '@/lib/member-home/badge-items'

describe('HomeHero', () => {
  it('greets by first name, shows the member line and links the mini card to the card page', () => {
    render(<HomeHero firstName="Ada" lastName="Test" memberNumber="000-001" membershipStartDate="2024-03-02" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home.greeting(Ada)')
    expect(screen.getByText('000-001', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/2\/3\/2024/)).toBeInTheDocument()
    const card = screen.getByRole('link', { name: /home\.open_card/ })
    expect(card).toHaveAttribute('href', '/profile/card')
    expect(within(card).getByText('Ada Test')).toBeInTheDocument()
  })

  it('marks the Inici tab as current', () => {
    render(<HomeHero firstName="Ada" lastName="Test" memberNumber="000-001" membershipStartDate={null} />)
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('tab_home')
  })
})

describe('ProfileChecklist', () => {
  const steps = (done: boolean[]): ChecklistStep[] =>
    (['account', 'data', 'ludoya', 'bgg'] as const).map((key, i) => ({ key, done: done[i], href: `/fix/${key}` }))

  it('shows the count, the progress and a link only for incomplete steps', () => {
    render(<ProfileChecklist steps={steps([true, true, true, false])} />)
    expect(screen.getByText('checklist_count(3,4)')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/fix/bgg')
    expect(screen.getByText('step_account').className).toContain('line-through')
  })

  it('is hidden when every step is done', () => {
    const { container } = render(<ProfileChecklist steps={steps([true, true, true, true])} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('BadgesSection', () => {
  const items: BadgeItem[] = [
    { key: 'member_year', earned: true, year: 2024, since: '2024-03-02' },
    { key: 'volunteer_egara_joga', earned: false, year: null, since: null },
    { key: 'ludoteca_donor', earned: false, year: null, since: null },
  ]

  it('counts earned badges and tells locked ones apart in text', () => {
    render(<BadgesSection items={items} />)
    expect(screen.getByText('badges_count(1,3)')).toBeInTheDocument()
    expect(screen.getAllByText('badge_member_year(2024)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('badge_member_year_earned(2/3/2024)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('badge_locked')).toHaveLength(4) // 2 locked x (grid + carousel)
  })

  it('is empty-safe and renders locked badges when nothing is earned', () => {
    render(<BadgesSection items={items.map((i) => ({ ...i, earned: false, year: null, since: null }))} />)
    expect(screen.getByText('badges_count(0,3)')).toBeInTheDocument()
    expect(screen.getAllByText('badge_member_year_no_year').length).toBeGreaterThan(0)
  })

  it('exposes an accessible carousel with one group per badge and 44px controls', () => {
    render(<BadgesSection items={items} />)
    const region = screen.getByRole('region', { name: 'badges_carousel_label' })
    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    const slides = within(region).getAllByRole('group')
    expect(slides).toHaveLength(3)
    expect(slides[0]).toHaveAttribute('aria-label', 'slide_label(1,3)')
    expect(within(region).getByRole('button', { name: 'prev_badge' })).toHaveAttribute('aria-disabled', 'true')
    expect(within(region).getByRole('button', { name: 'prev_badge' }).className).toContain('size-11')
    expect(within(region).getByRole('button', { name: /dot_label\(1,/ })).toHaveAttribute('aria-current', 'true')
  })

  it('moves the current dot with the next and previous buttons', () => {
    render(<BadgesSection items={items} />)
    const region = screen.getByRole('region', { name: 'badges_carousel_label' })
    fireEvent.click(within(region).getByRole('button', { name: 'next_badge' }))
    expect(within(region).getByRole('button', { name: /dot_label\(2,/ })).toHaveAttribute('aria-current', 'true')
    expect(within(region).getByRole('button', { name: 'prev_badge' })).toHaveAttribute('aria-disabled', 'false')
    fireEvent.click(within(region).getByRole('button', { name: /dot_label\(3,/ }))
    expect(within(region).getByRole('button', { name: 'next_badge' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps the ends focusable (aria-disabled, no-op) and announces the position politely', () => {
    render(<BadgesSection items={items} />)
    const region = screen.getByRole('region', { name: 'badges_carousel_label' })
    const prev = within(region).getByRole('button', { name: 'prev_badge' })
    prev.focus()
    fireEvent.click(prev)
    expect(prev).toHaveFocus()
    expect(prev).not.toBeDisabled()
    expect(within(region).getByText('badge_position(1,3)')).toHaveAttribute('aria-live', 'polite')
    fireEvent.click(within(region).getByRole('button', { name: 'next_badge' }))
    expect(within(region).getByText('badge_position(2,3)')).toBeInTheDocument()
  })
})
