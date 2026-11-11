import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'ca',
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line jsx-a11y/alt-text
  default: ({ fill: _fill, quality: _quality, ...props }: any) => <img {...props} />,
}))
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('@/i18n/routing', () => ({ useRouter: () => router }))
const actions = vi.hoisted(() => ({
  createBenefit: vi.fn(),
  updateBenefit: vi.fn(),
  archiveBenefit: vi.fn(),
  restoreBenefit: vi.fn(),
}))
vi.mock('@/lib/admin/benefit-actions', () => actions)

import BenefitList from '@/components/admin/benefits/BenefitList'
import type { AdminBenefitRow } from '@/lib/admin/benefits'

const row = (over: Partial<AdminBenefitRow> = {}): AdminBenefitRow => ({
  id: '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b',
  name: { ca: 'Outlet Games', es: 'Outlet Games', en: 'Outlet Games' },
  description: { ca: 'Descompte amb el codi de soci.', es: 'Descuento.', en: 'Discount.' },
  discount_code: 'DARKSTONE',
  url: 'https://outletgames.es',
  collaborator_id: 'outlet-games',
  sort_order: 10,
  archived_at: null,
  created_at: '2026-11-11T10:00:00Z',
  updated_at: '2026-11-11T10:00:00Z',
  ...over,
})
const ARCHIVED = row({
  id: '9f8e7d6c-5b4a-4321-8fed-cba987654321',
  name: { ca: 'Botiga antiga' },
  description: { ca: 'Ja no.' },
  discount_code: null,
  collaborator_id: null,
  archived_at: '2026-10-01T10:00:00Z',
})

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset()
  router.refresh.mockReset()
})

const dialog = () => screen.getByRole('dialog')

describe('BenefitList', () => {
  it('lists active benefits with code, shop and languages, and archived ones apart', () => {
    render(<BenefitList benefits={[row(), ARCHIVED]} loadError={false} />)
    const active = screen.getByRole('region', { name: 'active_title' })
    expect(within(active).getByText('Outlet Games')).toBeInTheDocument()
    expect(within(active).getByText('code_chip:{"code":"DARKSTONE"}')).toBeInTheDocument()
    expect(within(active).getByRole('link', { name: 'outletgames.es' })).toHaveAttribute('href', 'https://outletgames.es')
    expect(within(active).getByText('ca · es · en')).toBeInTheDocument()
    expect(within(active).queryByText('Botiga antiga')).not.toBeInTheDocument()

    const archived = screen.getByRole('region', { name: 'archived_title' })
    expect(within(archived).getByText('Botiga antiga')).toBeInTheDocument()
    expect(within(archived).getByText('no_code')).toBeInTheDocument()
    expect(within(archived).getByText('only_ca')).toBeInTheDocument()
    expect(within(archived).getByRole('button', { name: 'restore_label:{"name":"Botiga antiga"}' })).toBeInTheDocument()
  })

  it('shows the empty text and the load error', () => {
    const { unmount } = render(<BenefitList benefits={[]} loadError={false} />)
    expect(screen.getByText('empty')).toBeInTheDocument()
    unmount()
    render(<BenefitList benefits={[]} loadError />)
    expect(screen.getByText('load_error')).toBeInTheDocument()
    expect(screen.queryByText('empty')).not.toBeInTheDocument()
  })

  it('creates a benefit from the dialog and refreshes', async () => {
    actions.createBenefit.mockResolvedValue({ ok: true, id: 'new-id' })
    render(<BenefitList benefits={[]} loadError={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'new_button' }))

    const confirm = within(dialog()).getByRole('button', { name: 'form.create' })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog()).getByLabelText(/form.name_label/), { target: { value: 'Nova botiga' } })
    fireEvent.change(within(dialog()).getByLabelText(/form.description_label/), { target: { value: 'Un descompte.' } })
    fireEvent.change(within(dialog()).getByLabelText(/form.url_label/), { target: { value: 'https://nova.example' } })
    fireEvent.change(within(dialog()).getByLabelText('form.code_label'), { target: { value: 'NOVA5' } })
    fireEvent.change(within(dialog()).getByLabelText('form.logo_label'), { target: { value: 'outlet-games' } })
    expect(within(dialog()).queryByLabelText('form.order_label')).not.toBeInTheDocument()
    fireEvent.click(confirm)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('created_done'))
    expect(actions.createBenefit).toHaveBeenCalledWith({
      name: { ca: 'Nova botiga', es: '', en: '' },
      description: { ca: 'Un descompte.', es: '', en: '' },
      url: 'https://nova.example',
      discountCode: 'NOVA5',
      collaboratorId: 'outlet-games',
    })
    expect(router.refresh).toHaveBeenCalled()
  })

  it('edits a benefit with its current values, per language, and sends the order', async () => {
    actions.updateBenefit.mockResolvedValue({ ok: true, changed: ['discount_code'] })
    render(<BenefitList benefits={[row()]} loadError={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'edit_label:{"name":"Outlet Games"}' }))

    expect(within(dialog()).getByLabelText('form.code_label')).toHaveValue('DARKSTONE')
    expect(within(dialog()).getByLabelText('form.order_label')).toHaveValue(10)
    fireEvent.click(within(dialog()).getByRole('tab', { name: 'form.lang_en' }))
    expect(within(dialog()).getByLabelText(/form.description_label/)).toHaveValue('Discount.')
    fireEvent.change(within(dialog()).getByLabelText('form.code_label'), { target: { value: 'NOU' } })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'form.save' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('updated_done'))
    expect(actions.updateBenefit).toHaveBeenCalledWith(row().id, {
      name: { ca: 'Outlet Games', es: 'Outlet Games', en: 'Outlet Games' },
      description: { ca: 'Descompte amb el codi de soci.', es: 'Descuento.', en: 'Discount.' },
      url: 'https://outletgames.es',
      discountCode: 'NOU',
      collaboratorId: 'outlet-games',
      sortOrder: 10,
    })
  })

  it('keeps the dialog open with the field message when the server refuses a field', async () => {
    actions.updateBenefit.mockResolvedValue({ error: 'invalid', field: 'url' })
    render(<BenefitList benefits={[row()]} loadError={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'edit_label:{"name":"Outlet Games"}' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'form.save' }))

    await waitFor(() => expect(within(dialog()).getByRole('alert')).toHaveTextContent('errors.field_url'))
    expect(within(dialog()).getByLabelText(/form.url_label/)).toHaveAttribute('aria-invalid', 'true')
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('archives and restores after confirming', async () => {
    actions.archiveBenefit.mockResolvedValue({ ok: true })
    actions.restoreBenefit.mockResolvedValue({ ok: true })
    render(<BenefitList benefits={[row(), ARCHIVED]} loadError={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'archive_label:{"name":"Outlet Games"}' }))
    expect(within(dialog()).getByText('archive_text')).toBeInTheDocument()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'archive_confirm' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('archive_done'))
    expect(actions.archiveBenefit).toHaveBeenCalledWith(row().id)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'restore_label:{"name":"Botiga antiga"}' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'restore_confirm' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('restore_done'))
    expect(actions.restoreBenefit).toHaveBeenCalledWith(ARCHIVED.id)
  })

  it('shows the archive error inside the dialog', async () => {
    actions.archiveBenefit.mockResolvedValue({ error: 'benefit_archived' })
    render(<BenefitList benefits={[row()]} loadError={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'archive_label:{"name":"Outlet Games"}' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'archive_confirm' }))
    await waitFor(() => expect(within(dialog()).getByRole('alert')).toHaveTextContent('errors.benefit_archived'))
  })
})
