import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockRequestMagicLink = vi.fn()
const mockSignInWithPassword = vi.fn()
let searchString = ''
let locale = 'ca'

vi.mock('next-intl', () => ({
  useLocale: () => locale,
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
    auth: { signInWithPassword: mockSignInWithPassword },
  })),
}))

vi.mock('@/lib/supabase/magic-link-actions', () => ({
  requestMagicLink: (...args: unknown[]) => mockRequestMagicLink(...args),
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
    locale = 'ca'
    mockRequestMagicLink.mockResolvedValue({ error: null })
  })

  it('disables the magic link button until the email is valid', () => {
    render(<LoginForm />)
    expect(magicButton()).toBeDisabled()
    typeEmail('nope')
    expect(magicButton()).toBeDisabled()
    typeEmail('laia@example.cat')
    expect(magicButton()).toBeEnabled()
  })

  it('requests the magic link through the server and shows the sent state', async () => {
    render(<LoginForm />)
    typeEmail(' laia@example.cat ')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'login_magic_sent_title' })).toBeInTheDocument()
    )
    expect(mockRequestMagicLink).toHaveBeenCalledWith('laia@example.cat')
    expect(screen.getByText('login_magic_sent_text:laia@example.cat')).toBeInTheDocument()
  })

  it('shows a generic error when the server reports a failure', async () => {
    mockRequestMagicLink.mockResolvedValue({ error: 'failed' })
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('login_error_generic')
    )
  })

  it('shows a generic error when the server action throws', async () => {
    mockRequestMagicLink.mockRejectedValue(new Error('network'))
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.click(magicButton())
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('login_error_generic')
    )
    expect(screen.getByRole('button', { name: 'login_magic_button' })).toBeEnabled()
  })

  it('lets the member go back from the sent state', async () => {
    render(<LoginForm />)
    typeEmail('laia@example.cat')
    fireEvent.click(magicButton())
    fireEvent.click(await screen.findByRole('button', { name: 'login_magic_sent_back' }))
    expect(screen.getByLabelText('login_email_label')).toHaveValue('laia@example.cat')
    await waitFor(() => expect(screen.getByLabelText('login_email_label')).toHaveFocus())
  })

  describe('password login redirect', () => {
    const originalLocation = window.location
    let assigned = ''
    beforeEach(() => {
      assigned = ''
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          origin: 'http://localhost:3000',
          protocol: 'http:',
          set href(v: string) {
            assigned = v
          },
        },
      })
      mockSignInWithPassword.mockResolvedValue({ error: null })
    })
    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    })

    async function login() {
      render(<LoginForm />)
      typeEmail('laia@example.cat')
      fireEvent.change(screen.getByLabelText('login_password_label'), { target: { value: 'secret' } })
      fireEvent.click(screen.getByRole('button', { name: 'login_submit' }))
      await waitFor(() => expect(assigned).not.toBe(''))
    }

    it('goes to /profile by default', async () => {
      await login()
      expect(assigned).toBe('/profile')
    })

    it('honours a safe redirect', async () => {
      searchString = 'redirect=%2Fes%2Fprofile%2Fcard'
      await login()
      expect(assigned).toBe('/es/profile/card')
    })

    it.each(['//evil.com', '/.//evil.com', '/..//evil.com', '/a/..//evil.com', 'https://evil.com'])(
      'never navigates off-site for redirect=%s',
      async (value) => {
        searchString = `redirect=${encodeURIComponent(value)}`
        await login()
        expect(assigned).toBe('/profile')
      }
    )
  })

  describe('magic link destination cookie', () => {
    // jsdom hides Path=/auth cookies from document.cookie on "/", so spy on writes.
    let written: string[] = []
    beforeEach(() => {
      written = []
      vi.spyOn(document, 'cookie', 'set').mockImplementation((v) => {
        written.push(v)
      })
    })
    afterEach(() => vi.restoreAllMocks())
    it('stores the sanitized redirect', async () => {
      searchString = 'redirect=%2Fprofile%2Fcard'
      render(<LoginForm />)
      typeEmail('laia@example.cat')
      fireEvent.click(magicButton())
      await screen.findByRole('heading', { name: 'login_magic_sent_title' })
      expect(decodeURIComponent(written.join('\n'))).toContain('magic_redirect=/profile/card')
      expect(written[0]).toMatch(/Path=\/auth.*Max-Age=3600.*SameSite=Lax/)
    })

    it('falls back to the locale profile', async () => {
      locale = 'es'
      searchString = 'redirect=%2F%2Fevil.com'
      render(<LoginForm />)
      typeEmail('laia@example.cat')
      fireEvent.click(magicButton())
      await screen.findByRole('heading', { name: 'login_magic_sent_title' })
      expect(decodeURIComponent(written.join('\n'))).toContain('magic_redirect=/es/profile')
    })
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
