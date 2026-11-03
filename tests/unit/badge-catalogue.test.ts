import { describe, it, expect } from 'vitest'
import { BADGE_ICON_KEYS, isBadgeIconKey, localize, toCatalogueBadge } from '@/lib/badges/catalogue'

describe('localize', () => {
  const text = { ca: 'Donant de la ludoteca', es: 'Donante de la ludoteca' }

  it('picks the requested locale', () => {
    expect(localize(text, 'es')).toBe('Donante de la ludoteca')
    expect(localize(text, 'ca')).toBe('Donant de la ludoteca')
  })

  it('falls back to Catalan when the locale is missing, blank or unknown', () => {
    expect(localize(text, 'en')).toBe('Donant de la ludoteca')
    expect(localize({ ca: 'Nom', en: '  ' }, 'en')).toBe('Nom')
    expect(localize(text, 'fr')).toBe('Donant de la ludoteca')
  })

  it('returns an empty string for a missing or malformed text', () => {
    expect(localize(null, 'ca')).toBe('')
    expect(localize('Nom' as unknown, 'ca')).toBe('')
    expect(localize({ es: 'Solo' } as unknown, 'ca')).toBe('Solo')
  })
})

describe('BADGE_ICON_KEYS', () => {
  it('mirrors badge_icon_keys() of the database, in order', () => {
    expect(BADGE_ICON_KEYS).toEqual([
      'star', 'how_to_reg', 'gift', 'dice', 'puzzle', 'trophy', 'volunteer', 'groups',
      'school', 'celebration', 'book', 'medal', 'heart', 'handshake', 'brush', 'megaphone',
    ])
    expect(isBadgeIconKey('gift')).toBe(true)
    expect(isBadgeIconKey('rocket')).toBe(false)
  })
})

describe('toCatalogueBadge', () => {
  const row = {
    key: 'ludoteca_donor',
    name: { ca: 'Donant de la ludoteca' },
    earned_text: { ca: 'Ha donat un joc.' },
    locked_text: { ca: 'Dona un joc.' },
    icon: 'gift',
    sort_order: 20,
    show_locked: true,
  }

  it('keeps a well-formed row', () => {
    expect(toCatalogueBadge(row)).toEqual({
      key: 'ludoteca_donor',
      name: { ca: 'Donant de la ludoteca' },
      earnedText: { ca: 'Ha donat un joc.' },
      lockedText: { ca: 'Dona un joc.' },
      icon: 'gift',
      sortOrder: 20,
      showLocked: true,
    })
  })

  it('falls back to the star icon for an unknown icon and rejects rows without key or name', () => {
    expect(toCatalogueBadge({ ...row, icon: 'rocket' })?.icon).toBe('star')
    expect(toCatalogueBadge({ ...row, key: '' })).toBeNull()
    expect(toCatalogueBadge({ ...row, name: null })).toBeNull()
    expect(toCatalogueBadge(null)).toBeNull()
  })
})
