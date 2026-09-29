import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: mockSend }) },
}))

import { POST } from '@/app/api/contact/route'

let ipSeq = 100

const validBody = {
  name: 'Test User',
  email: 'test@example.com',
  subject: 'Test Subject',
  message: 'Test message content',
}

function makeRequest(
  body: Record<string, unknown>,
  overrides: Record<string, string> = {}
) {
  const ip = `10.${Math.floor(++ipSeq / 256)}.${ipSeq % 256}.1`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    origin: 'https://darkstone.cat',
    'x-forwarded-for': ip,
    ...overrides,
  }
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: 'msg-1' })
  })

  describe('CSRF protection', () => {
    it('rejects request without origin header → 403', async () => {
      const req = new Request('http://localhost:3000/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `10.${++ipSeq}.0.1`,
        },
        body: JSON.stringify(validBody),
      })
      const res = await POST(req)
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'forbidden' })
    })

    it('rejects disallowed origin → 403', async () => {
      const res = await POST(
        makeRequest(validBody, { origin: 'https://evil.com' })
      )
      expect(res.status).toBe(403)
    })

    it('accepts all allowed origins', async () => {
      for (const origin of [
        'https://darkstone.cat',
        'https://www.darkstone.cat',
        'http://localhost:3000',
      ]) {
        const res = await POST(makeRequest(validBody, { origin }))
        expect(res.status).toBe(200)
      }
    })
  })

  describe('validation', () => {
    it('rejects empty name → 400 name_required', async () => {
      const res = await POST(makeRequest({ ...validBody, name: '' }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'name_required' })
    })

    it('rejects missing name → 400', async () => {
      const { name: _, ...noName } = validBody
      const res = await POST(makeRequest(noName))
      expect(res.status).toBe(400)
    })

    it('rejects invalid email → 400 email_invalid', async () => {
      const res = await POST(
        makeRequest({ ...validBody, email: 'not-an-email' })
      )
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'email_invalid' })
    })

    it('accepts valid complex email', async () => {
      const res = await POST(
        makeRequest({ ...validBody, email: 'user+tag@sub.domain.co' })
      )
      expect(res.status).toBe(200)
    })

    it('rejects empty subject → 400 subject_required', async () => {
      const res = await POST(makeRequest({ ...validBody, subject: '' }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'subject_required' })
    })

    it('rejects empty message → 400 message_required', async () => {
      const res = await POST(makeRequest({ ...validBody, message: '' }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'message_required' })
    })
  })

  describe('email sending', () => {
    it('sends email via SMTP and returns success', async () => {
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true })
      expect(mockSend).toHaveBeenCalledOnce()
      expect(mockSend.mock.calls[0][0]).toMatchObject({
        from: '"Web [darkstone.cat]" <no-reply@darkstone.cat>',
        to: 'hola@darkstone.cat',
        replyTo: validBody.email,
        subject: `[Formulari Web] ${validBody.subject}`,
      })
    })

    it('returns 500 without SMTP details when sending fails', async () => {
      vi.spyOn(console, 'error').mockImplementationOnce(() => {})
      mockSend.mockRejectedValueOnce(new Error('535 bad credentials'))
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'send_failed' })
    })

    it('escapes HTML in email body (XSS prevention)', async () => {
      await POST(
        makeRequest({
          ...validBody,
          name: '<script>alert("xss")</script>',
        })
      )
      const html = mockSend.mock.calls[0][0].html as string
      expect(html).toContain('&lt;script&gt;')
      expect(html).not.toContain('<script>')
    })
  })

  describe('rate limiting', () => {
    it('blocks after 5 requests from the same IP', async () => {
      const ip = '99.99.99.99'
      for (let i = 0; i < 5; i++) {
        const res = await POST(
          makeRequest(validBody, { 'x-forwarded-for': ip })
        )
        expect(res.status).toBe(200)
      }
      const res = await POST(
        makeRequest(validBody, { 'x-forwarded-for': ip })
      )
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ error: 'rate_limited' })
    })
  })

  describe('response headers', () => {
    it('includes no-cache headers on all responses', async () => {
      const res = await POST(makeRequest(validBody))
      expect(res.headers.get('Cache-Control')).toBe(
        'no-store, no-cache, must-revalidate'
      )
    })
  })
})
