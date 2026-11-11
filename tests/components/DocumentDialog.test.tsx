import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'

// Like Next.js, useSearchParams follows history.pushState / replaceState / back.
const LOCATION_EVENT = 'test:locationchange'
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history)
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args)
    window.dispatchEvent(new Event(LOCATION_EVENT))
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener(LOCATION_EVENT, onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener(LOCATION_EVENT, onChange)
    window.removeEventListener('popstate', onChange)
  }
}
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
}))

const url = () => window.location.pathname + window.location.search + window.location.hash

// Keys come back as "<namespace>.<key>"; a rich `link` tag renders around the key.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t: any = (key: string) => `${namespace}.${key}`
    t.rich = (key: string, tags: Record<string, (chunks: string) => unknown>) =>
      tags.link ? tags.link(`${namespace}.${key}`) : `${namespace}.${key}`
    return t
  },
}))

const lenis = { stop: vi.fn(), start: vi.fn(), isStopped: false }
vi.mock('@/components/SmoothScroll', () => ({ useLenis: () => lenis }))

import DocumentProvider from '@/components/documents/DocumentProvider'
import DocumentLink from '@/components/documents/DocumentLink'

function renderPage() {
  return render(
    <main id="main-content">
      <DocumentLink doc="conduct">Pautes</DocumentLink>
      <DocumentLink doc="data-protection">Dades</DocumentLink>
    </main>,
    { wrapper: ({ children }) => <DocumentProvider>{children}</DocumentProvider> },
  )
}

describe('document dialog', () => {
  beforeEach(() => {
    lenis.stop.mockClear()
    lenis.start.mockClear()
    window.history.replaceState(null, '', '/about')
  })
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders real links to ?doc= so a new tab or a crawler still reaches the document', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Pautes' })).toHaveAttribute('href', '?doc=conduct')
    expect(screen.getByRole('link', { name: 'Dades' })).toHaveAttribute('href', '?doc=data-protection')
  })

  it('opens the conduct document over the current page and locks the page behind it', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Pautes' }))

    const dialog = await screen.findByRole('dialog', { name: 'conduct.title' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('conduct.intro')
    expect(screen.getByText('conduct.safe_space_title')).toBeInTheDocument()
    expect(screen.getByText('conduct.open_tables_text')).toBeInTheDocument()
    // The protocol paragraph keeps its external link.
    expect(screen.getByRole('link', { name: 'conduct.safe_space_protocol' })).toHaveAttribute('target', '_blank')
    expect(document.getElementById('main-content')).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
    expect(lenis.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'documents.close' })).toHaveFocus()
    // The open document is a history entry on the same page, so Back closes it.
    expect(url()).toBe('/about?doc=conduct')
  })

  it('opens the data protection document with its last update line', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Dades' }))

    const dialog = await screen.findByRole('dialog', { name: 'data_protection.title' })
    expect(dialog).toHaveAccessibleDescription('data_protection.last_updated')
    expect(screen.getByText('data_protection.rights_title')).toBeInTheDocument()
  })

  it('closes with Escape, unlocks the page and returns focus to the link', async () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'Pautes' })
    link.focus()
    fireEvent.click(link)
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.getElementById('main-content')).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('')
    expect(lenis.start).toHaveBeenCalled()
    expect(link).toHaveFocus()
    // Closing went back to the entry before the open.
    expect(url()).toBe('/about')
  })

  it('returns focus to the link even when the click did not focus it (Safari)', async () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'Dades' })
    fireEvent.click(link)
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(link).toHaveFocus()
  })

  it('closes when the browser goes back, staying on the page', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Pautes' }))
    await screen.findByRole('dialog')

    window.history.back()

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(url()).toBe('/about')
    expect(document.getElementById('main-content')).not.toHaveAttribute('inert')
  })

  it('keeps the other query params and the hash when it opens and closes', async () => {
    window.history.replaceState(null, '', '/ludoteca?q=catan#top')
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Pautes' }))
    await screen.findByRole('dialog')
    expect(url()).toBe('/ludoteca?q=catan&doc=conduct#top')

    fireEvent.click(screen.getByRole('button', { name: 'documents.close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(url()).toBe('/ludoteca?q=catan#top')
  })

  it('closes with the close button and with a click on the backdrop', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Pautes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'documents.close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('link', { name: 'Dades' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByTestId('document-dialog-backdrop'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps Tab inside the dialog', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('link', { name: 'Pautes' }))
    const close = await screen.findByRole('button', { name: 'documents.close' })
    const region = screen.getByRole('region', { name: 'conduct.title' })
    const protocol = screen.getByRole('link', { name: 'conduct.safe_space_protocol' })

    protocol.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(protocol).toHaveFocus()
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('lets a modified click open the link normally (new tab)', () => {
    renderPage()
    expect(clickIsLeftToBrowser(screen.getByRole('link', { name: 'Pautes' }), { ctrlKey: true })).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(url()).toBe('/about')
  })

  it('opens from ?doc= and removes only that param from the URL on close', async () => {
    window.history.replaceState(null, '', '/ludoteca?q=catan&doc=data-protection#top')
    renderPage()

    expect(await screen.findByRole('dialog', { name: 'data_protection.title' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'documents.close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(url()).toBe('/ludoteca?q=catan#top')
  })

  it('ignores an unknown ?doc= value', () => {
    window.history.replaceState(null, '', '/about?doc=privacy')
    renderPage()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('falls back to a plain link outside the provider', () => {
    render(<DocumentLink doc="conduct">Pautes</DocumentLink>)
    expect(clickIsLeftToBrowser(screen.getByRole('link', { name: 'Pautes' }))).toBe(true)
  })
})

/** Clicks `link` and reports whether the component let the browser follow it (then cancels it, as jsdom cannot navigate). */
function clickIsLeftToBrowser(link: HTMLElement, init: MouseEventInit = {}) {
  let leftToBrowser = false
  const record = (event: Event) => {
    leftToBrowser = !event.defaultPrevented
    event.preventDefault()
  }
  window.addEventListener('click', record)
  link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }))
  window.removeEventListener('click', record)
  return leftToBrowser
}
