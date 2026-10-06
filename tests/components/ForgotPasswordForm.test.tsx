import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// /forgot-password goes through the neutral server action (spec §4.4, T26).

const mockReset = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, initial, animate, exit, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, initial, whileInView, viewport, transition, ...props }: any) => (
      <form {...props}>{children}</form>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
vi.mock('@/lib/supabase/password-reset-actions', () => ({
  requestPasswordReset: (...a: unknown[]) => mockReset(...a),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('the browser client must not send the recovery e-mail')
  },
}))

import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

function submit(email: string) {
  render(<ForgotPasswordForm />)
  fireEvent.change(screen.getByLabelText(/forgot_email_label/), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'forgot_submit' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForgotPasswordForm', () => {
  it('asks the server and shows the same success for any address', async () => {
    mockReset.mockResolvedValue({ error: null })
    submit(' laia@example.cat ')
    expect(await screen.findByText('forgot_success_title')).toBeInTheDocument()
    expect(mockReset).toHaveBeenCalledWith('laia@example.cat')
  })

  it.each([
    ['reports', () => mockReset.mockResolvedValue({ error: 'failed' })],
    ['throws', () => mockReset.mockRejectedValue(new Error('network'))],
  ])('asks to retry when the server %s a failure', async (_n, setup) => {
    setup()
    submit('laia@example.cat')
    expect(await screen.findByRole('alert')).toHaveTextContent('login_error_generic')
    expect(screen.queryByText('forgot_success_title')).toBeNull()
  })

  it('validates the address before calling the server', async () => {
    submit('nope')
    await waitFor(() => expect(screen.getByText('invalid_email')).toBeInTheDocument())
    expect(mockReset).not.toHaveBeenCalled()
  })
})
