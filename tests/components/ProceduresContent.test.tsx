import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import ProceduresContent from '@/components/admin/procedures/ProceduresContent'
import { PROCEDURES } from '@/components/admin/procedures/procedures'

describe('ProceduresContent (V-8)', () => {
  it('renders one article per procedure with its anchor and a heading', () => {
    render(<ProceduresContent />)
    expect(PROCEDURES).toHaveLength(7)
    for (let n = 1; n <= 7; n++) {
      const article = document.getElementById(`p-${n}`)
      expect(article).not.toBeNull()
      expect(article!.tagName).toBe('ARTICLE')
      const heading = within(article!).getByRole('heading', { level: 2, name: `p${n}.title` })
      expect(article).toHaveAttribute('aria-labelledby', heading.id)
    }
  })

  it('has an index nav that links every anchor', () => {
    render(<ProceduresContent />)
    const nav = screen.getByRole('navigation', { name: 'index_aria' })
    for (let n = 1; n <= 7; n++) {
      expect(within(nav).getByRole('link', { name: new RegExp(`P-${n}`) })).toHaveAttribute('href', `#p-${n}`)
    }
  })

  it('renders every step as a real ordered list item, with nested items, legal refs and the BCC warning', () => {
    render(<ProceduresContent />)
    const p7 = document.getElementById('p-7')!
    expect(within(p7).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
    expect(within(p7).getByText('p7.s1_a')).toBeInTheDocument()
    expect(within(p7).getByText('p7.s1_b')).toBeInTheDocument()
    expect(within(p7).getByText('p7.s3').closest('[data-kind="warning"]')).not.toBeNull()
    expect(within(document.getElementById('p-2')!).getByText(/p2\.s2_legal/)).toBeInTheDocument()
    expect(within(document.getElementById('p-6')!).getByText('p6.s1_a')).toBeInTheDocument()
  })

  it('links each procedure action to the Socis view, former members pre-filtered for P-1 and P-4', () => {
    render(<ProceduresContent />)
    const href = (n: number) =>
      within(document.getElementById(`p-${n}`)!).getByRole('link', { name: `p${n}.action` }).getAttribute('href')
    expect(href(1)).toBe('/admin/members?state=former')
    expect(href(4)).toBe('/admin/members?state=former')
    expect(href(2)).toBe('/admin/members')
    expect(href(7)).toBe('/admin/members')
  })
})
