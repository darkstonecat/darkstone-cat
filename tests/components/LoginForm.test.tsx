import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockSignInWithOtp = vi.fn()
const mockSignInWithPassword = vi.fn()
let searchString = ''

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, string>) =>
    values?.email ? `${key}:${values.email}` : key
  ),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchString),
}))

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { signInWithOtp: mockSignInWithOtp, signInWithPassword: mockSignInWithPassword },
  })),
}))

vi.mock('motion/react', () => ({
  motion: {
    form: ({ children, initial, animate, transition, ...props }: any) => (
      <form {...props}>{children}</form>
    ),
  },
}))

import LoginForm from '@/components/auth/LoginForm'

const magicButton = () => screen.getByRole('button', { name: 'login_magic_button' })
const typeEmail = (v: string) =>
  fireEvent.change(screen.getByLabelText('login_email_label'), { target: { value: v } })

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchString = ''
    mockSignInWithOtp.mockResolvedValue({ error: null })
  })

  it('disables the magic link button until the email is valid', () => {
    render(<LoginForm />)
    expect(magicButton()).toBeDisabled()
    typeEmail('nope')
    expect(magicButton()).toBeDisabled()
    typeEmail('laia@example.cat')
    expect(magicButton()).toBeEnabled()
  })

  it('sends the magic link without creating users and shows the sent state', async () => {
    render(<LoginForm />)
    typeEmail(' laia@example.cat ')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'login_magic_sent_title' })).toBeInTheDocument()
    )
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'laia@example.cat',
      options: { shouldCreateUser: false },
    })
    expect(screen.getByText('login_magic_sent_text:laia@example.cat')).toBeInTheDocument()
  })

  it('shows the same sent state when the account does not exist (otp_disabled)', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { code: 'otp_disabled', status: 422 } })
    render(<LoginForm />)
    typeEmail('ghost@example.cat')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'login_magic_sent_title' })).toBeInTheDocument()
    )
  })

  it('shows the rate-limit message and stays on the form', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', status: 429 } })
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('login_magic_error_rate_limit')
    )
    expect(magicButton()).toBeEnabled()
  })

  it('shows a generic error for other failures', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { code: 'unexpected_failure', status: 500 } })
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('login_error_generic')
    )
  })

  it('lets the member go back from the sent state', async () => {
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.click(magicButton())
    fireEvent.click(await screen.findByRole('button', { name: 'login_magic_sent_back' }))
    expect(screen.getByLabelText('login_email_label')).toHaveValue('laia@example.cat')
  })

  it('disables both buttons while the password login runs', async () => {
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}))
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.change(screen.getByLabelText('login_password_label'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'login_submit' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'login_submit' })).toBeDisabled())
    expect(magicButton()).toBeDisabled()
  })

  it.each([
    ['magic=error', 'login_magic_error'],
    ['recovery=error', 'login_recovery_error'],
    ['confirmed=error', 'login_confirmed_error'],
  ])('renders the ?%s banner', (query, text) => {
    searchString = query
    render(<LoginForm />)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
  })

  it('renders the ?confirmed=success banner as a status', () => {
    searchString = 'confirmed=success'
    render(<LoginForm />)
    expect(screen.getByRole('status')).toHaveTextContent('login_confirmed_success')
  })
})
