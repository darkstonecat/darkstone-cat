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
const setMemberRole = vi.fn()
const anonymiseMember = vi.fn()
vi.mock('@/lib/admin/superadmin-actions', () => ({
  setMemberRole: (...a: unknown[]) => setMemberRole(...a),
  anonymiseMember: (...a: unknown[]) => anonymiseMember(...a),
}))

import RoleCard from '@/components/admin/member-file/RoleCard'

const active = {
  id: 'id-1',
  member_number: '000-203',
  state: 'active' as const,
  first_name: 'Laia',
  last_name: 'Serra',
  role: 'board',
  role_since: '2026-09-14T09:00:00Z',
  has_login: true,
  anonymised_at: null,
  purge_on: null,
}
const former = {
  ...active,
  state: 'former' as const,
  role: 'member',
  role_since: null,
  member_number: '000-154',
  purge_on: '2029-10-04',
}

beforeEach(() => {
  setMemberRole.mockReset()
  anonymiseMember.mockReset()
  refresh.mockReset()
})

describe('RoleCard for the board', () => {
  it('shows the role read-only: no change or anonymise buttons', () => {
    render(<RoleCard member={former} canManage={false} isSelf={false} />)
    expect(screen.getByText('role_card', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('read_only')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the role and its date for a board holder', () => {
    render(<RoleCard member={active} canManage={false} isSelf={false} />)
    expect(screen.getByText(/role_since.*14\/9\/2026/)).toBeInTheDocument()
  })
})

describe('RoleCard change role (S-1, S-2)', () => {
  it('is disabled with a reason on the own file and for a former member', () => {
    const { unmount } = render(<RoleCard member={active} canManage isSelf />)
    expect(screen.getByRole('button', { name: 'change_button' })).toBeDisabled()
    expect(screen.getByText('blocked_self')).toBeInTheDocument()
    unmount()
    render(<RoleCard member={former} canManage isSelf={false} />)
    expect(screen.getByRole('button', { name: 'change_button' })).toBeDisabled()
    expect(screen.getByText('blocked_former')).toBeInTheDocument()
  })

  it('offers member, board and superadmin only, and refuses the current role', () => {
    render(<RoleCard member={active} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'change_button' }))
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['member', 'board', 'superadmin'])
    const confirm = screen.getByRole('button', { name: 'change_confirm' })
    expect(confirm).toBeDisabled()
    fireEvent.click(screen.getAllByRole('radio')[1]) // the current role
    expect(confirm).toBeDisabled()
    expect(screen.getByText('disabled_same')).toBeInTheDocument()
  })

  it('grants a role with an optional reason and shows the notice', async () => {
    setMemberRole.mockResolvedValue({ ok: true, action: 'role.grant', role: 'superadmin', roleSince: null })
    render(<RoleCard member={active} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'change_button' }))
    fireEvent.click(screen.getAllByRole('radio')[2])
    expect(screen.getByText('grant_warning')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Nova secretària ' } })
    fireEvent.click(screen.getByRole('button', { name: 'change_confirm' }))
    await waitFor(() => expect(setMemberRole).toHaveBeenCalledWith('id-1', 'superadmin', 'Nova secretària'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByRole('status')).toHaveTextContent('done_grant')
  })

  it('shows the revoke notice for a removal', async () => {
    setMemberRole.mockResolvedValue({ ok: true, action: 'role.revoke', role: 'member', roleSince: null })
    render(<RoleCard member={active} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'change_button' }))
    fireEvent.click(screen.getAllByRole('radio')[0])
    fireEvent.click(screen.getByRole('button', { name: 'change_confirm' }))
    await waitFor(() => expect(setMemberRole).toHaveBeenCalledWith('id-1', 'member', null))
    expect(await screen.findByRole('status')).toHaveTextContent('done_revoke')
  })

  it.each([
    'self_role_change',
    'last_superadmin',
    'former_member_role',
    'role_unchanged',
    'role_held',
    'forbidden',
  ])('maps %s to its own translated message', async (code) => {
    setMemberRole.mockResolvedValue({ error: code })
    render(<RoleCard member={active} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'change_button' }))
    fireEvent.click(screen.getAllByRole('radio')[2])
    fireEvent.click(screen.getByRole('button', { name: 'change_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(code)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('maps an unknown code to failed', async () => {
    setMemberRole.mockResolvedValue({ error: 'weird' })
    render(<RoleCard member={active} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'change_button' }))
    fireEvent.click(screen.getAllByRole('radio')[2])
    fireEvent.click(screen.getByRole('button', { name: 'change_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('failed')
  })
})

describe('RoleCard anonymise (S-3)', () => {
  it('is not offered for an active member', () => {
    render(<RoleCard member={active} canManage isSelf={false} />)
    expect(screen.queryByRole('button', { name: 'anonymise_button' })).not.toBeInTheDocument()
  })

  it('needs the exact member number before it enables', async () => {
    anonymiseMember.mockResolvedValue({ ok: true, accountDeleted: true, alreadyAnonymised: false, purgeOn: '2029-10-04' })
    render(<RoleCard member={former} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'anonymise_button' }))
    const confirm = screen.getByRole('button', { name: 'anonymise_confirm' })
    expect(confirm).toBeDisabled()
    const [typed] = screen.getAllByRole('textbox')
    fireEvent.change(typed, { target: { value: '000-15' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(typed, { target: { value: ' 000-154 ' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(anonymiseMember).toHaveBeenCalledWith('id-1', '000-154', null))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByRole('status')).toHaveTextContent('anonymise_done:{"date":"4/10/2029"}')
    expect(screen.queryByText('anonymise_retry')).not.toBeInTheDocument()
  })

  it('warns when the login account is not deleted and retries the same call', async () => {
    anonymiseMember
      .mockResolvedValueOnce({ ok: true, accountDeleted: false, alreadyAnonymised: false, purgeOn: '2029-10-04' })
      .mockResolvedValueOnce({ ok: true, accountDeleted: true, alreadyAnonymised: true, purgeOn: null })
    render(<RoleCard member={former} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'anonymise_button' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '000-154' } })
    fireEvent.click(screen.getByRole('button', { name: 'anonymise_confirm' }))

    expect(await screen.findByText('anonymise_account_pending')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'anonymise_retry' }))
    await waitFor(() => expect(anonymiseMember).toHaveBeenCalledTimes(2))
    expect(anonymiseMember).toHaveBeenLastCalledWith('id-1', '000-154', null)
    await waitFor(() => expect(screen.queryByText('anonymise_account_pending')).not.toBeInTheDocument())
    // The purge date of the first answer survives the retry (the retry answers null).
    expect(screen.getByRole('status')).toHaveTextContent('anonymise_done:{"date":"4/10/2029"}')
  })

  it('maps confirm_mismatch and not_former and keeps the dialog open', async () => {
    anonymiseMember.mockResolvedValue({ error: 'confirm_mismatch' })
    render(<RoleCard member={former} canManage isSelf={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'anonymise_button' }))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '000-154' } })
    fireEvent.click(screen.getByRole('button', { name: 'anonymise_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('confirm_mismatch')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('is disabled with a reason once anonymised and without a login account', () => {
    render(<RoleCard member={{ ...former, anonymised_at: '2026-10-05T10:00:00Z', has_login: false }} canManage isSelf={false} />)
    expect(screen.getByRole('button', { name: 'anonymise_button' })).toBeDisabled()
    expect(screen.getByText('anonymise_blocked_done')).toBeInTheDocument()
  })
})
