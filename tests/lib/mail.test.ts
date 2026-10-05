import { beforeEach, describe, expect, it, vi } from 'vitest'

// The shared SMTP module (src/lib/mail). nodemailer is mocked: the transport is created once at
// import, so its options are kept outside the mock resets.
const mockSend = vi.hoisted(() => vi.fn())
const transportOptions = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: unknown) => {
      transportOptions.value = options
      return { sendMail: mockSend }
    },
  },
}))

import { escapeHtml, sendMail, SENDER_EMAIL, CONTACT_EMAIL } from '@/lib/mail'

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockResolvedValue({ messageId: 'msg-1' })
  vi.restoreAllMocks()
})

describe('transport', () => {
  it('uses Google Workspace SMTP over TLS with connection, greeting and socket timeouts', () => {
    expect(transportOptions.value).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 15_000,
    })
  })

  it('exposes the sender and contact addresses', () => {
    expect(SENDER_EMAIL).toBe('no-reply@darkstone.cat')
    expect(CONTACT_EMAIL).toBe('hola@darkstone.cat')
  })
})

describe('sendMail', () => {
  it('sends from no-reply with the association name by default, text and html', async () => {
    const result = await sendMail(
      { to: 'laia@example.com', subject: 'Hola', text: 'Text', html: '<p>Text</p>' },
      { logTag: 'test-mail' }
    )
    expect(result).toEqual({ ok: true })
    expect(mockSend).toHaveBeenCalledOnce()
    expect(mockSend.mock.calls[0][0]).toEqual({
      from: '"Darkstone Catalunya" <no-reply@darkstone.cat>',
      to: 'laia@example.com',
      subject: 'Hola',
      text: 'Text',
      html: '<p>Text</p>',
    })
  })

  it('passes a custom sender name and replyTo, and leaves out absent fields', async () => {
    await sendMail(
      { to: 'hola@darkstone.cat', subject: 'S', html: '<p>H</p>', replyTo: 'x@example.com', fromName: 'Web [darkstone.cat]' },
      { logTag: 'test-mail' }
    )
    const message = mockSend.mock.calls[0][0]
    expect(message).toEqual({
      from: '"Web [darkstone.cat]" <no-reply@darkstone.cat>',
      to: 'hola@darkstone.cat',
      replyTo: 'x@example.com',
      subject: 'S',
      html: '<p>H</p>',
    })
    expect(Object.hasOwn(message, 'text')).toBe(false)
  })

  it('never throws on an SMTP failure: logs only code, responseCode and command', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSend.mockRejectedValueOnce(
      Object.assign(new Error('535 bad credentials for secret@darkstone.cat'), {
        code: 'EAUTH',
        responseCode: 535,
        command: 'AUTH PLAIN',
        response: '535 5.7.8 secret transcript',
        envelope: { to: ['laia@example.com'] },
      })
    )
    const result = await sendMail(
      { to: 'laia@example.com', subject: 'Motiu privat', text: 'Cos privat' },
      { logTag: 'test-mail' }
    )
    expect(result).toEqual({ ok: false, code: 'EAUTH' })
    expect(error).toHaveBeenCalledOnce()
    expect(error.mock.calls[0]).toEqual([
      '[test-mail] SMTP error',
      { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' },
    ])
    const logged = JSON.stringify(error.mock.calls)
    for (const secret of ['secret', 'laia@example.com', 'Motiu privat', 'Cos privat']) {
      expect(logged).not.toContain(secret)
    }
  })

  it('reports a failure without a code (e.g. a thrown string) as code null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSend.mockRejectedValueOnce('boom')
    expect(await sendMail({ to: 'a@example.com', subject: 'S', text: 'T' }, { logTag: 't' })).toEqual({
      ok: false,
      code: null,
    })
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;')
  })
})
