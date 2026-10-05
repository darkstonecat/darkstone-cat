import { describe, it, expect, afterEach, vi } from 'vitest'
import { isAllowedOrigin, SITE_ORIGINS } from '@/lib/http/origin'

// CSRF guard shared by the contact form and the admin exports: the browser's Origin header must
// be the site itself. localhost is accepted outside production only (or, for a caller that names
// an override variable, when that variable is "1").

describe('isAllowedOrigin', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('accepts the production origins in every environment', () => {
    for (const env of ['development', 'test', 'production']) {
      vi.stubEnv('NODE_ENV', env)
      for (const origin of SITE_ORIGINS) {
        expect(isAllowedOrigin(origin), `${env} ${origin}`).toBe(true)
        expect(isAllowedOrigin(origin, { localhostPorts: [3000] })).toBe(true)
      }
    }
  })

  it.each([
    null,
    undefined,
    '',
    'null',
    'https://evil.com',
    'https://darkstone.cat.evil.com',
    'https://evil.darkstone.cat',
    'http://darkstone.cat',
    'https://www.darkstone.cat/',
    'https://www.darkstone.cat:443',
    'https://darkstone-git-main.vercel.app',
  ])('refuses %j', (origin) => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isAllowedOrigin(origin)).toBe(false)
  })

  it('accepts localhost on any port outside production when no ports are given', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
    expect(isAllowedOrigin('http://localhost:3100')).toBe(true)
    for (const origin of ['https://localhost:3000', 'http://localhost', 'http://localhost:3000/', 'http://localhost.evil.com:3000', 'http://127.0.0.1:3000', 'http://localhost:123456']) {
      expect(isAllowedOrigin(origin), origin).toBe(false)
    }
  })

  it('accepts only the listed localhost ports when ports are given', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isAllowedOrigin('http://localhost:3000', { localhostPorts: [3000] })).toBe(true)
    expect(isAllowedOrigin('http://localhost:3100', { localhostPorts: [3000] })).toBe(false)
  })

  it('refuses localhost in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isAllowedOrigin('http://localhost:3000')).toBe(false)
    expect(isAllowedOrigin('http://localhost:3000', { localhostPorts: [3000], allowLocalhostEnv: 'CONTACT_ALLOW_LOCALHOST' })).toBe(false)
  })

  it('accepts localhost in production only when the named override variable is "1"', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CONTACT_ALLOW_LOCALHOST', '1')
    const contact = { localhostPorts: [3000], allowLocalhostEnv: 'CONTACT_ALLOW_LOCALHOST' }
    expect(isAllowedOrigin('http://localhost:3000', contact)).toBe(true)
    expect(isAllowedOrigin('http://localhost:3100', contact)).toBe(false)
    // a caller without an override variable ignores it
    expect(isAllowedOrigin('http://localhost:3000')).toBe(false)

    vi.stubEnv('CONTACT_ALLOW_LOCALHOST', 'true')
    expect(isAllowedOrigin('http://localhost:3000', contact)).toBe(false)
  })
})
