import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'

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

import MembersList, { MembersLoadError } from '@/components/admin/members/MembersList'
import MembersFilters from '@/components/admin/members/MembersFilters'
import MembersExports from '@/components/admin/members/MembersExports'
import { DEFAULT_MEMBERS_QUERY, type AdminMemberListRow, type MembersQuery } from '@/lib/admin/members-list'

const row = (n: string, over: Partial<AdminMemberListRow> = {}): AdminMemberListRow => ({
  id: `id-${n}`,
  member_number: n,
  first_name: `First${n}`,
  last_name: 'Last',
  email: `${n}@example.com`,
  has_login: true,
  state: 'active',
  role: 'member',
  membership_start_date: '2019-02-03',
  current_joined_on: '2019-02-03',
  left_on: null,
  total_count: 30,
  ...over,
})

const query = (over: Partial<MembersQuery> = {}): MembersQuery => ({ ...DEFAULT_MEMBERS_QUERY, ...over })

describe('MembersList', () => {
  it('renders the table and the cards with links to the member file', () => {
    render(<MembersList rows={[row('000-001'), row('000-002')]} total={2} query={query()} />)
    const table = screen.getByRole('table')
    const links = within(table).getAllByRole('link', { name: /000-00/ })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/admin/members/000-001', '/admin/members/000-002'])
    // Mobile cards: one link per member as well.
    expect(screen.getAllByRole('link', { name: /First000-001/ })[0]).toHaveAttribute('href', '/admin/members/000-001')
    expect(within(table).getByText('First000-001 Last')).toBeInTheDocument()
    expect(within(table).getAllByText('3/2/2019').length).toBe(2)
  })

  it('shows state and role chips; a plain member is text, never DNI or phone columns', () => {
    render(
      <MembersList
        rows={[
          row('1'),
          row('2', { state: 'former', left_on: '2025-06-10', role: 'member' }),
          row('3', { role: 'board' }),
          row('4', { role: 'admin' }),
          row('5', { role: 'superadmin' }),
        ]}
        total={5}
        query={query({ state: 'all' })}
      />,
    )
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('chip_active')).toHaveLength(4)
    expect(within(table).getByText('left_since:{"date":"10/6/2025"}')).toBeInTheDocument()
    expect(within(table).getAllByText('chip_board')).toHaveLength(2)
    expect(within(table).getAllByText('chip_superadmin')).toHaveLength(1)
    expect(within(table).getAllByText('role_member')).toHaveLength(2)
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['col_number', 'col_name', 'col_email', 'col_state', 'col_role', 'col_joined'])
  })

  it('shows a dash when an anonymised member has no e-mail', () => {
    render(<MembersList rows={[row('1', { email: null, has_login: false })]} total={1} query={query()} />)
    expect(within(screen.getByRole('table')).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('marks the sorted column with aria-sort and links headers to the opposite direction', () => {
    render(<MembersList rows={[row('1')]} total={1} query={query({ sort: 'name_asc', q: 'laia' })} />)
    const name = screen.getByRole('columnheader', { name: /col_name/ })
    expect(name).toHaveAttribute('aria-sort', 'ascending')
    expect(within(name).getByRole('link')).toHaveAttribute('href', '/admin/members?q=laia&sort=name_desc')
    expect(screen.getByRole('columnheader', { name: /col_number/ })).toHaveAttribute('aria-sort', 'none')
  })

  it('paginates: count text, next link keeps the filters, previous is disabled on page 1', () => {
    render(
      <MembersList
        rows={Array.from({ length: 12 }, (_, i) => row(String(i + 1), { total_count: 30 }))}
        total={30}
        query={query({ role: 'board', page: 1 })}
      />,
    )
    expect(screen.getByText('showing:{"from":1,"to":12,"total":30}')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'next' })).toHaveAttribute('href', '/admin/members?role=board&page=2')
    expect(screen.getByLabelText('prev')).not.toHaveAttribute('href')
    expect(screen.getByLabelText('prev')).toHaveAttribute('aria-disabled', 'true')
  })

  it('on the last page next is disabled and previous goes back', () => {
    render(
      <MembersList rows={[row('29'), row('30')].map((r) => ({ ...r, total_count: 26 }))} total={26} query={query({ page: 3 })} />,
    )
    expect(screen.getByText('showing:{"from":25,"to":26,"total":26}')).toBeInTheDocument()
    expect(screen.getByLabelText('next')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('link', { name: 'prev' })).toHaveAttribute('href', '/admin/members?page=2')
  })

  it('renders the empty state as a status', () => {
    render(<MembersList rows={[]} total={0} query={query({ q: 'zzz' })} />)
    expect(screen.getByRole('status')).toHaveTextContent('empty')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('MembersLoadError', () => {
  it('announces the error and offers a retry link to the same view', () => {
    render(<MembersLoadError query={query({ state: 'former' })} />)
    expect(screen.getByRole('alert')).toHaveTextContent('error')
    expect(screen.getByRole('link', { name: 'retry' })).toHaveAttribute('href', '/admin/members?state=former')
  })
})

describe('MembersFilters', () => {
  it('is a GET search form with the current values, and never sends a page', () => {
    const { container } = render(<MembersFilters query={query({ q: 'laia', state: 'former', role: 'board', sort: 'name_asc' })} />)
    const form = container.querySelector('form')!
    expect(form).toHaveAttribute('method', 'get')
    expect(screen.getByRole('searchbox')).toHaveValue('laia')
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '100')
    expect(screen.getByRole('radio', { name: 'state_former' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'role_label' })).toHaveValue('board')
    expect(form.querySelector('input[name="sort"]')).toHaveValue('name_asc')
    expect(form.querySelector('input[name="page"]')).toBeNull()
  })

  it('submits when the state or the role changes', () => {
    const { container } = render(<MembersFilters query={query()} />)
    const form = container.querySelector('form')!
    form.requestSubmit = vi.fn()
    fireEvent.click(screen.getByRole('radio', { name: 'state_all' }))
    expect(form.requestSubmit).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByRole('combobox', { name: 'role_label' }), { target: { value: 'superadmin' } })
    expect(form.requestSubmit).toHaveBeenCalledTimes(2)
  })

  it('the mobile sort select updates the hidden sort field before submitting', () => {
    const { container } = render(<MembersFilters query={query()} />)
    const form = container.querySelector('form')!
    form.requestSubmit = vi.fn()
    fireEvent.change(screen.getByRole('combobox', { name: 'sort_label' }), { target: { value: 'joined_desc' } })
    expect(form.querySelector('input[name="sort"]')).toHaveValue('joined_desc')
    expect(form.requestSubmit).toHaveBeenCalled()
  })
})

describe('MembersExports', () => {
  it('opens the CSV dialog and sends the role filter only when one is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()

    render(<MembersExports role="board" isSuperadmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /export_csv/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/export_role_note/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'export_confirm' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ role: 'board' })
    vi.unstubAllGlobals()
  })

  it('sends an empty filter for "all roles"', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('x', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()

    render(<MembersExports role="all" isSuperadmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: /export_csv/ }))
    expect(screen.queryByText(/export_role_note/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'export_confirm' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][1].body).toBe('{}')
    vi.unstubAllGlobals()
  })

  it('shows the e-mail export to everyone and the register only to superadmins', () => {
    const { rerender } = render(<MembersExports role="all" isSuperadmin={false} />)
    expect(screen.getByRole('button', { name: /export_emails/ })).toBeEnabled()
    expect(screen.queryByText('export_soon')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export_register/ })).not.toBeInTheDocument()
    expect(screen.queryByText('chip_superadmin_only')).not.toBeInTheDocument()

    rerender(<MembersExports role="all" isSuperadmin />)
    expect(screen.getByRole('button', { name: /export_register/ })).toBeEnabled()
    expect(screen.getByText('chip_superadmin_only')).toBeInTheDocument()
  })

  it('opens the e-mail dialog and, for superadmins, the register dialog', () => {
    render(<MembersExports role="all" isSuperadmin />)
    fireEvent.click(screen.getByRole('button', { name: /export_emails/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    fireEvent.click(screen.getByRole('button', { name: /export_register/ }))
    expect(screen.getAllByText('chip_superadmin_only').length).toBeGreaterThan(1)
  })
})
