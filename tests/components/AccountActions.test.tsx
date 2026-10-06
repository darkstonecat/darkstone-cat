import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// "Compte" card of /profile/details (AccountActions) and the M-1 leave dialog (spec §7.1, T26).

const m = vi.hoisted(() => ({
  exportData: vi.fn(),
  reset: vi.fn(),
  leave: vi.fn(),
  role: 'member' as string | null,
  locale: 'ca',
}))

vi.mock('next-intl', () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  t.rich = (key: string, values: Record<string, (chunks: string) => unknown>) => values.link(key)
  return { useTranslations: () => t, useLocale: () => m.locale }
})
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => null }))
vi.mock('@/hooks/useAuthUser', () => ({
  useAuthUser: () => ({ user: { id: 'u1' }, role: m.role, loading: false }),
}))
vi.mock('@/lib/profile/actions', () => ({ exportProfileData: (...a: unknown[]) => m.exportData(...a) }))
vi.mock('@/lib/supabase/password-reset-actions', () => ({
  requestPasswordReset: (...a: unknown[]) => m.reset(...a),
}))
vi.mock('@/lib/profile/leave-actions', () => ({ leaveAssociation: (...a: unknown[]) => m.leave(...a) }))

import AccountActions from '@/components/profile/AccountActions'

const originalLocation = window.location
let hrefSetter: ReturnType<typeof vi.fn<(v: string) => void>>
let cookieWrites: string[]

beforeEach(() => {
  vi.clearAllMocks()
  m.role = 'member'
  m.locale = 'ca'
  m.reset.mockResolvedValue({ error: null })
  m.leave.mockResolvedValue({ ok: true })
  hrefSetter = vi.fn<(v: string) => void>()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: Object.defineProperty({ origin: 'http://localhost' }, 'href', {
      set: hrefSetter,
      get: () => 'http://localhost/profile/details',
    }),
  })
  cookieWrites = []
  vi.spyOn(document, 'cookie', 'set').mockImplementation((v: string) => {
    cookieWrites.push(v)
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  vi.restoreAllMocks()
})

function openDialog() {
  render(<AccountActions email="a@b.test" memberNumber="000-001" />)
  fireEvent.click(screen.getByRole('button', { name: /leave_button/ }))
  return screen.getByRole('dialog')
}

describe('AccountActions', () => {
  it('sends the recovery e-mail through the neutral server action', async () => {
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    fireEvent.click(screen.getByRole('button', { name: /change_password/ }))
    expect(await screen.findByText('change_password_sent')).toBeInTheDocument()
    expect(m.reset).toHaveBeenCalledWith('a@b.test')
  })

  it('announces an error when the recovery e-mail fails', async () => {
    m.reset.mockResolvedValue({ error: 'failed' })
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    fireEvent.click(screen.getByRole('button', { name: /change_password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('change_password_error')
  })

  it('reports a failed export', async () => {
    m.exportData.mockResolvedValue({ data: null, error: 'x' })
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    fireEvent.click(screen.getByRole('button', { name: /download_data/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('download_error')
  })

  it.each(['board', 'admin', 'superadmin'])('blocks the leave of a %s with the reason visible (BR-12)', (role) => {
    m.role = role
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    const button = screen.getByRole('button', { name: /leave_button/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('leave_error_role_held')
    expect(screen.getByText('leave_board_chip')).toBeInTheDocument()
  })
})

describe('LeaveAssociationDialog (M-1)', () => {
  it('explains the consequences and needs the checkbox before confirming', () => {
    const dialog = openDialog()
    expect(dialog).toHaveTextContent('leave_target:{"number":"000-001"}')
    for (const key of ['sign_in', 'card', 'data', 'register', 'return']) {
      expect(dialog).toHaveTextContent(`leave_effect_${key}`)
    }
    expect(screen.getByRole('link', { name: 'leave_erasure_hint' })).toHaveAttribute('href', '/privacy')
    const confirm = screen.getByRole('button', { name: 'leave_confirm' })
    expect(confirm).toBeDisabled()
    expect(dialog).toHaveTextContent('leave_checkbox_help')
    fireEvent.click(screen.getByRole('checkbox', { name: /leave_checkbox/ }))
    expect(confirm).toBeEnabled()
  })

  it('offers the data download inside the dialog', async () => {
    m.exportData.mockResolvedValue({ data: null, error: 'x' })
    openDialog()
    const downloads = screen.getAllByRole('button', { name: /download_data/ })
    fireEvent.click(downloads[downloads.length - 1])
    await waitFor(() => expect(m.exportData).toHaveBeenCalledTimes(1))
  })

  it('leaves with the trimmed reason, wipes the auth cookies and goes to /login?left=1', async () => {
    openDialog()
    fireEvent.change(screen.getByLabelText('leave_reason_label'), { target: { value: '  Em trasllado  ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /leave_checkbox/ }))
    fireEvent.click(screen.getByRole('button', { name: 'leave_confirm' }))
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/login?left=1'))
    expect(m.leave).toHaveBeenCalledWith('Em trasllado')
    expect(cookieWrites.some((c) => /^sb-[^=]+-auth-token=; expires=Thu, 01 Jan 1970/.test(c))).toBe(true)
  })

  it('sends no reason when it is blank and keeps the locale prefix', async () => {
    m.locale = 'es'
    openDialog()
    fireEvent.click(screen.getByRole('checkbox', { name: /leave_checkbox/ }))
    fireEvent.click(screen.getByRole('button', { name: 'leave_confirm' }))
    await waitFor(() => expect(hrefSetter).toHaveBeenCalledWith('/es/login?left=1'))
    expect(m.leave).toHaveBeenCalledWith(null)
  })

  it.each([
    ['role_held', 'leave_error_role_held'],
    ['reason_too_long', 'leave_error_reason_too_long'],
    ['unauthenticated', 'leave_error_session'],
    ['not_active', 'leave_error_generic'],
    ['failed', 'leave_error_generic'],
  ])('shows the %s refusal and stays signed in', async (code, text) => {
    m.leave.mockResolvedValue({ error: code })
    openDialog()
    fireEvent.click(screen.getByRole('checkbox', { name: /leave_checkbox/ }))
    fireEvent.click(screen.getByRole('button', { name: 'leave_confirm' }))
    expect(await screen.findByText(text)).toHaveAttribute('role', 'alert')
    expect(hrefSetter).not.toHaveBeenCalled()
    expect(cookieWrites).toEqual([])
  })

  it('treats a thrown action as a generic failure', async () => {
    m.leave.mockRejectedValue(new Error('network'))
    openDialog()
    fireEvent.click(screen.getByRole('checkbox', { name: /leave_checkbox/ }))
    fireEvent.click(screen.getByRole('button', { name: 'leave_confirm' }))
    expect(await screen.findByText('leave_error_generic')).toBeInTheDocument()
    expect(hrefSetter).not.toHaveBeenCalled()
  })
})
