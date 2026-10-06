import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/lib/admin/member-actions', () => ({ updateMember: vi.fn(), revealSensitive: vi.fn() }))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import MemberFile from '@/components/admin/member-file/MemberFile'
import type { AdminActivityRow, AdminMemberFileRow } from '@/lib/admin/member-file'

const active: AdminMemberFileRow = {
  id: 'id-1',
  member_number: '000-203',
  state: 'active',
  first_name: 'Laia',
  last_name: 'Serra',
  email: 'laia@example.com',
  has_login: true,
  role: 'member',
  role_since: null,
  postal_code: '08224',
  ludoya_username: 'laiaserra',
  bgg_username: null,
  newsletter_accepted: true,
  has_dni: true,
  has_phone: true,
  membership_start_date: '2026-09-14',
  current_joined_on: '2026-09-14',
  left_on: null,
  left_by: null,
  leave_reason: null,
  purge_on: null,
  anonymised_at: null,
  card_valid: true,
  card_issued_at: '2026-09-14T09:00:00Z',
  created_at: '2026-09-14T09:00:00Z',
  badges: [
    {
      badge_key: 'volunteer_egara_joga',
      awarded_at: '2026-10-05T09:00:00Z',
      awarded_by: 'b1',
      awarded_by_name: 'Pau Ferrer',
    },
  ],
}

const former: AdminMemberFileRow = {
  ...active,
  member_number: '000-154',
  state: 'former',
  first_name: 'Albert',
  last_name: 'Roca',
  email: 'albert@example.com',
  postal_code: null,
  ludoya_username: null,
  bgg_username: null,
  newsletter_accepted: null,
  has_phone: null,
  membership_start_date: '2021-03-12',
  current_joined_on: '2024-09-15',
  left_on: '2026-10-04',
  left_by: 'self',
  leave_reason: null,
  purge_on: '2029-10-04',
  card_valid: false,
  badges: [],
}

const entry = (over: Partial<AdminActivityRow> = {}): AdminActivityRow => ({
  id: 1,
  created_at: '2026-10-05T09:15:00Z',
  actor_id: 'a1',
  actor_member_number: '000-014',
  actor_name: 'Pau Ferrer',
  action: 'badge.award',
  target_member_number: '000-203',
  target_name: 'Laia Serra',
  ...over,
})

const render_ = (member: AdminMemberFileRow, over: Partial<React.ComponentProps<typeof MemberFile>> = {}) =>
  render(<MemberFile member={member} activity={[]} backHref="/admin/members" canExportData canRevealFormerDni={false} {...over} />)

