import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, string>) =>
    values?.number ? `${key}:${values.number}` : key
  ),
}))
const lenis = { stop: vi.fn(), start: vi.fn() }
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => lenis }))

import CardQrOverlay from '@/components/profile/CardQrOverlay'
import { buildQrMatrix } from '@/lib/member-card/qr'

const matrix = buildQrMatrix('https://www.darkstone.cat/verify/0123456789abcdef0123456789abcdef')

describe('CardQrOverlay', () => {
  it('opens an accessible modal dialog with a large QR and locks the scroll', async () => {
    const user = userEvent.setup()
    render(<CardQrOverlay matrix={matrix} memberNumber="000-042" />)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'qr_open' }))

    const dialog = screen.getByRole('dialog', { name: 'qr_dialog' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'qr_close' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    expect(lenis.stop).toHaveBeenCalled()
    // tile QR + overlay QR both expose the member number
    expect(screen.getAllByRole('img', { name: 'qr_alt:000-042' })).toHaveLength(2)
  })

  it('keeps focus on the close button when tabbing', async () => {
    const user = userEvent.setup()
    render(<CardQrOverlay matrix={matrix} memberNumber="000-042" />)
    await user.click(screen.getByRole('button', { name: 'qr_open' }))
    await user.tab()
    expect(screen.getByRole('button', { name: 'qr_close' })).toHaveFocus()
  })

  it('closes with Escape, restores scroll and returns focus to the QR tile', async () => {
    const user = userEvent.setup()
    render(<CardQrOverlay matrix={matrix} memberNumber="000-042" />)
    const trigger = screen.getByRole('button', { name: 'qr_open' })
    await user.click(trigger)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(lenis.start).toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })

  it('closes with the close button', async () => {
    const user = userEvent.setup()
    render(<CardQrOverlay matrix={matrix} memberNumber="000-042" />)
    await user.click(screen.getByRole('button', { name: 'qr_open' }))
    await user.click(screen.getByRole('button', { name: 'qr_close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
