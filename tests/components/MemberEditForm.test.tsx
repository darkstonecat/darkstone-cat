import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
const updateMember = vi.fn()
vi.mock('@/lib/admin/member-actions', () => ({ updateMember: (...a: unknown[]) => updateMember(...a), revealSensitive: vi.fn() }))

import MemberEditForm from '@/components/admin/member-file/MemberEditForm'

const member = {
  id: 'id-1',
  email: 'laia@example.com',
  first_name: 'Laia',
  last_name: 'Serra',
  postal_code: '08224',
  ludoya_username: 'laiaserra',
  bgg_username: null,
  has_dni: true,
  has_phone: true,
}

function setup() {
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  render(<MemberEditForm member={member} onSaved={onSaved} onCancel={onCancel} />)
  return { onSaved, onCancel }
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } })

beforeEach(() => updateMember.mockReset())

describe('MemberEditForm (A-4)', () => {
  it('starts with DNI and phone empty and sends neither when untouched', async () => {
    updateMember.mockResolvedValue({ changed: ['first_name'] })
    const { onSaved } = setup()
    expect(screen.getByLabelText('phone')).toHaveValue('')
    expect(screen.getByLabelText('dni')).toHaveValue('')
    expect(screen.getByLabelText('email')).toBeDisabled()

    type('first_name', '  Laura ')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(['first_name']))
    const input = updateMember.mock.calls[0][1]
    expect(updateMember.mock.calls[0][0]).toBe('id-1')
    expect(input).toEqual({
      first_name: 'Laura',
      last_name: 'Serra',
      postal_code: '08224',
      ludoya_username: 'laiaserra',
      bgg_username: '',
    })
    expect('dni' in input).toBe(false)
    expect('phone' in input).toBe(false)
  })

  it('sends DNI and phone only when typed', async () => {
    updateMember.mockResolvedValue({ changed: ['dni'] })
    setup()
    type('dni', '12345678Z')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(updateMember).toHaveBeenCalled())
    const input = updateMember.mock.calls[0][1]
    expect(input.dni).toBe('12345678Z')
    expect('phone' in input).toBe(false)
  })

  it('shows field messages for invalid values and does not call the server', async () => {
    setup()
    type('first_name', '')
    type('phone', 'abc')
    type('dni', '123')
    type('postal_code', '08A24')
    type('ludoya', '!!!')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(await screen.findByText('error_name')).toBeInTheDocument()
    for (const key of ['phone', 'dni', 'postal_code', 'username']) {
      expect(screen.getByText(`error_${key}`)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('dni')).toHaveAttribute('aria-invalid', 'true')
    expect(updateMember).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid_name', 'error_name'],
    ['invalid_phone', 'error_phone'],
    ['invalid_dni', 'error_dni'],
    ['invalid_postal_code', 'error_postal_code'],
    ['invalid_username', 'error_username'],
  ])('maps the server code %s to its field message', async (code, text) => {
    updateMember.mockResolvedValue({ error: code })
    const { onSaved } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it.each(['forbidden', 'not_active', 'failed', 'something_new'])('maps %s to a form-level message', async (code) => {
    updateMember.mockResolvedValue({ error: code })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    const expected = code === 'something_new' ? 'failed' : code
    expect(await screen.findByRole('alert')).toHaveTextContent(expected)
  })

  it('cancel calls onCancel without saving', () => {
    const { onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(updateMember).not.toHaveBeenCalled()
  })
})
