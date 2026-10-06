import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
const refresh = vi.fn()
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh }),
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
const leaveMember = vi.fn()
const rejoinMember = vi.fn()
vi.mock('@/lib/admin/membership-actions', () => ({
  leaveMember: (...a: unknown[]) => leaveMember(...a),
  rejoinMember: (...a: unknown[]) => rejoinMember(...a),
}))

import MembershipActions from '@/components/admin/member-file/MembershipActions'

const active = {
  id: 'id-1',
  member_number: '000-203',
  state: 'active' as const,
  first_name: 'Laia',
  last_name: 'Serra',
  role: 'member',
  has_login: true,
  anonymised_at: null,
  current_joined_on: '2026-09-14',
  left_on: null,
  left_by: null,
  leave_reason: null,
}
const former = { ...active, state: 'former' as const, left_on: '2026-10-04', left_by: 'self' as const }

beforeEach(() => {
  leaveMember.mockReset()
  rejoinMember.mockReset()
  refresh.mockReset()
})

describe('Dona de baixa (A-6)', () => {
  it('is disabled with a visible reason while the member holds a board role', () => {
    render(<MembershipActions member={{ ...active, role: 'board' }} isSelf={false} />)
    expect(screen.getByRole('button', { name: 'leave_button' })).toBeDisabled()
    expect(screen.getByText('leave_blocked_role')).toBeInTheDocument()
  })

  it('is disabled with a reason on the signed-in member\'s own file', () => {
    render(<MembershipActions member={active} isSelf />)
    expect(screen.getByRole('button', { name: 'leave_button' })).toBeDisabled()
    expect(screen.getByText('leave_blocked_self')).toBeInTheDocument()
  })

  it('needs a reason of 5 characters, then sends it with the date', async () => {
    leaveMember.mockResolvedValue({ ok: true, emailSent: true })
    render(<MembershipActions member={active} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'leave_button' }))
    const confirm = screen.getByRole('button', { name: 'leave_confirm' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Compte duplicat ' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(leaveMember).toHaveBeenCalled())
    const [id, reason, date] = leaveMember.mock.calls[0]
    expect(id).toBe('id-1')
    expect(reason).toBe('Compte duplicat')
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByText('left_done')).toBeInTheDocument()
    expect(screen.queryByText('email_failed')).not.toBeInTheDocument()
  })

  it('tells the board to write by hand when the e-mail was not sent', async () => {
    leaveMember.mockResolvedValue({ ok: true, emailSent: false })
    render(<MembershipActions member={active} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'leave_button' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Motiu vàlid' } })
    fireEvent.click(screen.getByRole('button', { name: 'leave_confirm' }))
    expect(await screen.findByText('email_failed')).toBeInTheDocument()
    expect(screen.getByText('left_done')).toBeInTheDocument()
  })

  it.each([
    ['role_held', 'role_held'],
    ['self_target', 'self_target'],
    ['invalid_date', 'invalid_date'],
    ['reason_too_long', 'reason_too_long'],
    ['not_active', 'not_active'],
    ['whatever', 'failed'],
  ])('maps %s to a translated message and keeps the dialog open', async (code, text) => {
    leaveMember.mockResolvedValue({ error: code })
    render(<MembershipActions member={active} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'leave_button' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Motiu vàlid' } })
    fireEvent.click(screen.getByRole('button', { name: 'leave_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('blocks the confirm for a date in the future', () => {
    render(<MembershipActions member={active} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'leave_button' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Motiu vàlid' } })
    const date = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(date.max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    fireEvent.change(date, { target: { value: '2999-01-01' } })
    expect(screen.getByRole('button', { name: 'leave_confirm' })).toBeDisabled()
    expect(screen.getByText('date_invalid')).toBeInTheDocument()
  })
})

describe('Reincorpora (A-7)', () => {
  it.each([
    ['anonymised', { ...former, anonymised_at: '2026-10-05T00:00:00Z' }, 'rejoin_blocked_anonymised'],
    ['without login', { ...former, has_login: false }, 'rejoin_blocked_no_login'],
  ])('is disabled with a reason for a member %s', (_n, member, text) => {
    render(<MembershipActions member={member} isSelf={false} />)
    expect(screen.getByRole('button', { name: 'rejoin_button' })).toBeDisabled()
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('enables the confirm only with the whole checklist and a channel, then sends them', async () => {
    rejoinMember.mockResolvedValue({ ok: true, emailSent: true })
    render(<MembershipActions member={former} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'rejoin_button' }))
    const confirm = screen.getByRole('button', { name: 'rejoin_confirm' })
    expect(confirm).toBeDisabled()
    expect(screen.queryByText(/board_leave_warning/)).not.toBeInTheDocument()

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(4)
    boxes.slice(0, 3).forEach((box) => fireEvent.click(box))
    fireEvent.click(screen.getByRole('radio', { name: 'channel_email' }))
    expect(confirm).toBeDisabled()
    fireEvent.click(boxes[3])
    expect(confirm).toBeEnabled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Per correu  ' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(rejoinMember).toHaveBeenCalledWith('id-1', 'email', 'Per correu'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByText('rejoined_done')).toBeInTheDocument()
  })

  it('needs a channel even with the checklist complete', () => {
    render(<MembershipActions member={former} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'rejoin_button' }))
    screen.getAllByRole('checkbox').forEach((box) => fireEvent.click(box))
    expect(screen.getByRole('button', { name: 'rejoin_confirm' })).toBeDisabled()
  })

  it('warns when the last baixa was given by the board, with its reason', () => {
    render(
      <MembershipActions
        member={{ ...former, left_by: 'board', leave_reason: 'Compte duplicat' }}
        isSelf={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'rejoin_button' }))
    expect(screen.getByText(/board_leave_warning.*4\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Compte duplicat/)).toBeInTheDocument()
  })

  it('shows the manual-e-mail notice when emailSent is false', async () => {
    rejoinMember.mockResolvedValue({ ok: true, emailSent: false })
    render(<MembershipActions member={former} isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'rejoin_button' }))
    screen.getAllByRole('checkbox').forEach((box) => fireEvent.click(box))
    fireEvent.click(screen.getByRole('radio', { name: 'channel_form' }))
    fireEvent.click(screen.getByRole('button', { name: 'rejoin_confirm' }))
    expect(await screen.findByText('email_failed')).toBeInTheDocument()
  })

  it.each(['no_login', 'register_closed', 'not_former', 'invalid_channel', 'note_too_long'])(
    'maps %s',
    async (code) => {
      rejoinMember.mockResolvedValue({ error: code })
      render(<MembershipActions member={former} isSelf={false} />)
      fireEvent.click(screen.getByRole('button', { name: 'rejoin_button' }))
      screen.getAllByRole('checkbox').forEach((box) => fireEvent.click(box))
      fireEvent.click(screen.getByRole('radio', { name: 'channel_other' }))
      fireEvent.click(screen.getByRole('button', { name: 'rejoin_confirm' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(code)
      expect(refresh).not.toHaveBeenCalled()
    }
  )
})
