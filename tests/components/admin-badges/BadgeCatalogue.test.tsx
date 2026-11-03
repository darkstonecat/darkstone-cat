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
const actions = vi.hoisted(() => ({
  archiveBadge: vi.fn(),
  restoreBadge: vi.fn(),
  deleteBadge: vi.fn(),
  createBadge: vi.fn(),
}))
vi.mock('@/lib/admin/badge-actions', () => actions)

import BadgeCatalogue from '@/components/admin/badges/BadgeCatalogue'
import { badgeRow } from './fixtures'

const ACTIVE = [
  badgeRow({ key: 'ludoteca_donor', name: { ca: 'Donant de la ludoteca' }, sort_order: 20, icon: 'gift' }),
  badgeRow(),
  badgeRow({
    key: 'master_de_rol',
    name: { ca: 'Màster de rol' },
    earned_text: { ca: 'Ha dirigit una campanya.' },
    locked_text: { ca: 'Dirigeix una campanya.' },
    sort_order: 30,
    show_locked: false,
    active_holders: 3,
  }),
]
const ARCHIVED = [
  badgeRow({
    key: 'old_cup',
    name: { ca: 'Campió torneig 2025' },
    archived_at: '2026-11-02T10:00:00Z',
    holders: 4,
    active_holders: 4,
    ever_awarded: true,
  }),
  badgeRow({
    key: 'typo_badge',
    name: { ca: 'Insígnia errònia' },
    archived_at: '2026-11-02T10:00:00Z',
    holders: 0,
    active_holders: 0,
    ever_awarded: false,
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
})

const activeCard = () => screen.getByRole('region', { name: 'active_title' })
const archivedCard = () => screen.getByRole('region', { name: 'archived_title' })

describe('BadgeCatalogue, active badges (S7.2)', () => {
  it('lists the automatic tenure badge first, without actions or a count, then the badges in sort order', () => {
    render(<BadgeCatalogue badges={[...ACTIVE, ...ARCHIVED]} isSuperadmin={false} />)
    const items = within(activeCard()).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('tenure_name')
    expect(items[0]).toHaveTextContent('automatic')
    expect(within(items[0]).queryByRole('button')).not.toBeInTheDocument()
    expect(within(items[0]).queryByRole('link')).not.toBeInTheDocument()
    expect(items[0]).not.toHaveTextContent('holders_count')

    expect(items[1]).toHaveTextContent('Voluntariat Egara Juga')
    expect(items[2]).toHaveTextContent('Donant de la ludoteca')
    expect(items[3]).toHaveTextContent('Màster de rol')
    expect(within(items[1]).getByRole('link', { name: 'Voluntariat Egara Juga' })).toHaveAttribute(
      'href',
      '/admin/badges/volunteer_egara_joga'
    )
    expect(items[1]).toHaveTextContent('holders_count:{"count":12}')
    expect(items[1]).toHaveTextContent('show_locked_on')
    expect(items[1]).toHaveTextContent('ca · es · en')
    expect(items[3]).toHaveTextContent('hidden_chip')
    expect(items[3]).toHaveTextContent('only_ca')
    expect(screen.getByText('active_summary:{"count":3}')).toBeInTheDocument()
  })

  it('archives a badge from a dialog that says how many active members stop seeing it', async () => {
    actions.archiveBadge.mockResolvedValue({ ok: true })
    render(<BadgeCatalogue badges={ACTIVE} isSuperadmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'archive_aria:{"name":"Voluntariat Egara Juga"}' }))

    const dialog = screen.getByRole('dialog', { name: 'archive_title' })
    expect(within(dialog).getByText('12')).toBeInTheDocument()
    expect(within(dialog).getByText('archive_count_text:{"count":12}')).toBeInTheDocument()
    expect(within(dialog).getByText('archive_warning')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'archive_confirm' }))

    await waitFor(() => expect(actions.archiveBadge).toHaveBeenCalledWith('volunteer_egara_joga'))
    await waitFor(() => expect(router.refresh).toHaveBeenCalled())
    expect(await screen.findByText('archive_done')).toBeInTheDocument()
  })

  it('keeps the archive dialog open with the mapped error when it fails', async () => {
    actions.archiveBadge.mockResolvedValue({ error: 'forbidden' })
    render(<BadgeCatalogue badges={ACTIVE} isSuperadmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'archive_aria:{"name":"Voluntariat Egara Juga"}' }))
    fireEvent.click(screen.getByRole('button', { name: 'archive_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.forbidden')
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('opens the "Nova insígnia" dialog', () => {
    render(<BadgeCatalogue badges={ACTIVE} isSuperadmin={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'new_button' }))
    expect(screen.getByRole('dialog', { name: 'create.title' })).toBeInTheDocument()
  })
})

