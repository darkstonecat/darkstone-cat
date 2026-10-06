import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
const revealSensitive = vi.fn()
vi.mock('@/lib/admin/member-actions', () => ({
  revealSensitive: (...a: unknown[]) => revealSensitive(...a),
  updateMember: vi.fn(),
}))

import RevealButton from '@/components/admin/member-file/RevealButton'

const open = (former: boolean, field: 'dni' | 'phone' = 'dni') => {
  render(<RevealButton memberId="id-1" memberNumber="000-203" memberName="Laia Serra" field={field} former={former} />)
  fireEvent.click(screen.getByRole('button', { name: /button_label/ }))
}

beforeEach(() => revealSensitive.mockReset())

describe('RevealButton (A-5)', () => {
  it('active member: the reason is optional; null is sent when blank', async () => {
    revealSensitive.mockResolvedValue({ value: '12345678Z' })
    open(false)
    expect(screen.queryByText('chip_superadmin_only')).not.toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: /^confirm/ })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(await screen.findByTestId('revealed-value')).toHaveTextContent('12345678Z')
    expect(revealSensitive).toHaveBeenCalledWith('id-1', 'dni', null)
  })

  it('active member: sends the trimmed optional reason', async () => {
    revealSensitive.mockResolvedValue({ value: '600000000' })
    open(false, 'phone')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Trucar-lo  ' } })
    fireEvent.click(screen.getByRole('button', { name: /^confirm/ }))
    await screen.findByTestId('revealed-value')
    expect(revealSensitive).toHaveBeenCalledWith('id-1', 'phone', 'Trucar-lo')
  })

  it('former member: superadmin chip and a 10-character reason before confirm enables', async () => {
    revealSensitive.mockResolvedValue({ value: '12345678Z' })
    open(true)
    expect(screen.getByText('chip_superadmin_only')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: /^confirm/ })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'too short' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Requeriment judicial' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await screen.findByTestId('revealed-value')
    expect(revealSensitive).toHaveBeenCalledWith('id-1', 'dni', 'Requeriment judicial')
  })

  it('clears the value on close: reopening shows no value', async () => {
    revealSensitive.mockResolvedValue({ value: '12345678Z' })
    open(false)
    fireEvent.click(screen.getByRole('button', { name: /^confirm/ }))
    await screen.findByTestId('revealed-value')
    fireEvent.click(screen.getByRole('button', { name: 'close', hidden: false }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('12345678Z')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /button_label/ }))
    expect(screen.queryByTestId('revealed-value')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('12345678Z')
  })

  it('copies the revealed value', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    revealSensitive.mockResolvedValue({ value: '12345678Z' })
    open(false)
    fireEvent.click(screen.getByRole('button', { name: /^confirm/ }))
    await screen.findByTestId('revealed-value')
    fireEvent.click(screen.getByRole('button', { name: 'copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('12345678Z'))
    expect(await screen.findByText('copied')).toBeInTheDocument()
  })

  it.each([
    ['no_value', 'no_value'],
    ['forbidden', 'forbidden'],
    ['reason_required', 'reason_required'],
    ['reason_too_long', 'reason_too_long'],
    ['failed', 'failed'],
    ['weird', 'failed'],
  ])('maps the error %s', async (code, text) => {
    revealSensitive.mockResolvedValue({ error: code })
    open(false)
    fireEvent.click(screen.getByRole('button', { name: /^confirm/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.queryByTestId('revealed-value')).not.toBeInTheDocument()
  })
})
