import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockMotion, mockTranslator } from '../helpers/register-mocks'

const mockSignUp = vi.fn()
const mockResend = vi.fn()
const mockUpdateMember = vi.fn()
const mockPrepare = vi.fn()
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
  prepareSignup: (...args: unknown[]) => mockPrepare(...args),
}))
vi.mock('@/lib/profile/username-checks', () => ({
  checkLudoyaUsername: (...args: unknown[]) => mockCheckLudoya(...args),
  checkBggUsername: (...args: unknown[]) => mockCheckBgg(...args),
}))

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

import RegisterFlow from '@/components/auth/RegisterFlow'


describe('Register username checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckLudoya.mockResolvedValue({ status: 'found' })
    mockCheckBgg.mockResolvedValue({ status: 'not_found' })
  })

  const ludoyaInput = () => screen.getByLabelText('register_ludoya_label')
  const bggInput = () => screen.getByLabelText('register_bgg_label')

  it('stays idle for an empty value and never calls the server', () => {
    render(<RegisterFlow />)
    fireEvent.blur(ludoyaInput())
    expect(mockCheckLudoya).not.toHaveBeenCalled()
  })

  it('checks Ludoya on blur (without a leading @) and shows the found state', async () => {
    let resolve!: (v: { status: string }) => void
    mockCheckLudoya.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<RegisterFlow />)
    fireEvent.change(ludoyaInput(), { target: { value: '@laiaserra' } })
    fireEvent.blur(ludoyaInput())
    expect(await screen.findByText('register_check_checking')).toBeInTheDocument()
    expect(mockCheckLudoya).toHaveBeenCalledWith('laiaserra')
    resolve({ status: 'found' })
    expect(await screen.findByText(/register_check_found:laiaserra/)).toBeInTheDocument()
    expect(mockCheckBgg).not.toHaveBeenCalled()
  })

  it('shows a soft warning for a missing BGG user and does not block sign-up', async () => {
    render(<RegisterFlow />)
    fireEvent.change(bggInput(), { target: { value: 'nobody' } })
    fireEvent.blur(bggInput())
    expect(await screen.findByText('register_bgg_not_found')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register_submit/ })).toBeEnabled()
  })

  it('is silent when the check fails or throws', async () => {
    mockCheckLudoya.mockResolvedValue({ status: 'failed' })
    mockCheckBgg.mockRejectedValue(new Error('network'))
    render(<RegisterFlow />)
    fireEvent.change(ludoyaInput(), { target: { value: 'a' } })
    fireEvent.blur(ludoyaInput())
    fireEvent.change(bggInput(), { target: { value: 'b' } })
    fireEvent.blur(bggInput())
    await waitFor(() => expect(mockCheckBgg).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('register_check_checking')).not.toBeInTheDocument())
    expect(screen.queryByText('register_ludoya_not_found')).not.toBeInTheDocument()
    expect(screen.queryByText('register_bgg_not_found')).not.toBeInTheDocument()
    expect(screen.queryByText(/register_check_found/)).not.toBeInTheDocument()
  })

  it('does not repeat the call for an unchanged value, but checks a changed one', async () => {
    render(<RegisterFlow />)
    fireEvent.change(bggInput(), { target: { value: 'nobody' } })
    fireEvent.blur(bggInput())
    await screen.findByText('register_bgg_not_found')
    fireEvent.blur(bggInput())
    fireEvent.change(bggInput(), { target: { value: 'nobody' } })
    fireEvent.blur(bggInput())
    await screen.findByText('register_bgg_not_found')
    expect(mockCheckBgg).toHaveBeenCalledTimes(1)

    fireEvent.change(bggInput(), { target: { value: 'other' } })
    fireEvent.blur(bggInput())
    await waitFor(() => expect(mockCheckBgg).toHaveBeenCalledTimes(2))
  })

  it('does not re-request a value that is still being checked', async () => {
    mockCheckBgg.mockReturnValue(new Promise(() => {}))
    render(<RegisterFlow />)
    fireEvent.change(bggInput(), { target: { value: 'slow' } })
    fireEvent.blur(bggInput())
    fireEvent.blur(bggInput())
    expect(mockCheckBgg).toHaveBeenCalledTimes(1)
  })

  it('clears the status when the value is edited', async () => {
    render(<RegisterFlow />)
    fireEvent.change(bggInput(), { target: { value: 'nobody' } })
    fireEvent.blur(bggInput())
    await screen.findByText('register_bgg_not_found')
    fireEvent.change(bggInput(), { target: { value: 'nobod' } })
    expect(screen.queryByText('register_bgg_not_found')).not.toBeInTheDocument()
  })
})
