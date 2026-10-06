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

import AdminOverview from '@/components/admin/overview/AdminOverview'
import type { AdminStatsRow } from '@/lib/admin/stats'
import type { AdminActivityRow } from '@/lib/admin/audit-format'

const stats: AdminStatsRow = {
  active_members: 168,
  former_members: 12,
  joined_this_month: 4,
  left_this_month: 1,
  left_this_month_self: 1,
  left_this_month_board: 0,
  rejoined_this_year: 2,
  newsletter_members: 97,
  board_members: 7,
  superadmins: 2,
}

const NOW = new Date('2026-10-05T10:00:00Z')
const entry = (id: number, over: Partial<AdminActivityRow> = {}): AdminActivityRow => ({
  id,
  created_at: '2026-10-05T08:42:00Z',
  actor_id: 'a1',
  actor_role: 'board',
  actor_member_number: '000-001',
  actor_name: 'Marta Puig',
  action: 'membership.rejoin',
  target_member_id: 't1',
  target_member_number: '000-087',
  target_name: null,
  details: {},
  reason: null,
  ...over,
})

describe('AdminOverview', () => {
  it('renders the six figures with their values and hints', () => {
    render(<AdminOverview stats={stats} activity={[]} now={NOW} />)
    const figures = screen.getByRole('region', { name: 'figures_title' })
    const cards = ['stat_active', 'stat_joined', 'stat_left', 'stat_rejoined', 'stat_newsletter', 'stat_board']
    const values = ['168', '4', '1', '2', '97', '7']
    cards.forEach((label, i) => {
      const card = within(figures).getByText(label).parentElement!
      expect(within(card).getByText(values[i])).toBeInTheDocument()
    })
    expect(within(figures).getByText('stat_left_hint:{"self":1,"board":0}')).toBeInTheDocument()
    expect(within(figures).getByText('stat_newsletter_hint:{"percent":58}')).toBeInTheDocument()
    expect(within(figures).getByText('stat_board_hint:{"count":2}')).toBeInTheDocument()
  })

  it('does not make the figure cards links', () => {
    render(<AdminOverview stats={stats} activity={[]} now={NOW} />)
    expect(within(screen.getByRole('region', { name: 'figures_title' })).queryAllByRole('link')).toHaveLength(0)
  })

  it('shows a notice and a retry link when the figures failed, but still the rest', () => {
    render(<AdminOverview stats={null} activity={[entry(1)]} now={NOW} />)
    expect(screen.getByText('stats_error')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'retry' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('region', { name: 'activity_title' })).toBeInTheDocument()
  })

  it('lists recent activity as an ordered list through the shared renderer', () => {
    render(
      <AdminOverview
        stats={stats}
        activity={[entry(2), entry(1, { action: 'made.up', actor_id: null, actor_name: null, actor_member_number: null })]}
        now={NOW}
      />
    )
    const section = screen.getByRole('region', { name: 'activity_title' })
    const items = within(within(section).getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Marta Puig')).toBeInTheDocument()
    expect(within(items[0]).getByText(/sentence\.membership_rejoin:.*000-087/)).toBeInTheDocument()
    expect(within(items[1]).getByText('actor_system')).toBeInTheDocument()
    expect(within(items[1]).getByText(/sentence\.unknown_target/)).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: /activity_all/ })).toHaveAttribute('href', '/admin/activity')
  })

  it('shows the empty message when the log has no entry', () => {
    render(<AdminOverview stats={stats} activity={[]} now={NOW} />)
    expect(screen.getByRole('status')).toHaveTextContent('activity_empty')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows an error notice when the activity failed', () => {
    render(<AdminOverview stats={stats} activity={null} now={NOW} />)
    expect(screen.getByText('activity_error')).toBeInTheDocument()
  })

  it('offers the four shortcuts as real links', () => {
    render(<AdminOverview stats={stats} activity={[]} now={NOW} />)
    const aside = screen.getByRole('complementary', { name: 'shortcuts_title' })
    const hrefs = within(aside).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/admin/members', '/admin/members', '/admin/tools', '/admin/procedures'])
  })

  it('puts the shortcuts first on mobile and recent activity first on desktop', () => {
    const { container } = render(<AdminOverview stats={stats} activity={[]} now={NOW} />)
    const grid = container.querySelector('.lg\\:grid-cols-\\[2fr_1fr\\]')!
    expect(grid.children[0].className).toContain('order-2')
    expect(grid.children[1].className).toContain('order-1')
  })
})
