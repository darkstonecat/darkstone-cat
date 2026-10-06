import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ refreshCaches: vi.fn(), refresh: vi.fn() }))

vi.mock('next-intl', () => ({
  useLocale: () => 'ca',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock('@/lib/admin/ops-actions', () => ({ refreshCaches: mocks.refreshCaches }))

import ToolsContent from '@/components/admin/tools/ToolsContent'
import type { OpsJobStatus } from '@/lib/admin/ops-status'

const NOW = new Date('2026-10-06T10:00:00Z')
const base: OpsJobStatus = {
  job: 'ludoya',
  lastRunAt: null,
  lastOk: null,
  lastAutomatic: null,
  lastActorName: null,
  lastActorNumber: null,
  lastDurationMs: null,
  lastErrorCode: null,
  lastSuccessAt: null,
}
const jobs: OpsJobStatus[] = [
  { ...base, job: 'ludoya', lastRunAt: '2026-10-06T04:00:00Z', lastOk: true, lastAutomatic: true, lastDurationMs: 2100, lastSuccessAt: '2026-10-06T04:00:00Z' },
  {
    ...base,
    job: 'bgg',
    lastRunAt: '2026-10-05T16:00:00Z',
    lastOk: false,
    lastAutomatic: false,
    lastActorName: 'Marta Puig',
    lastActorNumber: '000-001',
    lastDurationMs: 30000,
    lastErrorCode: 'timeout',
    lastSuccessAt: '2026-10-05T04:00:00Z',
  },
]

const row = (name: string) => screen.getByText(`job_${name}`).closest('li') as HTMLElement

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ToolsContent statuses', () => {
  it('links to the event images tool', () => {
    render(<ToolsContent jobs={jobs} now={NOW} />)
    expect(screen.getByRole('link', { name: /events_open/ })).toHaveAttribute('href', '/admin/tools/event-images')
  })

  it('shows an automatic success with chip, who and duration', () => {
    render(<ToolsContent jobs={jobs} now={NOW} />)
    const li = row('ludoya')
    expect(within(li).getByText('run_ok')).toBeInTheDocument()
    expect(li.textContent).toContain('run_automatic')
    expect(li.textContent).toContain('duration:{"seconds":"2,1"}')
    expect(li.textContent).not.toContain('error_code')
  })

  it('shows a manual failure with the actor, the short code and the last success', () => {
    render(<ToolsContent jobs={jobs} now={NOW} />)
    const li = row('bgg')
    expect(within(li).getByText('run_failed')).toBeInTheDocument()
    expect(li.textContent).toContain('Marta Puig')
    expect(li.textContent).toContain('error_code:{"code":"timeout"}')
    expect(li.textContent).toContain('last_success')
  })

  it('says so when a job never ran or the status failed to load', () => {
    const { rerender } = render(<ToolsContent jobs={[base, { ...base, job: 'bgg' }]} now={NOW} />)
    expect(screen.getAllByText('never_run')).toHaveLength(2)
    rerender(<ToolsContent jobs={null} now={NOW} />)
    expect(screen.getByRole('alert')).toHaveTextContent('status_error')
    expect(screen.getAllByText('status_unavailable')).toHaveLength(2)
  })
})

describe('ToolsContent refresh', () => {
  it('disables every button while busy, then shows the per-job results and refreshes the page', async () => {
    let resolve!: (v: unknown) => void
    mocks.refreshCaches.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<ToolsContent jobs={jobs} now={NOW} />)

    fireEvent.click(within(row('ludoya')).getByRole('button'))
    expect(mocks.refreshCaches).toHaveBeenCalledWith('ludoya')
    await waitFor(() => expect(within(row('ludoya')).getByRole('button')).toHaveTextContent('refreshing'))
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()

    resolve({
      ok: true,
      results: [
        { job: 'ludoya', ok: true, durationMs: 1500, errorCode: null },
        { job: 'bgg', ok: false, durationMs: 900, errorCode: 'timeout' },
      ],
    })
    await screen.findByText('result_title')
    expect(screen.getByText('result_ok:{"job":"job_ludoya","seconds":"1,5"}')).toBeInTheDocument()
    expect(screen.getByText('result_failed:{"job":"job_bgg","code":"timeout"}')).toBeInTheDocument()
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    for (const button of screen.getAllByRole('button')) expect(button).toBeEnabled()
  })

  it('the global button refreshes everything', async () => {
    mocks.refreshCaches.mockResolvedValue({ ok: true, results: [] })
    render(<ToolsContent jobs={jobs} now={NOW} />)
    fireEvent.click(screen.getByRole('button', { name: 'refresh_all' }))
    await waitFor(() => expect(mocks.refreshCaches).toHaveBeenCalledWith('all'))
  })

  it('shows the rate limit message and does not refresh the page', async () => {
    mocks.refreshCaches.mockResolvedValue({ error: 'rate_limited' })
    render(<ToolsContent jobs={jobs} now={NOW} />)
    fireEvent.click(within(row('bgg')).getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent('error_rate_limited')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('shows a generic message when the action throws', async () => {
    mocks.refreshCaches.mockRejectedValue(new Error('boom'))
    render(<ToolsContent jobs={jobs} now={NOW} />)
    fireEvent.click(within(row('bgg')).getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent('error_generic')
  })
})
