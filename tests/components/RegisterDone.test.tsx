import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { mockTranslator } from '../helpers/register-mocks'

const mockResend = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: vi.fn(() => mockTranslator()) }))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ auth: { resend: mockResend } })),
}))

import RegisterDone, { RESEND_COOLDOWN_MS } from '@/components/auth/RegisterDone'

const resendButton = () => screen.getByRole('button', { name: /register_done_(resend|resending|resent)$/ })

describe('RegisterDone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResend.mockResolvedValue({ error: null })
  })
  afterEach(() => vi.useRealTimers())

  it('shows the submitted email, the login link and the back action', () => {
    const onBack = vi.fn()
    render(<RegisterDone email="soci@example.cat" onBack={onBack} />)
    expect(screen.getByText(/register_done_text:soci@example\.cat/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'register_done_login' })).toHaveAttribute('href', '/login')
    fireEvent.click(screen.getByRole('button', { name: 'register_done_back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('resends the signup email, announces it and disables the button for the cooldown', async () => {
    vi.useFakeTimers()
    render(<RegisterDone email="soci@example.cat" onBack={() => {}} />)
    await act(async () => {
      fireEvent.click(resendButton())
    })
    expect(mockResend).toHaveBeenCalledWith({ type: 'signup', email: 'soci@example.cat' })
    expect(resendButton()).toBeDisabled()
    expect(resendButton()).toHaveTextContent('register_done_resent')
    expect(screen.getByText('register_done_resent_live:soci@example.cat')).toBeInTheDocument()

    fireEvent.click(resendButton())
    expect(mockResend).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_MS - 1)
    })
    expect(resendButton()).toBeDisabled()
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(resendButton()).toBeEnabled()
    expect(resendButton()).toHaveTextContent('register_done_resend')
  })

  it('shows an error and lets the member retry', async () => {
    mockResend.mockResolvedValueOnce({ error: { status: 500, message: 'boom' } })
    render(<RegisterDone email="soci@example.cat" onBack={() => {}} />)
    fireEvent.click(resendButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('register_done_resend_error')
    expect(resendButton()).toBeEnabled()
  })

  it('reports rate limiting with its own message', async () => {
    mockResend.mockResolvedValueOnce({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'x' } })
    render(<RegisterDone email="soci@example.cat" onBack={() => {}} />)
    fireEvent.click(resendButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('register_done_resend_rate_limit')
  })
})
