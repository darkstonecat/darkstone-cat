import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const mockLink = vi.fn()
const mockUnlink = vi.fn()
const mockNewsletter = vi.fn()
const mockCheckLudoya = vi.fn()
const mockCheckBgg = vi.fn()
const mockExport = vi.fn()
const mockReset = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, v?: Record<string, string>) =>
    v ? `${key}:${Object.values(v).join(',')}` : key
  ),
  useLocale: vi.fn(() => 'ca'),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('motion/react', () => ({
  motion: { div: ({ children }: any) => <div>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
vi.mock('@/lib/profile/details-actions', () => ({
  linkGamingAccount: (...a: unknown[]) => mockLink(...a),
  unlinkGamingAccount: (...a: unknown[]) => mockUnlink(...a),
  setNewsletterAccepted: (...a: unknown[]) => mockNewsletter(...a),
}))
vi.mock('@/lib/profile/username-checks', () => ({
  checkLudoyaUsername: (...a: unknown[]) => mockCheckLudoya(...a),
  checkBggUsername: (...a: unknown[]) => mockCheckBgg(...a),
}))
vi.mock('@/lib/profile/actions', () => ({
  exportProfileData: (...a: unknown[]) => mockExport(...a),
  deleteAccount: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: mockReset, signOut: vi.fn() } }),
}))

import GamingAccounts from '@/components/profile/GamingAccounts'
import NewsletterSwitch from '@/components/profile/NewsletterSwitch'
import MemberDataCard from '@/components/profile/MemberDataCard'
import AccountActions from '@/components/profile/AccountActions'

beforeEach(() => {
  vi.clearAllMocks()
  mockLink.mockResolvedValue({ error: null, username: 'laia' })
  mockUnlink.mockResolvedValue({ error: null, username: null })
  mockNewsletter.mockResolvedValue({ error: null })
  mockCheckLudoya.mockResolvedValue({ status: 'found' })
  mockCheckBgg.mockResolvedValue({ status: 'not_found' })
})

describe('GamingAccounts', () => {
  it('shows a linked tile with the username, a Ludoya link and unlink', () => {
    render(<GamingAccounts ludoyaUsername="laia" bggUsername={null} />)
    const tile = screen.getByTestId('gaming-tile-ludoya')
    expect(tile).toHaveTextContent('@laia')
    expect(tile).toHaveTextContent('linked')
    const link = tile.querySelector('a')!
    expect(link).toHaveAttribute('href', 'https://app.ludoya.com/laia')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByRole('button', { name: 'unlink' })).toBeInTheDocument()
  })

  it('shows an unlinked tile with a labelled input and a Link button', () => {
    render(<GamingAccounts ludoyaUsername="laia" bggUsername={null} />)
    const tile = screen.getByTestId('gaming-tile-bgg')
    expect(tile).toHaveTextContent('not_linked')
    expect(screen.getByLabelText('link_help')).toHaveAttribute('placeholder', 'bgg_placeholder')
  })

  it('links a BGG username and switches to the linked tile', async () => {
    mockLink.mockResolvedValue({ error: null, username: 'laia' })
    render(<GamingAccounts ludoyaUsername={null} bggUsername={null} />)
    const tile = screen.getByTestId('gaming-tile-bgg')
    const input = tile.querySelector('input')!
    fireEvent.change(input, { target: { value: ' @laia ' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(tile).toHaveTextContent('@laia'))
    expect(mockLink).toHaveBeenCalledWith('bgg', ' @laia ')
    expect(tile.querySelector('a')).toHaveAttribute('href', 'https://boardgamegeek.com/user/laia')
  })

  it('shows a soft warning for an unknown user and still lets the member link it', async () => {
    render(<GamingAccounts ludoyaUsername={null} bggUsername={null} />)
    const tile = screen.getByTestId('gaming-tile-bgg')
    const input = tile.querySelector('input')!
    fireEvent.change(input, { target: { value: 'nobody' } })
    fireEvent.blur(input)
    expect(await screen.findByText('bgg_not_found')).toBeInTheDocument()
    const submit = tile.querySelector('button[type="submit"]')!
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    await waitFor(() => expect(mockLink).toHaveBeenCalledWith('bgg', 'nobody'))
  })

  it('reports a save error without changing state', async () => {
    mockLink.mockResolvedValue({ error: 'failed' })
    render(<GamingAccounts ludoyaUsername={null} bggUsername={null} />)
    const tile = screen.getByTestId('gaming-tile-ludoya')
    const input = tile.querySelector('input')!
    fireEvent.change(input, { target: { value: 'laia' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('save_error')
    expect(tile).toHaveTextContent('not_linked')
  })

  it('unlinks and returns to the input state', async () => {
    render(<GamingAccounts ludoyaUsername="laia" bggUsername="laia" />)
    fireEvent.click(within(screen.getByTestId('gaming-tile-bgg')).getByRole('button', { name: 'unlink' }))
    await waitFor(() => expect(screen.getByTestId('gaming-tile-bgg')).toHaveTextContent('not_linked'))
    expect(mockUnlink).toHaveBeenCalledWith('bgg')
  })
})
describe('NewsletterSwitch', () => {
  it('is a switch reflecting the saved value with a 44px hit area', () => {
    render(<NewsletterSwitch initialValue />)
    const sw = screen.getByRole('switch', { name: 'newsletter_title' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw.className).toContain('min-h-11')
  })

  it('toggles optimistically and confirms in a live region', async () => {
    let resolve!: (v: { error: null }) => void
    mockNewsletter.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<NewsletterSwitch initialValue={false} />)
    const sw = screen.getByRole('switch')
    fireEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(mockNewsletter).toHaveBeenCalledWith(true)
    resolve({ error: null })
    expect(await screen.findByText('newsletter_on')).toBeInTheDocument()
  })

  it('rolls back and announces an error when saving fails', async () => {
    mockNewsletter.mockResolvedValue({ error: 'failed' })
    render(<NewsletterSwitch initialValue={false} />)
    const sw = screen.getByRole('switch')
    fireEvent.click(sw)
    expect(await screen.findByRole('alert')).toHaveTextContent('newsletter_error')
    expect(sw).toHaveAttribute('aria-checked', 'false')
  })

  it('rolls back when the action throws', async () => {
    mockNewsletter.mockRejectedValue(new Error('network'))
    render(<NewsletterSwitch initialValue />)
    const sw = screen.getByRole('switch')
    fireEvent.click(sw)
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'true'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('MemberDataCard', () => {
  const props = {
    email: 'a@b.test',
    firstName: 'Anna',
    lastName: 'Puig',
    postalCode: '08224',
    dni: { masked: '•••••678Z', tail: '678Z' },
    phone: { masked: '••• ••• 412', tail: '412' },
  }

  it('renders the masked values with an accessible spoken form and an edit link', () => {
    render(<MemberDataCard {...props} />)
    expect(screen.getByText('•••••678Z')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('dni_ends_with:678Z')).toHaveClass('sr-only')
    expect(screen.getByText('phone_ends_with:412')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /edit/ })).toHaveAttribute('href', '/profile/edit')
    expect(screen.getByText('a@b.test')).toBeInTheDocument()
  })

  it('shows "not provided" for missing values', () => {
    render(<MemberDataCard {...props} dni={null} phone={null} postalCode={null} />)
    expect(screen.getAllByText('not_provided')).toHaveLength(3)
  })
})

describe('AccountActions', () => {
  it('sends the recovery email through the existing reset flow', async () => {
    mockReset.mockResolvedValue({ error: null })
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    fireEvent.click(screen.getByRole('button', { name: /change_password/ }))
    expect(await screen.findByText('change_password_sent')).toBeInTheDocument()
    expect(mockReset).toHaveBeenCalledWith('a@b.test', {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
  })

  it('announces an error when the recovery email fails', async () => {
    mockReset.mockResolvedValue({ error: new Error('x') })
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    fireEvent.click(screen.getByRole('button', { name: /change_password/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('change_password_error')
  })

  it('reports a failed export and opens the delete dialog', async () => {
    mockExport.mockResolvedValue({ data: null, error: 'x' })
    render(<AccountActions email="a@b.test" memberNumber="000-001" />)
    fireEvent.click(screen.getByRole('button', { name: /download_data/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('download_error')
    fireEvent.click(screen.getByRole('button', { name: /delete_account/ }))
    expect(await screen.findByLabelText('delete_confirm_prompt')).toBeInTheDocument()
  })
})
