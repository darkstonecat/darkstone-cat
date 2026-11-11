import { describe, it, expect } from 'vitest'
import { collaboratorLogo, toBenefitViews } from '@/lib/benefits/view'

const outlet = {
  id: 'b1',
  name: { ca: 'Outlet Games', es: 'Outlet Games ES' },
  description: { ca: 'Descompte amb el codi de soci.', en: 'Discount with the member code.' },
  discount_code: 'DARKSTONE',
  url: 'https://outletgames.es',
  collaborator_id: 'outlet-games',
  sort_order: 10,
}

describe('collaboratorLogo', () => {
  it('returns the logo of a known collaborator', () => {
    expect(collaboratorLogo('outlet-games')).toEqual({
      src: '/images/logos/collaborators/botigues/logo_outlet_games.webp',
      name: 'Outlet Games',
      background: '#000000',
      invert: false,
    })
  })

  it('returns null for an unknown, empty or removed collaborator', () => {
    expect(collaboratorLogo('trollcave')).toBeNull()
    expect(collaboratorLogo(null)).toBeNull()
    expect(collaboratorLogo('')).toBeNull()
  })
})

describe('toBenefitViews', () => {
  it('localizes texts with the Catalan fallback and resolves the logo', () => {
    expect(toBenefitViews([outlet], 'en')).toEqual([
      {
        id: 'b1',
        name: 'Outlet Games',
        description: 'Discount with the member code.',
        code: 'DARKSTONE',
        url: 'https://outletgames.es',
        logo: collaboratorLogo('outlet-games'),
      },
    ])
    expect(toBenefitViews([outlet], 'es')[0]).toMatchObject({
      name: 'Outlet Games ES',
      description: 'Descompte amb el codi de soci.',
    })
  })

  it('keeps a benefit without code or logo', () => {
    const [view] = toBenefitViews([{ ...outlet, discount_code: null, collaborator_id: 'unknown-shop' }], 'ca')
    expect(view.code).toBeNull()
    expect(view.logo).toBeNull()
  })

  it('sorts by sort_order and drops rows without id, Catalan name or an https link', () => {
    const rows = [
      { ...outlet, id: 'late', sort_order: 30 },
      { ...outlet, id: 'early', sort_order: 5 },
      { ...outlet, id: '' },
      { ...outlet, id: 'noname', name: { es: 'Solo' } },
      { ...outlet, id: 'http', url: 'http://outletgames.es' },
      { ...outlet, id: 'script', url: 'javascript:alert(1)' },
      null,
      'row',
    ]
    expect(toBenefitViews(rows, 'ca').map((b) => b.id)).toEqual(['early', 'late'])
  })

  it('returns an empty list for no rows', () => {
    expect(toBenefitViews(null, 'ca')).toEqual([])
    expect(toBenefitViews(undefined, 'ca')).toEqual([])
  })
})
