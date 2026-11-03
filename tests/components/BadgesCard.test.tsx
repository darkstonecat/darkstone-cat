import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'ca',
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
import type { CatalogueBadge } from '@/lib/badges/catalogue'

const TODAY = '2026-11-03'

// The non-archived catalogue the page passes in (the award dialog lists it).
const CATALOGUE: CatalogueBadge[] = [
  {
    key: 'volunteer_egara_joga',
    name: { ca: 'Voluntariat Egara Juga' },
    earnedText: { ca: 'Ha col·laborat a la fira.' },
    lockedText: { ca: 'Col·labora a la fira.' },
    icon: 'how_to_reg',
    sortOrder: 10,
    showLocked: true,
  },
  {
    key: 'ludoteca_donor',
    name: { ca: 'Donant de la ludoteca' },
    earnedText: { ca: 'Ha donat un joc.' },
    lockedText: { ca: 'Dona un joc.' },
    icon: 'gift',
    sortOrder: 20,
    showLocked: true,
  },
]

const held = {
  badge_key: 'volunteer_egara_joga',
  awarded_at: '2026-10-05T09:00:00Z',
  awarded_by: 'b1',
  awarded_by_name: 'Pau Ferrer',
  name: { ca: 'Voluntariat Egara Juga' },
  icon: 'how_to_reg',
  archived: false,
}
const active = {
  id: 'id-1',
  member_number: '000-203',
  state: 'active' as const,
  first_name: 'Laia',
  last_name: 'Serra',
  current_joined_on: '2024-09-14',
  left_on: null,
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
    render(<BadgesCard member={active} today={TODAY} catalogue={CATALOGUE} />)
    fireEvent.click(screen.getByRole('button', { name: 'award_button' }))

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]).toBeDisabled() // volunteer_egara_joga is held
    expect(screen.getByText(/held_since/)).toBeInTheDocument()
    expect(radios[1]).toBeEnabled()
    // Names and captions come from the catalogue.
    expect(screen.getAllByText('Donant de la ludoteca').length).toBeGreaterThan(0)
    expect(screen.getByText('Ha donat un joc.')).toBeInTheDocument()
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
    render(<BadgesCard member={active} today={TODAY} catalogue={CATALOGUE} />)
    fireEvent.click(screen.getByRole('button', { name: 'award_button' }))
    fireEvent.click(screen.getAllByRole('radio')[1])
    fireEvent.click(screen.getByRole('button', { name: 'award_confirm' }))
    await waitFor(() => expect(awardBadge).toHaveBeenCalledWith('id-1', 'ludoteca_donor', null))
  })

  it('disables the award button with a reason when every badge is held', () => {
    const all = [held, { ...held, badge_key: 'ludoteca_donor', name: { ca: 'Donant de la ludoteca' } }]
    render(<BadgesCard member={{ ...active, badges: all }} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.getByRole('button', { name: 'award_button' })).toBeDisabled()
    expect(screen.getByText('blocked_all')).toBeInTheDocument()
  })

  it.each([
    ['badge_held', 'badge_held'],
    ['invalid_badge', 'invalid_badge'],
    ['badge_archived', 'badge_archived'],
    ['not_active', 'not_active'],
    ['weird', 'failed'],
  ])('maps %s to a translated message and keeps the dialog open', async (code, text) => {
    awardBadge.mockResolvedValue({ error: code })
    render(<BadgesCard member={active} today={TODAY} catalogue={CATALOGUE} />)
    fireEvent.click(screen.getByRole('button', { name: 'award_button' }))
    fireEvent.click(screen.getAllByRole('radio')[1])
    fireEvent.click(screen.getByRole('button', { name: 'award_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('BadgesCard revoke (A-8)', () => {
  it('revokes a held badge with an optional reason; the tenure badge has no revoke button', async () => {
    revokeBadge.mockResolvedValue({ ok: true })
    render(<BadgesCard member={active} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.getAllByRole('button', { name: /revoke_aria/ })).toHaveLength(1)
    expect(screen.getByText('badge_member_tenure:{"years":2}')).toBeInTheDocument()
    expect(screen.getByText('badge_automatic')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /revoke_aria/ }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Error ' } })
    fireEvent.click(screen.getByRole('button', { name: 'revoke_confirm' }))
    await waitFor(() => expect(revokeBadge).toHaveBeenCalledWith('id-1', 'volunteer_egara_joga', 'Error'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByText('revoke_done')).toBeInTheDocument()
  })

  it('revokes without a reason as null', async () => {
    revokeBadge.mockResolvedValue({ ok: true })
    render(<BadgesCard member={active} today={TODAY} catalogue={CATALOGUE} />)
    fireEvent.click(screen.getByRole('button', { name: /revoke_aria/ }))
    fireEvent.click(screen.getByRole('button', { name: 'revoke_confirm' }))
    await waitFor(() => expect(revokeBadge).toHaveBeenCalledWith('id-1', 'volunteer_egara_joga', null))
  })
})

describe('BadgesCard, former member', () => {
  it('has the award button disabled with a reason and no revoke buttons', () => {
    render(<BadgesCard member={{ ...active, state: 'former', left_on: '2026-10-04' }} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.getByRole('button', { name: 'award_button' })).toBeDisabled()
    expect(screen.getByText('blocked_former')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke_aria/ })).not.toBeInTheDocument()
    expect(screen.getByText('badges_kept')).toBeInTheDocument()
  })
})

describe('BadgesCard, tenure badge', () => {
  it('is not listed during the first year after the current sign-up', () => {
    render(<BadgesCard member={{ ...active, current_joined_on: '2026-09-14', badges: [] }} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.queryByText(/badge_member_tenure/)).not.toBeInTheDocument()
    expect(screen.getByText('badges_none')).toBeInTheDocument()
  })

  it('counts a former member\'s years up to the leave date, not up to today', () => {
    render(
      <BadgesCard
        member={{ ...active, state: 'former', current_joined_on: '2023-10-10', left_on: '2026-10-04' }}
        today={TODAY}
        catalogue={CATALOGUE}
      />
    )
    expect(screen.getByText('badge_member_tenure:{"years":2}')).toBeInTheDocument()
  })
})

describe('BadgesCard, catalogue names and archived badges', () => {
  it('names a held badge from the catalogue snapshot of the member file', () => {
    render(<BadgesCard member={active} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.getByText('Voluntariat Egara Juga')).toBeInTheDocument()
  })

  it('shows an archived badge greyed with its chip and no revoke button', () => {
    const archived = { ...held, badge_key: 'old_fair', name: { ca: 'Fira antiga' }, archived: true }
    render(<BadgesCard member={{ ...active, badges: [archived] }} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.getByText('Fira antiga')).toBeInTheDocument()
    expect(screen.getByText('badge_archived')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke_aria/ })).not.toBeInTheDocument()
  })

  it('falls back to the key when the file has no name for a badge', () => {
    const nameless = { ...held, badge_key: 'mystery', name: null }
    render(<BadgesCard member={{ ...active, badges: [nameless] }} today={TODAY} catalogue={CATALOGUE} />)
    expect(screen.getByText('mystery')).toBeInTheDocument()
  })
})
