import { describe, it, expect } from 'vitest'
import { safeRedirectPath, DEFAULT_REDIRECT } from '@/lib/safe-redirect'

const ORIGIN = 'https://www.darkstone.cat'

describe('safeRedirectPath', () => {
  it.each([
    ['/profile', '/profile'],
    ['/es/profile/card?x=1#top', '/es/profile/card?x=1#top'],
    ['/a/../profile', '/profile'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
    ['/.%5C/evil.com', '/.%5C/evil.com'],
    ['/ñandú/café', '/%C3%B1and%C3%BA/caf%C3%A9'],
  ])('accepts %s', (input, expected) => {
    expect(safeRedirectPath(input, ORIGIN)).toBe(expected)
  })

  it.each([
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['absolute URL', 'https://evil.com/x'],
    ['absolute same-origin URL', `${ORIGIN}/profile`],
    ['protocol-relative', '//evil.com'],
    ['dot segment //', '/.//evil.com'],
    ['double dot //', '/..//evil.com'],
    ['nested dot //', '/a/..//evil.com'],
    ['dot segment with query', '/.//evil.com?x=1'],
    ['backslash', '/\\evil.com'],
    ['slash backslash', '/\\/evil.com'],
    ['tab', '/\t/evil.com'],
    ['newline', '/\n/evil.com'],
    ['carriage return', '/\r//evil.com'],
    ['null byte', '/\u0000evil.com'],
    ['DEL', '/\u007fevil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['no leading slash', 'evil.com'],
    ['unicode slash lookalike', '∕∕evil.com'],
    ['leading space', ' //evil.com'],
  ])('rejects %s', (_name, input) => {
    expect(safeRedirectPath(input, ORIGIN)).toBe(DEFAULT_REDIRECT)
  })

  it('uses the given fallback', () => {
    expect(safeRedirectPath('//evil.com', ORIGIN, '/es/profile')).toBe('/es/profile')
  })

  it('never returns a path that starts with // or /\\', () => {
    for (const v of ['/.//a', '/..//a', '/a/..//a', '/./\\a']) {
      const out = safeRedirectPath(v, ORIGIN)
      expect(out.startsWith('//')).toBe(false)
      expect(out.startsWith('/\\')).toBe(false)
    }
  })
})