describe('MemberFile, active member', () => {
  it('shows header, contact data, masked DNI and phone, badges and card', () => {
    render_(active)
    expect(screen.getByRole('heading', { level: 2, name: 'Laia Serra' })).toBeInTheDocument()
    expect(screen.getByText(/member_line.*000-203/)).toBeInTheDocument()
    expect(screen.getByText('chip_active')).toBeInTheDocument()
    expect(screen.getByText('laia@example.com')).toBeInTheDocument()
    expect(screen.getByText('08224')).toBeInTheDocument()
    expect(screen.getByText('@laiaserra')).toBeInTheDocument()
    expect(screen.queryByText('blocked_title', { exact: false })).not.toBeInTheDocument()

    // DNI and phone: masked, never a value; each has its own reveal button.
    expect(screen.getAllByLabelText('masked_label')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /button_label/ })).toHaveLength(2)

    expect(screen.getByText(/badge_member_year.*2026/)).toBeInTheDocument()
    expect(screen.getByText('badge_volunteer_egara_joga')).toBeInTheDocument()
    expect(screen.getByText(/badge_awarded_by.*Pau Ferrer/)).toBeInTheDocument()
    expect(screen.getByText('chip_valid')).toBeInTheDocument()
    expect(screen.getByText('card_issued:{"date":"14/9/2026"}')).toBeInTheDocument()
  })

  it('shows "no value" instead of a mask when there is no DNI or phone', () => {
    render_({ ...active, has_dni: false, has_phone: false })
    expect(screen.queryByLabelText('masked_label')).not.toBeInTheDocument()
  })

  it('links back to the validated list URL and to the member activity log', () => {
    render_(active, { backHref: '/admin/members?state=former' })
    expect(screen.getByRole('link', { name: /back/ })).toHaveAttribute('href', '/admin/members?state=former')
    expect(screen.getByRole('link', { name: /activity_all/ })).toHaveAttribute(
      'href',
      '/admin/activity?target=000-203'
    )
  })

  it('renders the export button only when the viewer may export', () => {
    const { rerender } = render_(active)
    expect(screen.getByRole('button', { name: 'button' })).toBeInTheDocument()
    rerender(<MemberFile member={active} activity={[]} backHref="/admin/members" canExportData={false} canRevealFormerDni={false} />)
    expect(screen.queryByRole('button', { name: 'button' })).not.toBeInTheDocument()
  })

  it('renders activity as short sentences with a fallback for unknown actions', () => {
    render_(active, {
      activity: [
        entry(),
        entry({ id: 2, action: 'made.up', actor_name: null, actor_member_number: null }),
      ],
    })
    const list = screen.getAllByRole('list').at(-1)!
    expect(within(list).getByText('Pau Ferrer')).toBeInTheDocument()
    expect(within(list).getByText(/activity\.badge_award/)).toBeInTheDocument()
    expect(within(list).getByText('activity_system')).toBeInTheDocument()
    expect(within(list).getByText(/activity\.unknown.*made\.up/)).toBeInTheDocument()
  })

  it('shows the empty activity message', () => {
    render_(active)
    expect(screen.getByText('activity_empty')).toBeInTheDocument()
  })
})

describe('MemberFile, former member', () => {
  it('shows the purge date and the blocked notice, and no contact data (BR-20)', () => {
    render_(former)
    expect(screen.getByRole('alert')).toHaveTextContent('blocked_title:{"date":"4/10/2029"}')
    expect(screen.getByText('purge_on:{"date":"4/10/2029"}')).toBeInTheDocument()
    expect(screen.getByText('left_since:{"date":"4/10/2026"}')).toBeInTheDocument()

    // Register data only: name and e-mail, masked DNI, the leave details.
    expect(screen.getByText('register_title')).toBeInTheDocument()
    expect(screen.getByText('albert@example.com')).toBeInTheDocument()
    expect(screen.getAllByLabelText('masked_label')).toHaveLength(1)
    expect(screen.getByText('left_by_self')).toBeInTheDocument()
    for (const label of ['phone', 'postal_code', 'ludoya', 'bgg', 'newsletter']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(screen.getByText('former_footnote')).toBeInTheDocument()
    expect(screen.getByText('chip_invalid')).toBeInTheDocument()
    expect(screen.getByText('card_former')).toBeInTheDocument()
    expect(screen.getByText(/badge_member_year.*2021/)).toBeInTheDocument()
  })

  it('does not render an e-mail field for an anonymised former member', () => {
    render_({ ...former, email: null, has_login: false })
    expect(screen.queryByText('email')).not.toBeInTheDocument()
    expect(screen.getByText('login_no')).toBeInTheDocument()
  })

  it('board: no reveal button on a former member; superadmin: DNI only', () => {
    const { unmount } = render_(former)
    expect(screen.queryByRole('button', { name: /button_label/ })).not.toBeInTheDocument()
    expect(screen.getByText('reveal_former_note')).toBeInTheDocument()
    unmount()
    render_(former, { canRevealFormerDni: true })
    const buttons = screen.getAllByRole('button', { name: /button_label/ })
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveTextContent('button_former')
    expect(screen.queryByText('reveal_former_note')).not.toBeInTheDocument()
  })

  it('the active member has an edit button that opens the form and cancel closes it', () => {
    render_(active)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByRole('form', { name: 'form_label' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'open' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'open' })).toBeInTheDocument()
  })

  it('has no edit button on a former member', () => {
    render_(former, { canRevealFormerDni: true })
    expect(screen.queryByRole('button', { name: 'open' })).not.toBeInTheDocument()
  })
})
