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

import MemberDataExport from '@/components/admin/member-file/MemberDataExport'

const jsonResponse = () =>
  new Response('{"email":"x"}', {
    status: 200,
    headers: { 'Content-Disposition': 'attachment; filename="darkstone-data-000-203.json"' },
  })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('MemberDataExport (A-11)', () => {
  it('active member: POSTs an empty body when no reason is typed, and downloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse())
    vi.stubGlobal('fetch', fetchMock)
    render(<MemberDataExport memberNumber="000-203" memberName="Laia Serra" former={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'button' }))
    expect(screen.queryByText('chip_superadmin_only')).not.toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'confirm' })
    expect(confirm).toBeEnabled() // the reason is optional here
    fireEvent.click(confirm)

    await waitFor(() => expect(screen.getByText('downloaded')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/members/000-203/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  })

  it('active member: sends the trimmed optional reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse())
    vi.stubGlobal('fetch', fetchMock)
    render(<MemberDataExport memberNumber="000-203" memberName="Laia Serra" former={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'button' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Petició d\'accés  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: "Petició d'accés" })
  })

  it('former member: superadmin chip, reason required (10+) before the download enables', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse())
    vi.stubGlobal('fetch', fetchMock)
    render(<MemberDataExport memberNumber="000-154" memberName="Albert Roca" former />)

    fireEvent.click(screen.getByRole('button', { name: 'button' }))
    expect(screen.getByText('chip_superadmin_only')).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'confirm' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Requeriment de l\'autoritat' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/members/000-154/data')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ reason: "Requeriment de l'autoritat" })
  })

  it.each([
    [400, 'reason_required', 'reason_required'],
    [400, 'reason_too_long', 'reason_too_long'],
    [403, 'forbidden_origin', 'forbidden_origin'],
    [403, undefined, 'forbidden'],
    [401, undefined, 'unauthenticated'],
    [404, 'not_found', 'failed'],
    [500, undefined, 'failed'],
  ])('maps %s %s to the %s message', async (status, code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(code ? { error: code } : {}), { status }))
    )
    render(<MemberDataExport memberNumber="000-203" memberName="Laia Serra" former={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'button' }))
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
