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
const awardBadge = vi.fn()
const revokeBadge = vi.fn()
vi.mock('@/lib/admin/member-actions', () => ({
  awardBadge: (...a: unknown[]) => awardBadge(...a),
  revokeBadge: (...a: unknown[]) => revokeBadge(...a),
}))

import BadgesCard from '@/components/admin/member-file/BadgesCard'

const held = {
  badge_key: 'volunteer_egara_joga',
  awarded_at: '2026-10-05T09:00:00Z',
  awarded_by: 'b1',
  awarded_by_name: 'Pau Ferrer',
}
const active = {
  id: 'id-1',
  member_number: '000-203',
  state: 'active' as const,
  first_name: 'Laia',
  last_name: 'Serra',
  membership_start_date: '2026-09-14',
  badges: [held],
}

beforeEach(() => {
  awardBadge.mockReset()
  revokeBadge.mockReset()
  refresh.mockReset()
})

describe('BadgesCard award (A-8)', () => {
  it('disables the badges the member already holds and awards a free one with the note', async () => {
    awardBadge.mockResolvedValue({ ok: true, awardedAt: null })
    render(<BadgesCard member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'award_button' }))

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]).toBeDisabled() // volunteer_egara_joga is held
    expect(screen.getByText(/held_since/)).toBeInTheDocument()
    expect(radios[1]).toBeEnabled()
    const confirm = screen.getByRole('button', { name: 'award_confirm' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText('award_disabled')).toBeInTheDocument()

    fireEvent.click(radios[1])
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Ha donat 3 jocs ' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(awardBadge).toHaveBeenCalledWith('id-1', 'ludoteca_donor', 'Ha donat 3 jocs'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByText('award_done')).toBeInTheDocument()
  })

  it('sends a null note when it is blank', async () => {
    awardBadge.mockResolvedValue({ ok: true, awardedAt: null })
    render(<BadgesCard member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'award_button' }))
    fireEvent.click(screen.getAllByRole('radio')[1])
    fireEvent.click(screen.getByRole('button', { name: 'award_confirm' }))
    await waitFor(() => expect(awardBadge).toHaveBeenCalledWith('id-1', 'ludoteca_donor', null))
  })

  it('disables the award button with a reason when every badge is held', () => {
    const all = [held, { ...held, badge_key: 'ludoteca_donor' }]
    render(<BadgesCard member={{ ...active, badges: all }} />)
    expect(screen.getByRole('button', { name: 'award_button' })).toBeDisabled()
    expect(screen.getByText('blocked_all')).toBeInTheDocument()
  })

  it.each([
    ['badge_held', 'badge_held'],
    ['invalid_badge', 'invalid_badge'],
    ['not_active', 'not_active'],
    ['weird', 'failed'],
  ])('maps %s to a translated message and keeps the dialog open', async (code, text) => {
    awardBadge.mockResolvedValue({ error: code })
    render(<BadgesCard member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'award_button' }))
    fireEvent.click(screen.getAllByRole('radio')[1])
    fireEvent.click(screen.getByRole('button', { name: 'award_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('BadgesCard revoke (A-8)', () => {
  it('revokes a held badge with an optional reason; "Membre" has no revoke button', async () => {
    revokeBadge.mockResolvedValue({ ok: true })
    render(<BadgesCard member={active} />)
    expect(screen.getAllByRole('button', { name: /revoke_aria/ })).toHaveLength(1)
    expect(screen.getByText(/badge_member_year.*2026/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /revoke_aria/ }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Error ' } })
    fireEvent.click(screen.getByRole('button', { name: 'revoke_confirm' }))
    await waitFor(() => expect(revokeBadge).toHaveBeenCalledWith('id-1', 'volunteer_egara_joga', 'Error'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByText('revoke_done')).toBeInTheDocument()
  })

  it('revokes without a reason as null', async () => {
    revokeBadge.mockResolvedValue({ ok: true })
    render(<BadgesCard member={active} />)
    fireEvent.click(screen.getByRole('button', { name: /revoke_aria/ }))
    fireEvent.click(screen.getByRole('button', { name: 'revoke_confirm' }))
    await waitFor(() => expect(revokeBadge).toHaveBeenCalledWith('id-1', 'volunteer_egara_joga', null))
  })
})

describe('BadgesCard, former member', () => {
  it('has the award button disabled with a reason and no revoke buttons', () => {
    render(<BadgesCard member={{ ...active, state: 'former' }} />)
    expect(screen.getByRole('button', { name: 'award_button' })).toBeDisabled()
    expect(screen.getByText('blocked_former')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke_aria/ })).not.toBeInTheDocument()
    expect(screen.getByText('badges_kept')).toBeInTheDocument()
  })
})
