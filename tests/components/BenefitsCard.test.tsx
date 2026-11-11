import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, v?: Record<string, string>) =>
    v ? `${key}:${Object.values(v).join(',')}` : key
  ),
}))
vi.mock('next/image', () => ({
  // eslint-disable-next-line jsx-a11y/alt-text
  default: ({ fill: _fill, quality: _quality, ...props }: any) => <img {...props} />,
}))

import BenefitsCard from '@/components/profile/BenefitsCard'
import type { BenefitView } from '@/lib/benefits/view'

const outlet: BenefitView = {
  id: 'b1',
  name: 'Outlet Games',
  description: 'Descompte amb el codi de soci.',
  code: 'DARKSTONE',
  url: 'https://outletgames.es',
  logo: { src: '/logo.webp', name: 'Outlet Games', background: '#000000', invert: false },
}

describe('BenefitsCard', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
  })
  afterEach(() => vi.useRealTimers())

  it('renders nothing without benefits', () => {
    const { container } = render(<BenefitsCard benefits={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows logo, name, description, code and a shop link that opens in a new tab', () => {
    render(<BenefitsCard benefits={[outlet]} />)
    const card = screen.getByRole('region', { name: 'benefits_title' })
    const item = within(card).getByRole('listitem')

    expect(within(item).getByRole('heading', { level: 3, name: 'Outlet Games' })).toBeInTheDocument()
    expect(within(item).getByText('Descompte amb el codi de soci.')).toBeInTheDocument()
    expect(within(item).getByText('DARKSTONE')).toBeInTheDocument()
    expect(within(item).getByRole('img', { name: 'Outlet Games' })).toHaveAttribute('src', '/logo.webp')

    const link = within(item).getByRole('link', { name: /benefits_visit:Outlet Games/ })
    expect(link).toHaveAttribute('href', 'https://outletgames.es')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('hides the code row and the logo when a benefit has neither', () => {
    render(<BenefitsCard benefits={[{ ...outlet, code: null, logo: null }]} />)
    expect(screen.queryByText('benefits_code_label')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('copies the code and announces it, then resets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<BenefitsCard benefits={[outlet]} />)
    fireEvent.click(screen.getByRole('button', { name: 'benefits_copy_label:Outlet Games' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('benefits_copied'))
    expect(writeText).toHaveBeenCalledWith('DARKSTONE')

    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('tells the member to copy by hand when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<BenefitsCard benefits={[outlet]} />)
    fireEvent.click(screen.getByRole('button', { name: 'benefits_copy_label:Outlet Games' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('benefits_copy_failed'))
  })
})
