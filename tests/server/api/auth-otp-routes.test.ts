import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyOtp = vi.hoisted(() => vi.fn())

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { verifyOtp: mockVerifyOtp } }),
}))

import { GET as callback } from '@/app/auth/callback/route'
import { GET as confirm } from '@/app/auth/confirm/route'

const ORIGIN = 'https://www.darkstone.cat'
const req = (path: string, query: string) => new NextRequest(`${ORIGIN}${path}${query}`)

describe('GET /auth/callback (recovery)', () => {
  beforeEach(() => {
    mockVerifyOtp.mockReset()
    mockVerifyOtp.mockResolvedValue({ error: null })
  })

  it('accepts only type=recovery and redirects to /reset-password', async () => {
    const res = await callback(req('/auth/callback', '?token_hash=abc&type=recovery'))
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' })
    expect(res.headers.get('location')).toBe(`${ORIGIN}/reset-password`)
  })

  it.each(['email', 'signup', 'magiclink', 'invite', 'email_change', 'bogus', ''])(
    'rejects type=%s without calling verifyOtp',
    async (type) => {
      const res = await callback(req('/auth/callback', `?token_hash=abc&type=${type}`))
      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(res.headers.get('location')).toBe(`${ORIGIN}/login?recovery=error`)
    }
  )

  it('rejects a missing token or type', async () => {
    for (const q of ['', '?type=recovery', '?token_hash=abc']) {
      const res = await callback(req('/auth/callback', q))
      expect(res.headers.get('location')).toBe(`${ORIGIN}/login?recovery=error`)
    }
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('redirects to the error page when verification fails', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'expired' } })
    const res = await callback(req('/auth/callback', '?token_hash=abc&type=recovery'))
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?recovery=error`)
  })
})

describe('GET /auth/confirm (sign-up and email-change confirmation)', () => {
  beforeEach(() => {
    mockVerifyOtp.mockReset()
    mockVerifyOtp.mockResolvedValue({ error: null })
  })

  it.each(['signup', 'email', 'email_change'])('accepts type=%s', async (type) => {
    const res = await confirm(req('/auth/confirm', `?token_hash=abc&type=${type}`))
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type })
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?confirmed=success`)
  })

  it.each(['recovery', 'magiclink', 'invite', 'bogus', ''])(
    'rejects type=%s without calling verifyOtp',
    async (type) => {
      const res = await confirm(req('/auth/confirm', `?token_hash=abc&type=${type}`))
      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(res.headers.get('location')).toBe(`${ORIGIN}/login?confirmed=error`)
    }
  )

  it('rejects a missing token or type', async () => {
    for (const q of ['', '?type=email', '?token_hash=abc']) {
      const res = await confirm(req('/auth/confirm', q))
      expect(res.headers.get('location')).toBe(`${ORIGIN}/login?confirmed=error`)
    }
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('redirects to the error page when verification fails', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'expired' } })
    const res = await confirm(req('/auth/confirm', '?token_hash=abc&type=email'))
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?confirmed=error`)
  })
})
