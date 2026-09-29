import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Filters } from '@/components/ludoteca/LudotecaClient'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}(${JSON.stringify(params)})`
    return key
  }),
}))

import FilterSidebar from '@/components/ludoteca/FilterSidebar'

const defaultFilters: Filters = {
  search: '',
  gameType: ['boardgame'],
  rankTypes: [],
  players: [],
  duration: [],
  weight: [],
  age: [],
  categories: [],
  mechanics: [],
}

function renderSidebar(overrides: Partial<Parameters<typeof FilterSidebar>[0]> = {}) {
  const onFiltersChange = vi.fn()
  const onReset = vi.fn()
  const onClose = vi.fn()
  const result = render(
    <FilterSidebar
      filters={defaultFilters}
      onFiltersChange={onFiltersChange}
      onReset={onReset}
      hasActiveFilters={false}
      totalResults={42}
      availableRankTypes={[]}
      availableCategories={[]}
      availableMechanics={[]}
      {...overrides}
    />
  )
  return { ...result, onFiltersChange, onReset, onClose }
}

describe('FilterSidebar', () => {
  it('renders search input', () => {
    renderSidebar()
    expect(
      screen.getByRole('textbox', { name: 'filter_search' })
    ).toBeInTheDocument()
  })

  it('renders game type chips', () => {
    renderSidebar()
    expect(screen.getByText('filter_type_base')).toBeInTheDocument()
    expect(screen.getByText('filter_type_expansion')).toBeInTheDocument()
  })

  it('renders player chips 1-11', () => {
    renderSidebar()
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument()
    }
    // 11+ shows translated label
    expect(screen.getByText('filter_players_more')).toBeInTheDocument()
  })

  it('calls onFiltersChange when player chip is toggled', async () => {
    const { onFiltersChange } = renderSidebar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '3' }))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      players: [3],
    })
  })

  it('updates search input on type', async () => {
    const { onFiltersChange } = renderSidebar()
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: 'filter_search' })
    await user.type(input, 'C')
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'C' })
    )
  })

  it('game type chip shows aria-pressed state', () => {
    renderSidebar()
    const baseBtn = screen.getByText('filter_type_base')
    expect(baseBtn).toHaveAttribute('aria-pressed', 'true')
    const expBtn = screen.getByText('filter_type_expansion')
    expect(expBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('reset button is disabled when no active filters', () => {
    renderSidebar()
    expect(screen.getByText('filter_clear')).toBeDisabled()
  })

  it('reset button is enabled when filters are active', () => {
    renderSidebar({ hasActiveFilters: true })
    expect(screen.getByText('filter_clear')).toBeEnabled()
  })

  it('calls onReset when reset button is clicked', async () => {
    const { onReset } = renderSidebar({ hasActiveFilters: true })
    const user = userEvent.setup()
    await user.click(screen.getByText('filter_clear'))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('shows mobile header with close button when isMobile', () => {
    const onClose = vi.fn()
    renderSidebar({ isMobile: true, onClose })
    expect(screen.getByText('filter_panel_title')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'modal_close' })
    ).toBeInTheDocument()
  })

  it('renders searchable multi-select for categories when available', () => {
    renderSidebar({ availableCategories: ['Strategy', 'Family'] })
    expect(screen.getByText('filter_categories_title')).toBeInTheDocument()
  })
})
