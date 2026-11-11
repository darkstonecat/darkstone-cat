import { describe, it, expect } from 'vitest'
import { BENEFIT_LOGOS, isBenefitId, parseBenefitInput } from '@/lib/admin/benefits'

const valid = {
  name: { ca: ' Outlet Games ', es: '', en: 'Outlet Games' },
  description: { ca: 'Descompte amb el codi.' },
  url: ' https://outletgames.es ',
  discountCode: ' DARKSTONE ',
  collaboratorId: 'outlet-games',
  sortOrder: 10,
}

describe('parseBenefitInput', () => {
  it('trims, drops blank languages and maps to the database columns', () => {
    expect(parseBenefitInput(valid)).toEqual({
      ok: true,
      value: {
        name: { ca: 'Outlet Games', en: 'Outlet Games' },
        description: { ca: 'Descompte amb el codi.' },
        url: 'https://outletgames.es',
        discount_code: 'DARKSTONE',
        collaborator_id: 'outlet-games',
        sort_order: 10,
      },
    })
  })

  it('stores an empty code or logo as null and leaves the order out when not given', () => {
    const { sortOrder: _sortOrder, ...rest } = valid
    const parsed = parseBenefitInput({ ...rest, discountCode: '  ', collaboratorId: '' })
    expect(parsed).toEqual({
      ok: true,
      value: expect.objectContaining({ discount_code: null, collaborator_id: null }),
    })
    expect(parsed.ok && 'sort_order' in parsed.value).toBe(false)
  })

  it.each([
    ['name', { name: { es: 'Sense català' } }],
    ['name', { name: { ca: 'x'.repeat(61) } }],
    ['description', { description: { ca: '' } }],
    ['description', { description: { ca: 'x'.repeat(201) } }],
    ['url', { url: 'http://outletgames.es' }],
    ['url', { url: 'https://outlet games.es' }],
    ['url', { url: 'javascript:alert(1)' }],
    ['url', { url: `https://x.es/${'x'.repeat(300)}` }],
    ['discountCode', { discountCode: 'AMB ESPAI' }],
    ['discountCode', { discountCode: 'x'.repeat(41) }],
    ['collaboratorId', { collaboratorId: 'trollcave' }],
    ['sortOrder', { sortOrder: 1.5 }],
    ['sortOrder', { sortOrder: 1_000_000 }],
  ])('refuses an invalid %s', (field, over) => {
    expect(parseBenefitInput({ ...valid, ...over })).toEqual({ ok: false, field })
  })

  it('refuses a non-object', () => {
    expect(parseBenefitInput(null)).toEqual({ ok: false, field: null })
    expect(parseBenefitInput('x')).toEqual({ ok: false, field: null })
  })
})

describe('BENEFIT_LOGOS', () => {
  it('offers every collaborator logo, Outlet Games included and Trollcave gone', () => {
    const ids = BENEFIT_LOGOS.map((logo) => logo.id)
    expect(ids).toContain('outlet-games')
    expect(ids).not.toContain('trollcave')
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('isBenefitId', () => {
  it('accepts UUIDs only', () => {
    expect(isBenefitId('6f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b')).toBe(true)
    expect(isBenefitId('outlet-games')).toBe(false)
    expect(isBenefitId(undefined)).toBe(false)
  })
})
