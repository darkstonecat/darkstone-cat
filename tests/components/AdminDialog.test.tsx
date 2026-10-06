import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'

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

const lenis = { stop: vi.fn(), start: vi.fn(), isStopped: false }
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => lenis }))

import AdminDialog from '@/components/admin/AdminDialog'

function Harness(props: Partial<React.ComponentProps<typeof AdminDialog>> & { withReason?: boolean }) {
  const { withReason, ...rest } = props
  const [reason, setReason] = useState('')
  return (
    <>
      <button>trigger</button>
      <AdminDialog
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Dona de baixa"
        confirmLabel="Confirma"
        reason={withReason ? { label: 'Motiu', value: reason, onChange: setReason, minLength: 5 } : undefined}
        {...rest}
      >
        <p>body</p>
      </AdminDialog>
    </>
  )
}

describe('AdminDialog', () => {
  it('is a modal dialog labelled by its title and described by its target line', () => {
    render(<Harness target="Soci 000-203 · Laia Serra" />)
    const dialog = screen.getByRole('dialog', { name: 'Dona de baixa' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const describedBy = dialog.getAttribute('aria-describedby')!
    expect(document.getElementById(describedBy)).toHaveTextContent('Soci 000-203 · Laia Serra')
  })

  it('renders nothing when closed', () => {
    render(<Harness open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape and on the close button, but not while busy', () => {
    const onClose = vi.fn()
    const { rerender } = render(<Harness onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'dialog_close' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    onClose.mockClear()
    rerender(<Harness onClose={onClose} busy />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'dialog_close' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'dialog_cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirma' })).toBeDisabled()
  })

  it('closes on a backdrop click only when idle', () => {
    const onClose = vi.fn()
    const { rerender } = render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByTestId('admin-dialog-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    onClose.mockClear()
    rerender(<Harness onClose={onClose} busy />)
    fireEvent.click(screen.getByTestId('admin-dialog-backdrop'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('moves focus into the dialog and traps Tab at both ends', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)

    const close = screen.getByRole('button', { name: 'dialog_close' })
    const confirm = screen.getByRole('button', { name: 'Confirma' })

    confirm.focus()
    fireEvent.keyDown(confirm, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    close.focus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('returns focus to the trigger when it closes', () => {
    function Wrapper() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <AdminDialog open={open} onClose={() => setOpen(false)} onConfirm={() => {}} title="T" confirmLabel="Ok">
            x
          </AdminDialog>
        </>
      )
    }
    render(<Wrapper />)
    const trigger = screen.getByRole('button', { name: 'open' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    return vi.waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('shows the reason slot with the no-personal-data hint and keeps confirm disabled until valid', () => {
    render(<Harness withReason />)
    expect(screen.getByText('dialog_reason_hint')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirma' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/dialog_reason_min/)).toBeInTheDocument()

    const box = screen.getByLabelText(/Motiu/)
    fireEvent.change(box, { target: { value: '   abc ' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(box, { target: { value: 'Compte duplicat' } })
    expect(confirm).toBeEnabled()
    expect(screen.queryByText(/dialog_reason_min/)).not.toBeInTheDocument()
  })

  it('explains a disabled confirm with a visible reason linked by aria-describedby', () => {
    render(<Harness confirmDisabled confirmDisabledReason="Escriu 000-154" />)
    const confirm = screen.getByRole('button', { name: 'Confirma' })
    expect(confirm).toBeDisabled()
    const id = confirm.getAttribute('aria-describedby')!
    expect(document.getElementById(id)).toHaveTextContent('Escriu 000-154')
  })

  it('calls onConfirm and uses the danger style for the destructive variant', () => {
    const onConfirm = vi.fn()
    render(<Harness variant="danger" onConfirm={onConfirm} />)
    const confirm = screen.getByRole('button', { name: 'Confirma' })
    expect(confirm.className).toMatch(/bg-brand-red/)
    fireEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('links the procedure and shows the superadmin chip and the error', () => {
    render(<Harness procedure="P-2" superadminOnly error="Ha fallat" />)
    expect(screen.getByRole('link', { name: /P-2/ })).toHaveAttribute('href', '/admin/procedures#p-2')
    expect(screen.getByText('chip_superadmin_only')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Ha fallat')
  })
  it('locks body scroll and makes #main-content inert while open, then restores both', () => {
    const main = document.createElement('main')
    main.id = 'main-content'
    document.body.appendChild(main)
    document.body.style.overflow = 'auto'
    const { unmount } = render(<Harness />)
    expect(document.body.style.overflow).toBe('hidden')
    expect(main).toHaveAttribute('inert')
    // Portalled to <body>, outside the inert region, and Lenis leaves its scroll alone.
    const dialog = screen.getByRole('dialog')
    expect(main.contains(dialog)).toBe(false)
    expect(dialog).toHaveAttribute('data-lenis-prevent')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(main).not.toHaveAttribute('inert')
    main.remove()
    document.body.style.overflow = ''
  })

  it('moves focus to the panel when busy turns true', () => {
    const { rerender } = render(<Harness />)
    const confirm = screen.getByRole('button', { name: 'Confirma' })
    confirm.focus()
    expect(document.activeElement).toBe(confirm)
    rerender(<Harness busy />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })
})

describe('AdminDialog smooth scroll', () => {
  beforeEach(() => {
    lenis.stop.mockClear()
    lenis.start.mockClear()
    lenis.isStopped = false
  })

  it('stops Lenis while open and restarts it on close', () => {
    const { unmount } = render(<Harness />)
    expect(lenis.stop).toHaveBeenCalledTimes(1)
    expect(lenis.start).not.toHaveBeenCalled()
    unmount()
    expect(lenis.start).toHaveBeenCalledTimes(1)
  })

  it('leaves Lenis alone when something else already stopped it', () => {
    lenis.isStopped = true
    const { unmount } = render(<Harness />)
    unmount()
    expect(lenis.stop).not.toHaveBeenCalled()
    expect(lenis.start).not.toHaveBeenCalled()
  })
})

describe('AdminDialog releases the page as soon as it starts closing', () => {
  beforeEach(() => {
    lenis.stop.mockClear()
    lenis.start.mockClear()
    lenis.isStopped = false
  })

  function Toggle({ second }: { second?: boolean }) {
    const [open, setOpen] = useState(false)
    const [openB, setOpenB] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        <button onClick={() => setOpen(false)}>shut</button>
        <button onClick={() => setOpenB(true)}>openB</button>
        <button onClick={() => setOpen(false)}>swap-close-a</button>
        <AdminDialog open={open} onClose={() => setOpen(false)} onConfirm={() => {}} title="A" confirmLabel="Ok">
          a
        </AdminDialog>
        {second && (
          <AdminDialog open={openB} onClose={() => setOpenB(false)} onConfirm={() => {}} title="B" confirmLabel="Ok">
            b
          </AdminDialog>
        )}
      </>
    )
  }

  function setup() {
    const main = document.createElement('main')
    main.id = 'main-content'
    document.body.appendChild(main)
    document.body.style.overflow = 'auto'
    return {
      main,
      cleanup: () => {
        main.remove()
        document.body.style.overflow = ''
      },
    }
  }

  it('un-inerts the page, unlocks scroll and restarts Lenis before the exit animation ends', () => {
    const { main, cleanup } = setup()
    render(<Toggle />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(main).toHaveAttribute('inert')
    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))
    // Synchronously after the close: the exiting panel may still be mounted, the page must not be locked.
    expect(main).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('auto')
    expect(lenis.start).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('makes the exiting panel and backdrop unclickable and unfocusable', () => {
    const { cleanup } = setup()
    render(<Toggle />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))
    const backdrop = screen.queryByTestId('admin-dialog-backdrop')
    // Either already gone or exiting with pointer events off.
    if (backdrop) {
      expect(backdrop.className).toMatch(/pointer-events-none/)
      expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('inert')
    }
    cleanup()
  })

  it('returns focus to the trigger right when it starts closing', () => {
    const { cleanup } = setup()
    render(<Toggle />)
    const trigger = screen.getByRole('button', { name: 'open' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'dialog_cancel' }))
    expect(document.activeElement).toBe(trigger)
    cleanup()
  })

  it('keeps the page inert for a dialog that opens while another one is closing', () => {
    const { main, cleanup } = setup()
    render(<Toggle second />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    // B opens on top of A, then A closes while B stays open.
    fireEvent.click(screen.getByRole('button', { name: 'openB' }))
    expect(main).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'swap-close-a' }))
    expect(main).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
    // Closing the last one restores the original overflow.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(main).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('auto')
    expect(lenis.stop).toHaveBeenCalledTimes(1)
    expect(lenis.start).toHaveBeenCalledTimes(1)
    cleanup()
  })
})
