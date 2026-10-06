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

import ActivityList, { ActivityLoadError } from '@/components/admin/activity/ActivityList'
import ActivityFilters from '@/components/admin/activity/ActivityFilters'
import { EMPTY_ACTIVITY_QUERY, type ActivityQuery } from '@/lib/admin/activity'
import type { AdminActivityRow } from '@/lib/admin/audit-format'

const NOW = new Date('2026-10-05T10:00:00Z')

const entry = (id: number, over: Partial<AdminActivityRow> = {}): AdminActivityRow => ({
  id,
  created_at: '2026-10-05T08:42:00Z',
  actor_id: 'a1',
  actor_role: 'superadmin',
  actor_member_number: '000-001',
  actor_name: 'Marta Puig',
  action: 'membership.rejoin',
  target_member_id: 't1',
  target_member_number: '000-087',
  target_name: 'Pol Roca',
  details: { channel: 'email' },
  reason: null,
  ...over,
})

const query = (over: Partial<ActivityQuery> = {}): ActivityQuery => ({ ...EMPTY_ACTIVITY_QUERY, ...over })

describe('ActivityList', () => {
  const rows = [
    entry(30),
    entry(29, { action: 'membership.leave', actor_id: 'm1', actor_role: 'member', actor_name: null, actor_member_number: '000-154', target_member_id: 'm1', target_member_number: '000-154', details: { left_by: 'self', left_on: '2026-10-04' }, created_at: '2026-10-04T16:02:00Z' }),
    entry(28, { action: 'member.purge', actor_id: null, actor_role: null, actor_name: null, actor_member_number: null, details: { left_on: '2026-01-02' } }),
    entry(27, { action: 'membership.leave', reason: '<b>Compte</b> duplicat', details: { left_by: 'board', left_on: '2026-10-01' } }),
  ]

  it('renders a captioned table with one row per entry and the count', () => {
    render(<ActivityList rows={rows} total={118} hasMore={false} query={query()} now={NOW} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('caption')).toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['col_date', 'col_actor', 'col_action', 'col_details'])
    expect(within(table).getAllByRole('row')).toHaveLength(1 + rows.length)
    expect(screen.getByText('entries_count:{"count":118}')).toBeInTheDocument()
  })

  it('shows the actor with a role chip, "ell mateix" and "Sistema"', () => {
    render(<ActivityList rows={rows} total={4} hasMore={false} query={query()} now={NOW} />)
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Marta Puig')).toHaveLength(2)
    expect(within(table).getAllByText('chip_superadmin')).toHaveLength(2)
    expect(within(table).getByText('actor_self:{"number":"000-154"}')).toBeInTheDocument()
    expect(within(table).getByText('actor_system')).toBeInTheDocument()
    // A plain member acting on themselves gets no chip.
    expect(within(table).queryByText('chip_member')).not.toBeInTheDocument()
  })

  it('words each row through the renderer and puts times in <time>', () => {
    render(<ActivityList rows={rows} total={4} hasMore={false} query={query()} now={NOW} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('sentence.membership_rejoin:{"number":"000-087"}')).toBeInTheDocument()
    expect(within(table).getByText(/^sentence\.membership_leave_self/)).toBeInTheDocument()
    expect(within(table).getAllByText('time_today:{"time":"10:42"}')[0]).toHaveAttribute('datetime', '2026-10-05T08:42:00Z')
    expect(within(table).getByText('time_yesterday:{"time":"18:02"}')).toBeInTheDocument()
  })

  it('prints the reason as plain text, never as markup', () => {
    render(<ActivityList rows={rows} total={4} hasMore={false} query={query()} now={NOW} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText(/<b>Compte<\/b> duplicat/)).toBeInTheDocument()
    expect(table.querySelector('b')).toBeNull()
  })

  it('has no link, button or menu inside the table (read-only)', () => {
    render(<ActivityList rows={rows} total={4} hasMore={false} query={query()} now={NOW} />)
    const table = screen.getByRole('table')
    expect(within(table).queryAllByRole('link')).toHaveLength(0)
    expect(within(table).queryAllByRole('button')).toHaveLength(0)
  })

  it('also renders a card per entry for mobile', () => {
    const { container } = render(<ActivityList rows={rows} total={4} hasMore={false} query={query()} now={NOW} />)
    expect(container.querySelectorAll('ul > li')).toHaveLength(rows.length)
  })

  it('links "load more" to the cursor of the last row and keeps the filters', () => {
    render(<ActivityList rows={rows} total={118} hasMore query={query({ action: 'badge.*' })} now={NOW} />)
    const more = screen.getByRole('link', { name: /load_more/ })
    expect(more).toHaveAttribute('href', '/admin/activity?action=badge.*&before=27')
    expect(more).toHaveAttribute('rel', 'next')
    expect(screen.queryByRole('link', { name: 'back_to_newest' })).not.toBeInTheDocument()
  })

  it('offers a way back to the newest entries from a later page, and no more link at the end', () => {
    render(<ActivityList rows={rows} total={118} hasMore={false} query={query({ before: 40, target: '000-087' })} now={NOW} />)
    expect(screen.getByRole('link', { name: 'back_to_newest' })).toHaveAttribute('href', '/admin/activity?target=000-087')
    expect(screen.queryByRole('link', { name: /load_more/ })).not.toBeInTheDocument()
  })

  it('shows the empty states', () => {
    const { rerender } = render(<ActivityList rows={[]} total={0} hasMore={false} query={query()} />)
    expect(screen.getByRole('status')).toHaveTextContent('empty')
    expect(screen.getByRole('status')).not.toHaveTextContent('empty_filtered')
    rerender(<ActivityList rows={[]} total={0} hasMore={false} query={query({ action: 'role.*' })} />)
    expect(screen.getByRole('status')).toHaveTextContent('empty_filtered')
  })

  it('shows the error notice with a retry link to the same view', () => {
    render(<ActivityLoadError query={query({ target: '000-203' })} />)
    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'retry' })).toHaveAttribute('href', '/admin/activity?target=000-203')
  })
})

