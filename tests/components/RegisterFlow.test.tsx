import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockMotion, mockTranslator } from '../helpers/register-mocks'

const mockSignUp = vi.fn()
const mockResend = vi.fn()
const mockUpdateMember = vi.fn()
const mockCheckLudoya = vi.fn()
const mockCheckBgg = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: vi.fn(() => mockTranslator()) }))
vi.mock('motion/react', () => mockMotion())
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ auth: { signUp: mockSignUp, resend: mockResend } })),
}))
vi.mock('@/lib/supabase/actions', () => ({
  updateMemberAfterSignup: (...args: unknown[]) => mockUpdateMember(...args),
}))
vi.mock('@/lib/profile/username-checks', () => ({
  checkLudoyaUsername: (...args: unknown[]) => mockCheckLudoya(...args),
  checkBggUsername: (...args: unknown[]) => mockCheckBgg(...args),
}))

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

import RegisterFlow from '@/components/auth/RegisterFlow'
import { passwordStrength } from '@/components/auth/RegisterForm'

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } })

function fillRequired(email = 'soci@example.cat') {
  type('register_email_label', email)
  type('register_password_label', 'Password123!')
  type('register_first_name_label', 'Nom')
  type('register_last_name_label', 'Cognoms')
}

const checkbox = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!

describe('RegisterFlow (sign-up form)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockUpdateMember.mockResolvedValue({ error: null })
    mockResend.mockResolvedValue({ error: null })
    mockCheckLudoya.mockResolvedValue({ status: 'found' })
    mockCheckBgg.mockResolvedValue({ status: 'not_found' })
  })

  it('shows the three-step overview and three fieldsets', () => {
    render(<RegisterFlow />)
    const steps = screen.getByRole('list', { name: 'register_steps_label' })
    expect(steps.querySelectorAll('li')).toHaveLength(3)
    expect(document.querySelectorAll('fieldset')).toHaveLength(4)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('register_title')
  })

  it('starts with every consent unchecked and links to conduct and privacy', () => {
    render(<RegisterFlow />)
    for (const name of ['conduct', 'privacy', 'newsletter']) {
      expect(checkbox(name).checked).toBe(false)
    }
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/conduct', '/privacy', '/login']))
  })

  it('blocks submit until the required consents are accepted', async () => {
    render(<RegisterFlow />)
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /register_submit/ }))
    expect(await screen.findByText('must_accept_conduct')).toBeInTheDocument()
    expect(screen.getByText('must_accept_privacy')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('keeps the min-8 password rule', async () => {
    render(<RegisterFlow />)
    fillRequired()
    type('register_password_label', 'short')
    fireEvent.click(checkbox('conduct'))
    fireEvent.click(checkbox('privacy'))
    fireEvent.click(screen.getByRole('button', { name: /register_submit/ }))
    expect(await screen.findByText('password_min_length')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('scores the strength meter without changing the rule', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('abcdefgh')).toBe(1)
    expect(passwordStrength('Abcdefg1')).toBe(2)
    expect(passwordStrength('Abcdefghij1!')).toBe(3)
    render(<RegisterFlow />)
    type('register_password_label', 'Abcdefg1')
    const filled = document.querySelectorAll('[data-testid="password-strength"] [data-filled="true"]')
    expect(filled).toHaveLength(2)
  })

  it('signs up, saves the optional data and swaps to the confirmation screen', async () => {
    render(<RegisterFlow />)
    fillRequired('  soci@example.cat ')
    type('register_phone_label', '600000000')
    fireEvent.click(checkbox('conduct'))
    fireEvent.click(checkbox('privacy'))
    fireEvent.click(checkbox('newsletter'))
    fireEvent.click(screen.getByRole('button', { name: /register_submit/ }))

    const heading = await screen.findByRole('heading', { level: 1, name: 'register_done_title' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'soci@example.cat',
        options: { data: { first_name: 'Nom', last_name: 'Cognoms' } },
      })
    )
    expect(mockUpdateMember).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', phone: '600000000', newsletter_accepted: true })
    )
    expect(screen.getByText(/register_done_text:soci@example\.cat/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'register_done_login' })).toHaveAttribute('href', '/login')
  })

  it('shows the email-in-use error and stays on the form', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: { message: 'User already registered' } })
    render(<RegisterFlow />)
    fillRequired()
    fireEvent.click(checkbox('conduct'))
    fireEvent.click(checkbox('privacy'))
    fireEvent.click(screen.getByRole('button', { name: /register_submit/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('register_error_email_in_use')
    expect(mockUpdateMember).not.toHaveBeenCalled()
  })

  it('goes back to the form with the values kept', async () => {
    render(<RegisterFlow />)
    fillRequired()
    fireEvent.click(checkbox('conduct'))
    fireEvent.click(checkbox('privacy'))
    fireEvent.click(screen.getByRole('button', { name: /register_submit/ }))
    await screen.findByRole('heading', { level: 1, name: 'register_done_title' })

    fireEvent.click(screen.getByRole('button', { name: 'register_done_back' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'register_title' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^register_email_label/)).toHaveValue('soci@example.cat')
    expect(screen.getByLabelText(/^register_first_name_label/)).toHaveValue('Nom')
    expect(checkbox('conduct').checked).toBe(true)
  })
})
