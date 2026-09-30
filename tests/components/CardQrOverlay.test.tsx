import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, values?: Record<string, string>) =>
    values?.number ? `${key}:${values.number}` : key
  ),
}))
const lenis = { stop: vi.fn(), start: vi.fn(), isStopped: false }
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => lenis }))

import CardQrOverlay from '@/components/profile/CardQrOverlay'
import { buildQrMatrix } from '@/lib/member-card/qr'

const matrix = buildQrMatrix('https://www.darkstone.cat/verify/0123456789abcdef0123456789abcdef')

describe('CardQrOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lenis.isStopped = false
    document.body.innerHTML = ''
  })

  it('makes #main-content inert while open and restores it on close', async () => {
    const user = userEvent.setup()
    const main = document.createElement('main')
    main.id = 'main-content'
    document.body.appendChild(main)
    render(<CardQrOverlay matrix={matrix} memberNumber="000-042" />, { container: main.appendChild(document.createElement('div')) })

    await user.click(screen.getByRole('button', { name: 'qr_open' }))
    expect(main).toHaveAttribute('inert')
    await user.click(screen.getByRole('button', { name: 'qr_close' }))
    expect(main).not.toHaveAttribute('inert')
  })

  it('does not restart Lenis when it was already stopped before opening', async () => {
    const user = userEvent.setup()
    lenis.isStopped = true
    render(<CardQrOverlay matrix={matrix} memberNumber="000-042" />)
    await user.click(screen.getByRole('button', { name: 'qr_open' }))
    await user.click(screen.getByRole('button', { name: 'qr_close' }))
    expect(lenis.stop).not.toHaveBeenCalled()
    expect(lenis.start).not.toHaveBeenCalled()
  })

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
