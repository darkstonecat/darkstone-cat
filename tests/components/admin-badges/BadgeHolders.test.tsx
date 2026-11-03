import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'ca',
}))
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('@/i18n/routing', () => ({
  useRouter: () => router,
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
const revokeBadge = vi.fn()
vi.mock('@/lib/admin/member-actions', () => ({ revokeBadge: (...a: unknown[]) => revokeBadge(...a) }))
vi.mock('@/lib/admin/badge-actions', () => ({
  searchMembersForBadge: vi.fn().mockResolvedValue({ ok: true, members: [] }),
  awardBadgeToMembers: vi.fn(),
}))

import BadgeHolders from '@/components/admin/badges/BadgeHolders'
import type { BadgeHolder } from '@/lib/admin/badges'
import { badgeRow } from './fixtures'

const holder = (n: number, state: 'active' | 'former' = 'active'): BadgeHolder => ({
  memberId: `id-${n}`,
  memberNumber: `000-${String(n).padStart(3, '0')}`,
  firstName: `Soci${n}`,
  lastName: 'Serra',
  state,
  awardedAt: '2026-10-05T09:00:00Z',
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BadgeHolders (S7.3)', () => {
  it('lists active holders with a link to their file, 10 at a time, and former members apart without a button', () => {
    const holders = [...Array.from({ length: 12 }, (_, i) => holder(i + 1)), holder(99, 'former')]
    render(<BadgeHolders badge={badgeRow()} holders={holders} loadError={false} />)
    expect(screen.getByText('holder_list.summary:{"count":12}')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Soci1 Serra' })).toHaveAttribute('href', '/admin/members/000-001')
    expect(screen.getAllByRole('button', { name: /^holder_list\.revoke_aria/ })).toHaveLength(10)
    expect(screen.getAllByText('holder_list.awarded_on:{"date":"5/10/2026"}').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'holder_list.show_more:{"count":2}' }))
    expect(screen.getAllByRole('button', { name: /^holder_list\.revoke_aria/ })).toHaveLength(12)

    const former = screen.getByRole('list', { name: 'holder_list.former_title' })
    expect(within(former).getByText('Soci99 Serra')).toBeInTheDocument()
    expect(within(former).queryByRole('button')).not.toBeInTheDocument()
  })

  it('revokes through the dialog with an optional reason', async () => {
    revokeBadge.mockResolvedValue({ ok: true })
    render(<BadgeHolders badge={badgeRow()} holders={[holder(1)]} loadError={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'holder_list.revoke_aria:{"name":"Soci1 Serra"}' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ' Error ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'holder_list.revoke_confirm' }))
    await waitFor(() => expect(revokeBadge).toHaveBeenCalledWith('id-1', 'volunteer_egara_joga', 'Error'))
    expect(await screen.findByText('holder_list.revoke_done')).toBeInTheDocument()
    expect(router.refresh).toHaveBeenCalled()
  })

  it('has no award or revoke buttons for an archived badge', () => {
    render(
      <BadgeHolders badge={badgeRow({ archived_at: '2026-11-02T10:00:00Z' })} holders={[holder(1)]} loadError={false} />
    )
    expect(screen.queryByRole('button', { name: 'holder_list.award_button' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke_aria/ })).not.toBeInTheDocument()
  })

  it('opens the bulk award dialog', () => {
    render(<BadgeHolders badge={badgeRow()} holders={[]} loadError={false} />)
    expect(screen.getByText('holder_list.none')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'holder_list.award_button' }))
    expect(screen.getByRole('dialog', { name: 'award.title' })).toBeInTheDocument()
  })
})
