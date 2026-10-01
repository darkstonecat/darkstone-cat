import { describe, it, expect } from 'vitest'
import { escapeCsv } from '@/lib/csv'

describe('escapeCsv', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsv('Laia')).toBe('Laia')
    expect(escapeCsv('000-034')).toBe('000-034')
    expect(escapeCsv('2026-01-01')).toBe('2026-01-01')
    expect(escapeCsv('')).toBe('')
  })

  it('prefixes formula triggers with an apostrophe', () => {
    expect(escapeCsv('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)")
    expect(escapeCsv('-2+3')).toBe("'-2+3")
    expect(escapeCsv('+cmd|calc')).toBe("'+cmd|calc")
    expect(escapeCsv('\tfoo')).toBe("'\tfoo")
  })

  it('prefixes and quotes when the payload also needs quoting', () => {
    expect(escapeCsv('=HYPERLINK("http://evil.test","x")')).toBe(
      `"'=HYPERLINK(""http://evil.test"",""x"")"`
    )
    expect(escapeCsv('\r=1+1')).toBe(`"'\r=1+1"`)
  })

  it('keeps plain phone numbers untouched', () => {
    expect(escapeCsv('+34 600 123 456')).toBe('+34 600 123 456')
    expect(escapeCsv('+34600123456')).toBe('+34600123456')
    expect(escapeCsv('600123456')).toBe('600123456')
  })

  it('still neutralises a phone-looking value with formula characters', () => {
    expect(escapeCsv('+34 600+1')).toBe("'+34 600+1")
    expect(escapeCsv('-34 600 123')).toBe("'-34 600 123")
  })

  it('quotes values with commas, quotes and line breaks', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"')
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsv('a\nb')).toBe('"a\nb"')
    expect(escapeCsv('a\r\nb')).toBe('"a\r\nb"')
    expect(escapeCsv('a\rb')).toBe('"a\rb"')
  })
})
