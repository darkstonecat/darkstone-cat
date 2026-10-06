import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
const refresh = vi.fn()
vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ refresh }),
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
const regenerateCard = vi.fn()
const sendAccessLink = vi.fn()
vi.mock('@/lib/admin/member-actions', () => ({ regenerateCard: (...a: unknown[]) => regenerateCard(...a) }))
vi.mock('@/lib/admin/access-actions', () => ({ sendAccessLink: (...a: unknown[]) => sendAccessLink(...a) }))

import CardSection from '@/components/admin/member-file/CardSection'

const active = {
  id: 'id-1',
  member_number: '000-203',
  state: 'active' as const,
  first_name: 'Laia',
  last_name: 'Serra',
  has_login: true,
  card_valid: true,
  card_issued_at: '2026-09-14T09:00:00Z',
}

beforeEach(() => {
  regenerateCard.mockReset()
  sendAccessLink.mockReset()
  refresh.mockReset()
})

describe('CardSection regenerate (A-9)', () => {
  it('explains the old QR stops, then regenerates and shows the notice', async () => {
    regenerateCard.mockResolvedValue({ ok: true })
    render(<CardSection member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'regenerate_button' }))
    expect(screen.getByText('regenerate_text')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'regenerate_confirm' }))
    await waitFor(() => expect(regenerateCard).toHaveBeenCalledWith('id-1'))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByRole('status')).toHaveTextContent('regenerate_done')
  })

  it('maps an error and keeps the dialog open', async () => {
    regenerateCard.mockResolvedValue({ error: 'not_active' })
    render(<CardSection member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'regenerate_button' }))
    fireEvent.click(screen.getByRole('button', { name: 'regenerate_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not_active')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('CardSection access link (A-15)', () => {
  it('sends the link without ever taking an address and shows the notice', async () => {
    sendAccessLink.mockResolvedValue({ ok: true })
    render(<CardSection member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'link_button' }))
    fireEvent.click(screen.getByRole('button', { name: 'link_confirm' }))
    await waitFor(() => expect(sendAccessLink).toHaveBeenCalledWith('id-1'))
    expect(sendAccessLink.mock.calls[0]).toHaveLength(1)
    expect(await screen.findByRole('status')).toHaveTextContent('link_done')
  })

  it('shows the minutes left on rate_limited and disables the confirm', async () => {
    sendAccessLink.mockResolvedValue({ error: 'rate_limited', retryAfter: 421 })
    render(<CardSection member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'link_button' }))
    fireEvent.click(screen.getByRole('button', { name: 'link_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('link_rate_limited:{"minutes":8}')
    expect(screen.getByRole('button', { name: 'link_confirm' })).toBeDisabled()
  })

  it('uses the generic message when the wait is unknown', async () => {
    sendAccessLink.mockResolvedValue({ error: 'rate_limited', retryAfter: null })
    render(<CardSection member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'link_button' }))
    fireEvent.click(screen.getByRole('button', { name: 'link_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('link_rate_limited_unknown')
  })

  it('maps send_failed', async () => {
    sendAccessLink.mockResolvedValue({ error: 'send_failed' })
    render(<CardSection member={active} />)
    fireEvent.click(screen.getByRole('button', { name: 'link_button' }))
    fireEvent.click(screen.getByRole('button', { name: 'link_confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('send_failed')
  })
})

describe('CardSection disabled states', () => {
  it('disables both buttons with a reason for a former member', () => {
    render(<CardSection member={{ ...active, state: 'former', card_valid: false }} />)
    expect(screen.getByRole('button', { name: 'regenerate_button' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'link_button' })).toBeDisabled()
    expect(screen.getAllByText('blocked_former')).toHaveLength(2)
    expect(screen.getByText('card_former')).toBeInTheDocument()
  })

  it('disables the link for a member without a login account', () => {
    render(<CardSection member={{ ...active, has_login: false }} />)
    expect(screen.getByRole('button', { name: 'regenerate_button' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'link_button' })).toBeDisabled()
    expect(screen.getByText('link_blocked_no_login')).toBeInTheDocument()
  })
})
