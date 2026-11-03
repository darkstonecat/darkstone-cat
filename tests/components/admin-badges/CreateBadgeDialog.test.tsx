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
const createBadge = vi.fn()
vi.mock('@/lib/admin/badge-actions', () => ({ createBadge: (...a: unknown[]) => createBadge(...a) }))

import CreateBadgeDialog from '@/components/admin/badges/CreateBadgeDialog'

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

function fill() {
  fireEvent.change(screen.getByLabelText(/create\.name_label/), { target: { value: 'Màster de rol' } })
  fireEvent.change(screen.getByLabelText(/create\.earned_label/), {
    target: { value: "Ha dirigit una campanya de rol a l'associació." },
  })
  fireEvent.change(screen.getByLabelText(/create\.locked_label/), {
    target: { value: 'Dirigeix una campanya de rol per aconseguir-la.' },
  })
}

describe('CreateBadgeDialog (S7.4)', () => {
  it('proposes the key from the name and keeps proposing until the key is edited', () => {
    render(<CreateBadgeDialog open onClose={onClose} />)
    const key = screen.getByLabelText(/create\.key_label/) as HTMLInputElement
    fireEvent.change(screen.getByLabelText(/create\.name_label/), { target: { value: 'Màster de rol' } })
    expect(key.value).toBe('master_de_rol')
    fireEvent.change(screen.getByLabelText(/create\.name_label/), { target: { value: 'Col·laborador' } })
    expect(key.value).toBe('collaborador')

    fireEvent.change(key, { target: { value: 'mestre_rol' } })
    fireEvent.change(screen.getByLabelText(/create\.name_label/), { target: { value: 'Màster de rol' } })
    expect(key.value).toBe('mestre_rol')
  })

  it('keeps "Crea i obre" disabled with a reason until every field is filled', () => {
    render(<CreateBadgeDialog open onClose={onClose} />)
    const confirm = screen.getByRole('button', { name: 'create.confirm' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText('create.disabled')).toBeInTheDocument()
    fill()
    expect(confirm).toBeEnabled()
  })

  it('explains an invalid key and keeps the button disabled', () => {
    render(<CreateBadgeDialog open onClose={onClose} />)
    fill()
    fireEvent.change(screen.getByLabelText(/create\.key_label/), { target: { value: '1bad key' } })
    expect(screen.getByRole('button', { name: 'create.confirm' })).toBeDisabled()
    expect(screen.getAllByText('create.key_invalid').length).toBeGreaterThan(0)
  })

  it('creates the badge with trimmed Catalan texts and opens its page', async () => {
    createBadge.mockResolvedValue({ ok: true, key: 'master_de_rol' })
    render(<CreateBadgeDialog open onClose={onClose} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'create.confirm' }))
    await waitFor(() =>
      expect(createBadge).toHaveBeenCalledWith({
        key: 'master_de_rol',
        name: 'Màster de rol',
        earnedText: "Ha dirigit una campanya de rol a l'associació.",
        lockedText: 'Dirigeix una campanya de rol per aconseguir-la.',
      })
    )
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/badges/master_de_rol'))
  })

  it.each([
    [{ error: 'badge_exists' }, 'errors.badge_exists'],
    [{ error: 'badge_text_sensitive' }, 'errors.badge_text_sensitive'],
    [{ error: 'invalid', field: 'key' }, 'create.key_invalid'],
    [{ error: 'weird' }, 'errors.failed'],
  ])('maps %j to a message and stays open', async (result, text) => {
    createBadge.mockResolvedValue(result)
    render(<CreateBadgeDialog open onClose={onClose} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'create.confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(router.push).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
