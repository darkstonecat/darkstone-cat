import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
const actions = vi.hoisted(() => ({ searchMembersForBadge: vi.fn(), awardBadgeToMembers: vi.fn() }))
vi.mock('@/lib/admin/badge-actions', () => actions)

import BulkAwardDialog from '@/components/admin/badges/BulkAwardDialog'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const member = (n: number, first: string, alreadyHolds = false) => ({
  id: uuid(n),
  memberNumber: `000-${String(n).padStart(3, '0')}`,
  firstName: first,
  lastName: 'Puig',
  alreadyHolds,
})
const MEMBERS = [member(31, 'Marc'), member(112, 'Maria'), member(58, 'Marta', true)]

const onClose = vi.fn()
const onDone = vi.fn()

function renderDialog() {
  return render(
    <BulkAwardDialog open onClose={onClose} onDone={onDone} badgeKey="volunteer_egara_joga" badgeName="Voluntariat Egara Juga" />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  actions.searchMembersForBadge.mockResolvedValue({ ok: true, members: MEMBERS })
})

describe('BulkAwardDialog (S7.5)', () => {
  it('loads the first active members on open and disables the ones who already hold it', async () => {
    renderDialog()
    await waitFor(() => expect(actions.searchMembersForBadge).toHaveBeenCalledWith('volunteer_egara_joga', ''))
    const marta = await screen.findByRole('checkbox', { name: /Marta Puig/ })
    expect(marta).toBeDisabled()
    expect(screen.getByText(/award\.held/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Marc Puig/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'award.confirm:{"count":0}' })).toBeDisabled()
    expect(screen.getByText('award.disabled')).toBeInTheDocument()
  })

  it('searches again (debounced) when the query changes', async () => {
    renderDialog()
    await screen.findByRole('checkbox', { name: /Marc Puig/ })
    actions.searchMembersForBadge.mockResolvedValue({ ok: true, members: [member(145, 'Martí')] })
    fireEvent.change(screen.getByLabelText('award.search_label'), { target: { value: 'mart' } })
    await waitFor(() => expect(actions.searchMembersForBadge).toHaveBeenCalledWith('volunteer_egara_joga', 'mart'))
    expect(await screen.findByRole('checkbox', { name: /Martí Puig/ })).toBeInTheDocument()
  })

  it('awards the selected members with the note and reports awarded and skipped', async () => {
    actions.awardBadgeToMembers.mockResolvedValue({ ok: true, awarded: 2, skipped: 1 })
    renderDialog()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Marc Puig/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Maria Puig/ }))
    expect(screen.getByText('award.selected:{"count":2,"max":100}')).toBeInTheDocument()
    // Chips with a remove button for each selected member.
    expect(screen.getByRole('button', { name: 'award.remove_aria:{"name":"Marc Puig"}' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('award.note_label'), { target: { value: ' Fira 2026 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'award.confirm:{"count":2}' }))

    await waitFor(() =>
      expect(actions.awardBadgeToMembers).toHaveBeenCalledWith('volunteer_egara_joga', [uuid(31), uuid(112)], 'Fira 2026')
    )
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(2, 1))
    expect(router.refresh).toHaveBeenCalled()
  })

  it('removes a member through its chip', async () => {
    renderDialog()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Marc Puig/ }))
    fireEvent.click(screen.getByRole('button', { name: 'award.remove_aria:{"name":"Marc Puig"}' }))
    expect(screen.getByRole('checkbox', { name: /Marc Puig/ })).not.toBeChecked()
    expect(screen.getByText('award.selected:{"count":0,"max":100}')).toBeInTheDocument()
  })

  it('stops at 100 selected members', async () => {
    const many = Array.from({ length: 101 }, (_, i) => member(i + 1, `Soci${i + 1}`))
    actions.searchMembersForBadge.mockResolvedValue({ ok: true, members: many })
    renderDialog()
    await screen.findByText('000-101')
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    for (const box of boxes.slice(0, 100)) fireEvent.click(box)
    expect(screen.getByText('award.selected:{"count":100,"max":100}')).toBeInTheDocument()
    expect(boxes[100]).toBeDisabled()
    expect(boxes[100]).not.toBeChecked()
    expect(boxes[0]).toBeEnabled()
  }, 15000)

  it('keeps the dialog open with the mapped error when the award fails', async () => {
    actions.awardBadgeToMembers.mockResolvedValue({ error: 'not_active' })
    renderDialog()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Marc Puig/ }))
    fireEvent.click(screen.getByRole('button', { name: 'award.confirm:{"count":1}' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.not_active')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('says when the search fails', async () => {
    actions.searchMembersForBadge.mockResolvedValue({ error: 'failed' })
    renderDialog()
    expect(await screen.findByText('award.search_error')).toBeInTheDocument()
  })
})
