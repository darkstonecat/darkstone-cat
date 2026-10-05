import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import ExportConfirmDialog from '@/components/admin/ExportConfirmDialog'

// T9b: the member CSV route is POST only (GET answers 405) with a same-origin Origin header,
// which the browser adds to a same-origin POST by itself.
describe('ExportConfirmDialog', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:csv')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs an empty JSON filter to the export route and downloads the file', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('﻿Número', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="darkstone_members_2026-10-05.csv"' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()

    render(<ExportConfirmDialog open onClose={onClose} />)
    fireEvent.click(screen.getByText('export_confirm'))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/members/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  })

  it('shows the error text when the route refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"forbidden_origin"}', { status: 403 })))
    const onClose = vi.fn()

    render(<ExportConfirmDialog open onClose={onClose} />)
    fireEvent.click(screen.getByText('export_confirm'))

    expect(await screen.findByText('export_error')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
