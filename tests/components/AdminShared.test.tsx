import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import StatusChip from '@/components/admin/StatusChip'
import Notice from '@/components/admin/Notice'
import ReasonButton from '@/components/admin/ReasonButton'

describe('StatusChip', () => {
  it('always carries the state as text and uses the mockup colours', () => {
    const { rerender } = render(<StatusChip kind="active" />)
    expect(screen.getByText('chip_active').className).toMatch(/bg-green-100/)
    rerender(<StatusChip kind="board" />)
    expect(screen.getByText('chip_board').className).toMatch(/text-brand-orange-text/)
    rerender(<StatusChip kind="superadmin" />)
    expect(screen.getByText('chip_superadmin').className).toMatch(/bg-stone-custom/)
    rerender(<StatusChip kind="left" />)
    expect(screen.getByText('chip_left')).toBeInTheDocument()
  })

  it('accepts a custom label (e.g. "Baixa des de 5/10/2026") and a dark surface', () => {
    render(<StatusChip kind="active" onDark label="Actiu ara" />)
    expect(screen.getByText('Actiu ara').className).toMatch(/text-green-300/)
  })
})

describe('Notice', () => {
  it('renders info, warning and blocked with the right role', () => {
    const { rerender } = render(<Notice kind="info">hello</Notice>)
    expect(screen.getByText('hello').closest('[data-kind]')).toHaveAttribute('data-kind', 'info')
    rerender(<Notice kind="warning">careful</Notice>)
    expect(screen.getByText('careful').closest('[data-kind]')!.className).toMatch(/bg-amber-100/)
    rerender(<Notice kind="blocked">no</Notice>)
    expect(screen.getByRole('alert')).toHaveTextContent('no')
  })
})

describe('ReasonButton', () => {
  it('is disabled and shows a visible reason linked by aria-describedby', () => {
    render(<ReasonButton disabled reason="Cal un altre superadmin">Treu el rol</ReasonButton>)
    const btn = screen.getByRole('button', { name: 'Treu el rol' })
    expect(btn).toBeDisabled()
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)).toHaveTextContent(
      'Cal un altre superadmin'
    )
  })

  it('shows no reason text when enabled', () => {
    render(<ReasonButton disabled={false} reason="x">Go</ReasonButton>)
    expect(screen.getByRole('button', { name: 'Go' })).toBeEnabled()
    expect(screen.queryByText('x')).not.toBeInTheDocument()
  })
})
