import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

import EmailsExportDialog from '@/components/admin/members/EmailsExportDialog'
import RegisterExportDialog from '@/components/admin/members/RegisterExportDialog'

const csvResponse = (name: string) =>
  new Response('﻿Nom', { status: 200, headers: { 'Content-Disposition': `attachment; filename="${name}"` } })
const errorResponse = (status: number, error?: string) =>
  new Response(JSON.stringify(error ? { error } : {}), { status })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('EmailsExportDialog (A-16)', () => {
  it('keeps both outputs disabled until a list is chosen, and shows no address count', () => {
    render(<EmailsExportDialog open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'download' })).toBeDisabled()
    expect(screen.getByText('pick_list')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ (adreces|addresses)/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /P-7/ })).toHaveAttribute('href', '/admin/procedures#p-7')
  })

  it.each(['association', 'newsletter'])('POSTs format csv for %s and downloads the file', async (list) => {
    const fetchMock = vi.fn().mockResolvedValue(csvResponse(`darkstone_emails_${list}_2026-10-06.csv`))
    vi.stubGlobal('fetch', fetchMock)
    render(<EmailsExportDialog open onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(list) }))
    fireEvent.click(screen.getByRole('button', { name: 'download' }))

    await waitFor(() => expect(screen.getByText('downloaded')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/members/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list, format: 'csv' }),
    })
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('POSTs format json and copies the addresses separated by commas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ list: 'newsletter', count: 2, addresses: ['a@x.cat', 'b@x.cat'] }))
    vi.stubGlobal('fetch', fetchMock)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<EmailsExportDialog open onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('radio', { name: /newsletter/ }))
    fireEvent.click(screen.getByRole('button', { name: 'copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('a@x.cat, b@x.cat'))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ list: 'newsletter', format: 'json' })
    expect(await screen.findByText('copied:{"count":2}')).toBeInTheDocument()
  })

  it('reports a clipboard failure without a success notice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ addresses: ['a@x.cat'] })))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    render(<EmailsExportDialog open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /association/ }))
    fireEvent.click(screen.getByRole('button', { name: 'copy' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('copy_failed')
    expect(screen.queryByText(/^copied/)).not.toBeInTheDocument()
  })

  it.each([
    [403, 'forbidden_origin', 'forbidden_origin'],
    [401, undefined, 'unauthenticated'],
    [403, undefined, 'forbidden'],
    [500, undefined, 'failed'],
  ])('maps %s %s to the %s message', async (status, code, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(status, code)))
    render(<EmailsExportDialog open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /association/ }))
    fireEvent.click(screen.getByRole('button', { name: 'download' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('maps a network failure to the generic message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    render(<EmailsExportDialog open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /association/ }))
    fireEvent.click(screen.getByRole('button', { name: 'download' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('failed')
  })
})

describe('RegisterExportDialog (S-4)', () => {
  it('is a superadmin dialog and keeps the download disabled until the reason has 10 characters', () => {
    render(<RegisterExportDialog open onClose={vi.fn()} />)
    expect(screen.getByText('chip_superadmin_only')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'confirm' })
    expect(confirm).toBeDisabled()

    const reason = screen.getByRole('textbox')
    fireEvent.change(reason, { target: { value: '         short' } }) // 5 characters after trim
    expect(confirm).toBeDisabled()
    fireEvent.change(reason, { target: { value: 'Requeriment del registre' } })
    expect(confirm).toBeEnabled()
  })

  it('POSTs the trimmed reason and downloads the CSV', async () => {
    const fetchMock = vi.fn().mockResolvedValue(csvResponse('darkstone_llibre_socis_2026-10-06.csv'))
    vi.stubGlobal('fetch', fetchMock)
    render(<RegisterExportDialog open onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Requeriment del registre  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(screen.getByText('downloaded')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Requeriment del registre' }),
    })
  })

  it.each([
    [400, 'reason_required'],
    [400, 'reason_too_long'],
    [403, undefined],
  ])("shows the backend's %s %s error", async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse(status, code)))
    render(<RegisterExportDialog open onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Requeriment del registre' } })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(code ?? 'forbidden')
  })
})
