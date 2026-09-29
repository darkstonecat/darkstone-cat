import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useLocale } from 'next-intl'
import { usePathname } from '@/i18n/routing'

vi.mock('next-intl', () => ({
  useLocale: vi.fn(() => 'ca'),
}))

// Keep the real getPathname so the hrefs follow the actual routing config
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  usePathname: vi.fn(() => '/about'),
}))

import LanguageSwitcher from '@/components/LanguageSwitcher'

describe('LanguageSwitcher', () => {
  it('renders all three locale links', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByText('CAT')).toBeInTheDocument()
    expect(screen.getByText('ESP')).toBeInTheDocument()
    expect(screen.getByText('ENG')).toBeInTheDocument()
  })

  it('marks current locale with aria-current="page"', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByText('CAT')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('ESP')).not.toHaveAttribute('aria-current')
    expect(screen.getByText('ENG')).not.toHaveAttribute('aria-current')
  })

  it('links to the canonical URL of each locale (no /ca prefix)', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole('link', { name: /Switch to CAT/i })).toHaveAttribute('href', '/about')
    expect(screen.getByRole('link', { name: /Switch to ESP/i })).toHaveAttribute('href', '/es/about')
    expect(screen.getByRole('link', { name: /Switch to ENG/i })).toHaveAttribute('href', '/en/about')
  })

  it('keeps the same hrefs when rendered from another locale', () => {
    vi.mocked(useLocale).mockReturnValueOnce('es')
    vi.mocked(usePathname).mockReturnValueOnce('/')
    render(<LanguageSwitcher />)
    expect(screen.getByRole('link', { name: /Switch to CAT/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /Switch to ESP/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Switch to ENG/i })).toHaveAttribute('href', '/en')
  })

  it('sets hrefLang on each link', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole('link', { name: /Switch to ESP/i })).toHaveAttribute('hreflang', 'es')
  })
})