describe('BadgeCatalogue, archived badges (S7.2, S7.6)', () => {
  it('shows no archived card when nothing is archived', () => {
    render(<BadgeCatalogue badges={ACTIVE} isSuperadmin />)
    expect(screen.queryByRole('region', { name: 'archived_title' })).not.toBeInTheDocument()
  })

  it('lists archived badges greyed with the former holders and the date, and restores one', async () => {
    actions.restoreBadge.mockResolvedValue({ ok: true })
    render(<BadgeCatalogue badges={[...ACTIVE, ...ARCHIVED]} isSuperadmin={false} />)
    const card = archivedCard()
    expect(within(card).getAllByRole('listitem')).toHaveLength(2)
    expect(card).toHaveTextContent('Campió torneig 2025')
    expect(card).toHaveTextContent('held_before:{"count":4}')
    expect(card).toHaveTextContent('archived_on:{"date":"2/11/2026"}')
    // Archived badges are not in the active list.
    expect(activeCard()).not.toHaveTextContent('Campió torneig 2025')

    fireEvent.click(within(card).getByRole('button', { name: 'restore_aria:{"name":"Campió torneig 2025"}' }))
    const dialog = screen.getByRole('dialog', { name: 'restore_title' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'restore_confirm' }))
    await waitFor(() => expect(actions.restoreBadge).toHaveBeenCalledWith('old_cup'))
    expect(await screen.findByText('restore_done')).toBeInTheDocument()
  })

  it('disables delete with the reason for a board member', () => {
    render(<BadgeCatalogue badges={[...ACTIVE, ...ARCHIVED]} isSuperadmin={false} />)
    const buttons = within(archivedCard()).getAllByRole('button', { name: /^delete_aria/ })
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button).toBeDisabled()
    expect(within(archivedCard()).getAllByText('delete_blocked_role')).toHaveLength(2)
  })

  it('lets a superadmin delete only a badge never awarded', async () => {
    actions.deleteBadge.mockResolvedValue({ ok: true })
    render(<BadgeCatalogue badges={[...ACTIVE, ...ARCHIVED]} isSuperadmin />)
    const card = archivedCard()
    expect(within(card).getByRole('button', { name: 'delete_aria:{"name":"Campió torneig 2025"}' })).toBeDisabled()
    expect(within(card).getByText('delete_blocked_awarded')).toBeInTheDocument()

    const free = within(card).getByRole('button', { name: 'delete_aria:{"name":"Insígnia errònia"}' })
    expect(free).toBeEnabled()
    fireEvent.click(free)
    const dialog = screen.getByRole('dialog', { name: 'delete_title' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'delete_confirm' }))
    await waitFor(() => expect(actions.deleteBadge).toHaveBeenCalledWith('typo_badge'))
    expect(await screen.findByText('delete_done')).toBeInTheDocument()
  })

  it('maps badge_in_use on delete', async () => {
    actions.deleteBadge.mockResolvedValue({ error: 'badge_in_use' })
    render(<BadgeCatalogue badges={[...ACTIVE, ...ARCHIVED]} isSuperadmin />)
    fireEvent.click(screen.getByRole('button', { name: 'delete_aria:{"name":"Insígnia errònia"}' }))
    fireEvent.click(screen.getByRole('button', { name: 'delete_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.badge_in_use')
  })
})

describe('BadgeCatalogue, load error', () => {
  it('says the list could not be loaded', () => {
    render(<BadgeCatalogue badges={[]} isSuperadmin={false} loadError />)
    expect(screen.getByText('load_error')).toBeInTheDocument()
  })
})
