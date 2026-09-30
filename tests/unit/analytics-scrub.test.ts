import { describe, it, expect } from 'vitest'
import { isVerifyPath, scrubAnalyticsEvent, scrubVerifyUrl } from '@/lib/analytics-scrub'

const TOKEN = '0123456789abcdef0123456789abcdef'

describe('scrubVerifyUrl', () => {
  it('replaces the token in absolute URLs and paths, keeping the locale prefix', () => {
    expect(scrubVerifyUrl(`https://www.darkstone.cat/verify/${TOKEN}`)).toBe('https://www.darkstone.cat/verify/[token]')
    expect(scrubVerifyUrl(`https://www.darkstone.cat/es/verify/${TOKEN}?x=1#h`)).toBe(
      'https://www.darkstone.cat/es/verify/[token]?x=1#h'
    )
    expect(scrubVerifyUrl(`/en/verify/${TOKEN}`)).toBe('/en/verify/[token]')
    expect(scrubVerifyUrl('/verify/not-a-token')).toBe('/verify/[token]')
  })

  it('leaves other URLs untouched', () => {
    expect(scrubVerifyUrl('https://www.darkstone.cat/ludoteca?q=verify')).toBe('https://www.darkstone.cat/ludoteca?q=verify')
    expect(scrubVerifyUrl('/profile/card')).toBe('/profile/card')
  })
})

describe('scrubAnalyticsEvent', () => {
  it('scrubs url and route without mutating the input', () => {
    const event = { type: 'vital', url: `https://www.darkstone.cat/verify/${TOKEN}`, route: `/verify/${TOKEN}` }
    const out = scrubAnalyticsEvent(event)
    expect(out.url).toBe('https://www.darkstone.cat/verify/[token]')
    expect(out.route).toBe('/verify/[token]')
    expect(event.url).toContain(TOKEN)
  })

  it('works for events without route', () => {
    expect(scrubAnalyticsEvent({ type: 'pageview', url: `/verify/${TOKEN}` })).toEqual({ type: 'pageview', url: '/verify/[token]' })
  })
})

describe('isVerifyPath', () => {
  it('matches the verify page in every locale only', () => {
    expect(isVerifyPath(`/verify/${TOKEN}`)).toBe(true)
    expect(isVerifyPath(`/es/verify/${TOKEN}`)).toBe(true)
    expect(isVerifyPath('/verify')).toBe(true)
    expect(isVerifyPath('/about')).toBe(false)
    expect(isVerifyPath('/verifying')).toBe(false)
  })
})