describe('ActivityFilters', () => {
  const actors = [
    { id: 'u1', name: 'Marta Puig' },
    { id: 'u2', name: 'Pau Ferrer' },
  ]

  it('is a GET form with labelled fields that never sends the cursor', () => {
    const { container } = render(<ActivityFilters query={query({ before: 5 })} actors={actors} />)
    const form = container.querySelector('form')!
    expect(form.getAttribute('method')).toBe('get')
    for (const label of ['filter_from', 'filter_to', 'filter_actor', 'filter_action', 'filter_member']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(container.querySelector('input[name="before"]')).toBeNull()
    expect(screen.getByRole('button', { name: /apply/ })).toHaveAttribute('type', 'submit')
    expect(screen.getByRole('link', { name: 'clear' })).toHaveAttribute('href', '/admin/activity')
  })

  it('lists everyone, each board member, "ell mateix" and "Sistema" for Qui', () => {
    render(<ActivityFilters query={query()} actors={actors} />)
    const options = within(screen.getByLabelText('filter_actor')).getAllByRole('option').map((o) => [o.getAttribute('value'), o.textContent])
    expect(options).toEqual([
      ['', 'actor_everyone'],
      ['u1', 'Marta Puig'],
      ['u2', 'Pau Ferrer'],
      ['self', 'actor_self_option'],
      ['system', 'actor_system'],
    ])
  })

  it('offers all actions plus the 16 groups', () => {
    render(<ActivityFilters query={query()} actors={[]} />)
    const options = within(screen.getByLabelText('filter_action')).getAllByRole('option')
    expect(options).toHaveLength(17)
    expect(options[0]).toHaveValue('')
    expect(options.map((o) => o.getAttribute('value'))).toContain('badge.*')
    expect(options.map((o) => o.getAttribute('value'))).toContain('role.*')
  })

  it('shows the current filters', () => {
    render(<ActivityFilters query={query({ action: 'role.*', actor: 'system', target: '000-203', from: '2026-09-05', to: '2026-10-05' })} actors={actors} />)
    expect(screen.getByLabelText('filter_action')).toHaveValue('role.*')
    expect(screen.getByLabelText('filter_actor')).toHaveValue('system')
    expect(screen.getByLabelText('filter_member')).toHaveValue('000-203')
    expect(screen.getByLabelText('filter_from')).toHaveValue('2026-09-05')
    expect(screen.getByLabelText('filter_to')).toHaveValue('2026-10-05')
  })

  it('falls back to "Tothom" for a UUID that is not a board member', () => {
    render(<ActivityFilters query={query({ actor: '3f2b8c1e-5d4a-4e7b-9a10-0c2d3e4f5a6b' })} actors={actors} />)
    expect(screen.getByLabelText('filter_actor')).toHaveValue('')
  })
})
