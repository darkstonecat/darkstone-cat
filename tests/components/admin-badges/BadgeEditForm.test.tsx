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
const updateBadge = vi.fn()
vi.mock('@/lib/admin/badge-actions', () => ({ updateBadge: (...a: unknown[]) => updateBadge(...a) }))

import BadgeEditForm from '@/components/admin/badges/BadgeEditForm'
import { badgeRow } from './fixtures'

const onSaved = vi.fn()
const CA_ONLY = badgeRow({
  name: { ca: 'Màster de rol' },
  earned_text: { ca: 'Ha dirigit una campanya.' },
  locked_text: { ca: 'Dirigeix una campanya.' },
  icon: 'book',
  sort_order: 30,
})

beforeEach(() => {
  vi.clearAllMocks()
})

const nameField = () => screen.getByLabelText(/^edit\.name_label/) as HTMLInputElement
const save = () => screen.getByRole('button', { name: 'edit.save' })
const preview = () => screen.getByRole('region', { name: 'preview.title' })

describe('BadgeEditForm (S7.3)', () => {
  it('shows the key read-only and the current values', () => {
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    expect(screen.getByText('edit.key_chip:{"key":"volunteer_egara_joga"}')).toBeInTheDocument()
    expect(screen.queryByLabelText(/key/i)).not.toBeInTheDocument()
    expect(nameField().value).toBe('Màster de rol')
    expect(screen.getByRole('button', { name: 'edit.icons.book' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'edit.icons.star' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('switch', { name: 'edit.switch_label' })).toHaveAttribute('aria-checked', 'true')
    expect((screen.getByLabelText('edit.order_label') as HTMLInputElement).value).toBe('30')
    expect(screen.getAllByRole('button', { name: /^edit\.icons\./ })).toHaveLength(16)
  })

  it('marks Castellano and English with the missing-text dot, not Català', () => {
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    expect(screen.getByRole('tab', { name: /edit\.lang_es/ })).toHaveAccessibleName(/edit\.lang_missing/)
    expect(screen.getByRole('tab', { name: /edit\.lang_en/ })).toHaveAccessibleName(/edit\.lang_missing/)
    expect(screen.getByRole('tab', { name: /edit\.lang_ca/ })).not.toHaveAccessibleName(/edit\.lang_missing/)
  })

  it('has no dot when the three texts exist in a language', () => {
    render(<BadgeEditForm badge={badgeRow()} onSaved={onSaved} />)
    expect(screen.getByRole('tab', { name: /edit\.lang_es/ })).not.toHaveAccessibleName(/edit\.lang_missing/)
  })

  it('makes the preview follow the language tab (falling back to Catalan)', () => {
    render(<BadgeEditForm badge={badgeRow()} onSaved={onSaved} />)
    expect(preview()).toHaveTextContent('Ha col·laborat a la fira.')
    fireEvent.click(screen.getByRole('tab', { name: /edit\.lang_en/ }))
    expect(screen.getByRole('tab', { name: /edit\.lang_en/ })).toHaveAttribute('aria-selected', 'true')
    expect(nameField().value).toBe('Egara Juga volunteer')
    expect(preview()).toHaveTextContent('Egara Juga volunteer')
    expect(preview()).toHaveTextContent('Helped at the fair.')
    // A blank English name falls back to Catalan, as members see it.
    fireEvent.change(nameField(), { target: { value: '' } })
    expect(within(preview()).getAllByText('Voluntariat Egara Juga').length).toBeGreaterThan(0)
  })

  it('has Desa disabled while nothing changed', () => {
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    expect(save()).toBeDisabled()
  })

  it('sends only the changed fields', async () => {
    updateBadge.mockResolvedValue({ ok: true, changed: ['name', 'icon'] })
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    fireEvent.change(nameField(), { target: { value: '  Mestre de rol ' } })
    fireEvent.click(screen.getByRole('button', { name: 'edit.icons.dice' }))
    expect(screen.getByRole('button', { name: 'edit.icons.dice' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(save())
    await waitFor(() =>
      expect(updateBadge).toHaveBeenCalledWith('volunteer_egara_joga', {
        name: { ca: 'Mestre de rol' },
        icon: 'dice',
      })
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(router.refresh).toHaveBeenCalled()
  })

  it('sends a new Spanish text with the Catalan one, the switch and the order', async () => {
    updateBadge.mockResolvedValue({ ok: true, changed: ['earnedText', 'showLocked', 'sortOrder'] })
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('tab', { name: /edit\.lang_es/ }))
    fireEvent.change(screen.getByLabelText(/^edit\.earned_label/), { target: { value: 'Ha dirigido una campaña.' } })
    fireEvent.click(screen.getByRole('switch', { name: 'edit.switch_label' }))
    fireEvent.change(screen.getByLabelText('edit.order_label'), { target: { value: '5' } })
    fireEvent.click(save())
    await waitFor(() =>
      expect(updateBadge).toHaveBeenCalledWith('volunteer_egara_joga', {
        earnedText: { ca: 'Ha dirigit una campanya.', es: 'Ha dirigido una campaña.' },
        showLocked: false,
        sortOrder: 5,
      })
    )
  })

  it('requires the Catalan texts', () => {
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    fireEvent.change(nameField(), { target: { value: '   ' } })
    expect(save()).toBeDisabled()
    expect(screen.getByText('edit.ca_required')).toBeInTheDocument()
    expect(updateBadge).not.toHaveBeenCalled()
  })

  it('discards the changes', () => {
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    fireEvent.change(nameField(), { target: { value: 'Una altra' } })
    fireEvent.click(screen.getByRole('button', { name: 'edit.discard' }))
    expect(nameField().value).toBe('Màster de rol')
    expect(save()).toBeDisabled()
  })

  it.each([
    [{ error: 'badge_text_sensitive' }, 'errors.badge_text_sensitive'],
    [{ error: 'badge_archived' }, 'errors.badge_archived'],
    [{ error: 'no_value' }, 'errors.no_value'],
  ])('shows %j as an alert', async (result, text) => {
    updateBadge.mockResolvedValue(result)
    render(<BadgeEditForm badge={CA_ONLY} onSaved={onSaved} />)
    fireEvent.change(nameField(), { target: { value: 'Mestre' } })
    fireEvent.click(save())
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('is read-only for an archived badge', () => {
    render(<BadgeEditForm badge={badgeRow({ archived_at: '2026-11-02T10:00:00Z' })} onSaved={onSaved} />)
    expect(nameField()).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'edit.save' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'edit.icons.star' })).toBeDisabled()
  })
})
