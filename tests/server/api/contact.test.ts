import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.hoisted(() => vi.fn())
// The transport is created once at import, so keep its options outside mock resets.
const transportOptions = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: unknown) => {
      transportOptions.value = options
      return { sendMail: mockSend }
    },
  },
}))

const rpc = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc }),
}))

import { POST } from '@/app/api/contact/route'

/** The shared limiter is unavailable by default, so these tests exercise the in-memory fallback. */
function rpcUnavailable() {
  rpc.mockReturnValue({
    abortSignal: () => Promise.resolve({ data: null, error: { code: 'TEST' } }),
  })
}

let ipSeq = 100

const validBody = {
  name: 'Test User',
  email: 'test@example.com',
  subject: 'Test Subject',
  message: 'Test message content',
  website: '',
  elapsedMs: 10_000,
}

function makeRequest(
  body: Record<string, unknown> | string,
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
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockSend.mockResolvedValue({ messageId: 'msg-1' })
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    rpc.mockReset()
    rpcUnavailable()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('configures SMTP timeouts on the transport', () => {
    expect(transportOptions.value).toMatchObject({
      connectionTimeout: expect.any(Number),
      greetingTimeout: expect.any(Number),
      socketTimeout: expect.any(Number),
    })
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

    it('accepts all allowed origins outside production', async () => {
      for (const origin of [
        'https://darkstone.cat',
        'https://www.darkstone.cat',
        'http://localhost:3000',
      ]) {
        const res = await POST(makeRequest(validBody, { origin }))
        expect(res.status).toBe(200)
      }
    })

    it('rejects the localhost origin in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const res = await POST(
        makeRequest(validBody, { origin: 'http://localhost:3000' })
      )
      expect(res.status).toBe(403)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('keeps the real origins working in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(200)
    })

    it('allows localhost in production only with CONTACT_ALLOW_LOCALHOST=1', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CONTACT_ALLOW_LOCALHOST', '1')
      const res = await POST(
        makeRequest(validBody, { origin: 'http://localhost:3000' })
      )
      expect(res.status).toBe(200)
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

  describe('input hardening', () => {
    it.each([
      ['not JSON', 'not json{'],
      ['empty body', ''],
      ['null', 'null'],
      ['an array', '[1,2]'],
      ['a string', '"hello"'],
    ])('rejects %s → 400 invalid_request', async (_label, raw) => {
      const res = await POST(makeRequest(raw))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalid_request' })
      expect(mockSend).not.toHaveBeenCalled()
    })

    it.each([
      ['name', 'x'.repeat(101), 'name_too_long'],
      ['email', `${'a'.repeat(250)}@b.co`, 'email_too_long'],
      ['subject', 'x'.repeat(151), 'subject_too_long'],
      ['message', 'x'.repeat(5_001), 'message_too_long'],
    ])('rejects an oversized %s → 400', async (field, value, code) => {
      const res = await POST(makeRequest({ ...validBody, [field]: value }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: code })
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('accepts fields exactly at the limits (measured after trim)', async () => {
      const res = await POST(
        makeRequest({
          ...validBody,
          name: ` ${'n'.repeat(100)} `,
          subject: 's'.repeat(150),
          message: `${'m'.repeat(5_000)}  `,
        })
      )
      expect(res.status).toBe(200)
    })

    it('rejects an oversized declared Content-Length → 413 without reading it', async () => {
      const res = await POST(
        makeRequest(validBody, { 'content-length': String(64 * 1024) })
      )
      expect(res.status).toBe(413)
      expect(await res.json()).toEqual({ error: 'payload_too_large' })
    })

    it('rejects an oversized body without Content-Length → 413', async () => {
      const res = await POST(
        makeRequest({ ...validBody, message: 'x'.repeat(40_000) })
      )
      expect(res.status).toBe(413)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('treats non-string fields as missing', async () => {
      const res = await POST(makeRequest({ ...validBody, name: { a: 1 } }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'name_required' })
    })
  })

  describe('bot traps', () => {
    it('drops a filled honeypot silently: 200, same shape, no email', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const res = await POST(makeRequest({ ...validBody, website: 'http://spam.example' }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true })
      expect(mockSend).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[contact] dropped: honeypot')
    })

    it('drops a too-fast submission silently: 200, no email', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const res = await POST(makeRequest({ ...validBody, elapsedMs: 500 }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true })
      expect(mockSend).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[contact] dropped: too_fast')
    })

    it.each([[undefined], ['5000'], [Number.NaN], [-1]])(
      'drops a missing or invalid elapsedMs (%s)',
      async (elapsedMs) => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const res = await POST(makeRequest({ ...validBody, elapsedMs }))
        expect(res.status).toBe(200)
        expect(mockSend).not.toHaveBeenCalled()
      }
    )

    it('sends once the fill time reaches the minimum', async () => {
      const res = await POST(makeRequest({ ...validBody, elapsedMs: 3_000 }))
      expect(res.status).toBe(200)
      expect(mockSend).toHaveBeenCalledOnce()
    })

    it('dropped requests do not consume rate-limit slots', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const ip = '98.98.98.98'
      for (let i = 0; i < 10; i++) {
        await POST(
          makeRequest({ ...validBody, website: 'bot' }, { 'x-forwarded-for': ip })
        )
      }
      const res = await POST(makeRequest(validBody, { 'x-forwarded-for': ip }))
      expect(res.status).toBe(200)
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

    it('logs only code, responseCode and command of an SMTP error', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockSend.mockRejectedValueOnce(
        Object.assign(new Error('535 bad credentials for secret@darkstone.cat'), {
          code: 'EAUTH',
          responseCode: 535,
          command: 'AUTH PLAIN',
          response: '535 5.7.8 secret transcript',
          envelope: { to: ['hola@darkstone.cat'] },
        })
      )
      await POST(makeRequest(validBody))
      expect(error).toHaveBeenCalledOnce()
      expect(error.mock.calls[0]).toEqual([
        '[contact] SMTP error',
        { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' },
      ])
      expect(JSON.stringify(error.mock.calls)).not.toContain('secret')
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

    it('does not consume a slot for invalid requests', async () => {
      const ip = '97.97.97.97'
      const headers = { 'x-forwarded-for': ip }
      for (let i = 0; i < 10; i++) {
        const bad = await POST(makeRequest({ ...validBody, name: '' }, headers))
        expect(bad.status).toBe(400)
      }
      for (let i = 0; i < 5; i++) {
        const res = await POST(makeRequest(validBody, headers))
        expect(res.status).toBe(200)
      }
      expect((await POST(makeRequest(validBody, headers))).status).toBe(429)
    })

    it('prefers x-real-ip over a spoofable x-forwarded-for', async () => {
      const headers = { 'x-real-ip': '96.96.96.96' }
      for (let i = 0; i < 5; i++) {
        const res = await POST(
          makeRequest(validBody, { ...headers, 'x-forwarded-for': `spoof-${i}` })
        )
        expect(res.status).toBe(200)
      }
      const res = await POST(
        makeRequest(validBody, { ...headers, 'x-forwarded-for': 'spoof-new' })
      )
      expect(res.status).toBe(429)
    })
  })

  describe('shared rate limiter', () => {
    function rpcDecides(decide: (bucket: string) => boolean) {
      rpc.mockImplementation((_fn: string, args: { p_bucket: string }) => ({
        abortSignal: () => Promise.resolve({ data: decide(args.p_bucket), error: null }),
      }))
    }

    it('checks a hashed per-IP bucket (5/hour) and a global bucket (50/day)', async () => {
      rpcDecides(() => true)
      const ip = '55.55.55.55'
      const res = await POST(makeRequest(validBody, { 'x-forwarded-for': ip }))
      expect(res.status).toBe(200)
      expect(rpc).toHaveBeenCalledTimes(2)
      const [perIp, global] = rpc.mock.calls.map((c) => c[1])
      expect(perIp.p_bucket).toMatch(/^contact:[0-9a-f]{64}$/)
      expect(JSON.stringify(perIp)).not.toContain(ip)
      expect(perIp).toMatchObject({ p_max: 5, p_window_seconds: 3600 })
      expect(global).toEqual({ p_bucket: 'contact:global', p_max: 50, p_window_seconds: 86_400 })
    })

    it('answers 429 when the per-IP bucket is full, before the global one', async () => {
      rpcDecides((bucket) => bucket === 'contact:global')
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ error: 'rate_limited' })
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('answers 429 when the global daily cap is reached', async () => {
      rpcDecides((bucket) => bucket !== 'contact:global')
      const res = await POST(makeRequest(validBody))
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ error: 'rate_limited' })
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('does not touch the database for invalid or dropped requests', async () => {
      rpcDecides(() => true)
      await POST(makeRequest({ ...validBody, name: '' }))
      await POST(makeRequest({ ...validBody, website: 'bot' }))
      await POST(makeRequest('nope'))
      expect(rpc).not.toHaveBeenCalled()
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
