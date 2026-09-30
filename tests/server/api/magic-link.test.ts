import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifyOtp = vi.hoisted(() => vi.fn())
const mockSetAll = vi.hoisted(() => ({ fn: null as null | ((c: unknown[]) => void) }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (c: unknown[]) => void } }) => {
    mockSetAll.fn = opts.cookies.setAll
    return { auth: { verifyOtp: mockVerifyOtp } }
  },
}))

import { GET } from '@/app/auth/magic-link/route'

const ORIGIN = 'https://www.darkstone.cat'

function call(query: string) {
  return GET(new NextRequest(`${ORIGIN}/auth/magic-link${query}`))
}

describe('GET /auth/magic-link', () => {
  beforeEach(() => {
    mockVerifyOtp.mockReset()
    mockVerifyOtp.mockImplementation(async () => {
      mockSetAll.fn?.([{ name: 'sb-session', value: 'tok', options: { path: '/' } }])
      return { error: null }
    })
  })

  it('verifies the token, keeps the session cookies and redirects to /profile', async () => {
    const res = await call('?token_hash=abc&type=email')
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/profile`)
    expect(res.cookies.get('sb-session')?.value).toBe('tok')
  })

  it('honours a safe relative redirect', async () => {
    const res = await call('?token_hash=abc&type=email&redirect=%2Fes%2Fprofile%2Fcard%3Fx%3D1')
    expect(res.headers.get('location')).toBe(`${ORIGIN}/es/profile/card?x=1`)
  })

  it.each([
    ['absolute URL', 'https://evil.com/x'],
    ['protocol-relative', '//evil.com'],
    ['backslash', '/\\evil.com'],
    ['encoded backslash trick', '/\\/evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['no leading slash', 'evil.com'],
    ['control character', '/\t/evil.com'],
    ['empty', ''],
  ])('falls back to /profile for %s', async (_name, value) => {
    const res = await call(`?token_hash=abc&type=email&redirect=${encodeURIComponent(value)}`)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/profile`)
  })

  it('redirects to /login?magic=error when the token is missing', async () => {
    const res = await call('?type=email')
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?magic=error`)
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('redirects to /login?magic=error when the type is missing or not email', async () => {
    for (const q of ['?token_hash=abc', '?token_hash=abc&type=recovery']) {
      const res = await call(q)
      expect(res.headers.get('location')).toBe(`${ORIGIN}/login?magic=error`)
    }
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('redirects to /login?magic=error when verification fails, without cookies', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    const res = await call('?token_hash=bad&type=email&redirect=/about')
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?magic=error`)
    expect(res.cookies.get('sb-session')).toBeUndefined()
  })
})
