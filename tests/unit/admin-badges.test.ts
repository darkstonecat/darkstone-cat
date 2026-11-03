import { describe, expect, it } from 'vitest'
import {
  BADGE_BULK_MAX,
  BADGE_NAME_MAX,
  BADGE_TEXT_MAX,
  isBadgeKey,
  parseBadgeNote,
  parseBadgePatch,
  parseLocalizedText,
  parseMemberIds,
  parseNewBadge,
  suggestBadgeKey,
  toBadgeHolders,
} from '@/lib/admin/badges'

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('suggestBadgeKey (S7.4)', () => {
  it.each([
    ['Voluntariat Egara Juga', 'voluntariat_egara_juga'],
    ['Col·laborador de la fira', 'collaborador_de_la_fira'],
    ['Col.laborador', 'collaborador'],
    ['Coŀlaboradora', 'collaboradora'],
    ['Àvia Ñandú, cançó!', 'avia_nandu_canco'],
    ['  --Fira   2026--  ', 'fira_2026'],
    ['2026 Fira', 'fira'],
    ['___', ''],
    ['', ''],
    ['😀', ''],
  ])('%s → %s', (name, key) => {
    expect(suggestBadgeKey(name)).toBe(key)
  })

  it('cuts to 48 characters without a trailing underscore', () => {
    const key = suggestBadgeKey(`${'a'.repeat(47)} b`)
    expect(key).toBe('a'.repeat(47))
    expect(suggestBadgeKey('x'.repeat(80))).toHaveLength(48)
  })

  it('is safe for anything that is not a string', () => {
    expect(suggestBadgeKey(undefined as unknown as string)).toBe('')
    expect(suggestBadgeKey(42 as unknown as string)).toBe('')
  })

  it('suggests keys the database accepts', () => {
    for (const name of ['Voluntariat Egara Juga', 'Col·laborador de la fira', 'x'.repeat(80)]) {
      expect(isBadgeKey(suggestBadgeKey(name))).toBe(true)
    }
  })
})

describe('isBadgeKey', () => {
  it('accepts the database pattern and refuses the reserved tenure keys', () => {
    for (const key of ['abc', 'fira_2026', 'a'.repeat(48), 'ludoteca_donor']) expect(isBadgeKey(key)).toBe(true)
    for (const key of ['ab', '1abc', '_abc', 'Abc', 'a-b-c', 'a'.repeat(49), 'member_tenure', 'member_year', '', null, 3]) {
      expect(isBadgeKey(key)).toBe(false)
    }
  })
})

describe('parseNewBadge (S7.4)', () => {
  const input = { key: 'fira_2026', name: ' Fira 2026 ', earnedText: ' Hi eres. ', lockedText: 'Vine a la fira.' }

  it('trims the Catalan texts', () => {
    expect(parseNewBadge(input)).toEqual({
      ok: true,
      value: { key: 'fira_2026', name: 'Fira 2026', earnedText: 'Hi eres.', lockedText: 'Vine a la fira.' },
    })
  })

  it.each([
    ['key', { key: 'Fira' }],
    ['key', { key: 'member_tenure' }],
    ['name', { name: '   ' }],
    ['name', { name: 'x'.repeat(BADGE_NAME_MAX + 1) }],
    ['earnedText', { earnedText: 'x'.repeat(BADGE_TEXT_MAX + 1) }],
    ['lockedText', { lockedText: 7 }],
  ])('names the invalid field (%s)', (field, over) => {
    expect(parseNewBadge({ ...input, ...over })).toEqual({ ok: false, field })
  })

  it('counts characters, not UTF-16 units, against the limits', () => {
    expect(parseNewBadge({ ...input, name: '🎲'.repeat(BADGE_NAME_MAX) }).ok).toBe(true)
  })

  it('refuses something that is not an object', () => {
    expect(parseNewBadge(null)).toEqual({ ok: false, field: null })
    expect(parseNewBadge([])).toEqual({ ok: false, field: null })
  })
})

describe('parseLocalizedText', () => {
  it('trims, keeps ca, and drops a blank es or en', () => {
    expect(parseLocalizedText({ ca: ' Hola ', es: '  ', en: ' Hi ' }, 60)).toEqual({ ca: 'Hola', en: 'Hi' })
  })

  it('refuses a missing ca, an unknown language, a non-string or an overlong text', () => {
    for (const value of [{ es: 'Hola' }, { ca: 'a', fr: 'b' }, { ca: 1 }, { ca: 'a', es: 2 }, { ca: 'x'.repeat(61) }, 'Hola', null, ['a']]) {
      expect(parseLocalizedText(value, 60)).toBeNull()
    }
  })
})

describe('parseBadgePatch (S7.3)', () => {
  it('maps the UI fields to the database patch', () => {
    expect(
      parseBadgePatch({
        name: { ca: 'Nom', es: 'Nombre' },
        earnedText: { ca: 'La tens.' },
        lockedText: { ca: 'Encara no.' },
        icon: 'dice',
        sortOrder: -20,
        showLocked: false,
      })
    ).toEqual({
      ok: true,
      value: {
        name: { ca: 'Nom', es: 'Nombre' },
        earned_text: { ca: 'La tens.' },
        locked_text: { ca: 'Encara no.' },
        icon: 'dice',
        sort_order: -20,
        show_locked: false,
      },
    })
  })

  it('sends only the fields present', () => {
    expect(parseBadgePatch({ icon: 'star', name: undefined })).toEqual({ ok: true, value: { icon: 'star' } })
  })

  it.each([
    ['name', { name: { es: 'Sense català' } }],
    ['earnedText', { earnedText: { ca: 'x'.repeat(201) } }],
    ['icon', { icon: 'rocket' }],
    ['sortOrder', { sortOrder: 1.5 }],
    ['sortOrder', { sortOrder: 1_000_000 }],
    ['showLocked', { showLocked: 'yes' }],
    ['key', { key: 'other' }],
  ])('names the invalid field (%s)', (field, patch) => {
    expect(parseBadgePatch(patch)).toEqual({ ok: false, field })
  })

  it('refuses an empty patch or something that is not an object', () => {
    expect(parseBadgePatch({})).toEqual({ ok: false, field: null })
    expect(parseBadgePatch(null)).toEqual({ ok: false, field: null })
  })
})

describe('parseMemberIds (S7.5)', () => {
  it('lower-cases and de-duplicates UUIDs', () => {
    expect(parseMemberIds([UUID(1), UUID(1).toUpperCase(), UUID(2)])).toEqual([UUID(1), UUID(2)])
  })

  it(`accepts 1 to ${BADGE_BULK_MAX} ids and nothing else`, () => {
    expect(parseMemberIds(Array.from({ length: BADGE_BULK_MAX }, (_, i) => UUID(i)))).toHaveLength(BADGE_BULK_MAX)
    expect(parseMemberIds(Array.from({ length: BADGE_BULK_MAX + 1 }, (_, i) => UUID(i)))).toBeNull()
    for (const value of [[], [UUID(1), 'nope'], 'nope', null, [42]]) expect(parseMemberIds(value)).toBeNull()
  })
})

describe('parseBadgeNote', () => {
  it('trims, turns blank into null and caps at 500 characters', () => {
    expect(parseBadgeNote('  Fira 2026 ')).toEqual({ ok: true, value: 'Fira 2026' })
    expect(parseBadgeNote('   ')).toEqual({ ok: true, value: null })
    expect(parseBadgeNote(undefined)).toEqual({ ok: true, value: null })
    expect(parseBadgeNote('x'.repeat(500))).toEqual({ ok: true, value: 'x'.repeat(500) })
    expect(parseBadgeNote('x'.repeat(501))).toEqual({ ok: false })
    expect(parseBadgeNote(5)).toEqual({ ok: false })
  })
})

describe('toBadgeHolders', () => {
  it('maps admin_list_badge_holders rows and drops unusable ones', () => {
    expect(
      toBadgeHolders([
        { member_id: UUID(1), member_number: '000-001', first_name: 'Laia', last_name: 'Serra', state: 'active', awarded_at: '2026-03-01T10:00:00+00:00' },
        { member_id: UUID(2), member_number: '000-002', first_name: 'Pau', last_name: 'Ferrer', state: 'former', awarded_at: '2026-01-01T10:00:00+00:00' },
        { member_id: UUID(3), member_number: '000-003', state: 'unknown' },
        null,
      ])
    ).toEqual([
      { memberId: UUID(1), memberNumber: '000-001', firstName: 'Laia', lastName: 'Serra', state: 'active', awardedAt: '2026-03-01T10:00:00+00:00' },
      { memberId: UUID(2), memberNumber: '000-002', firstName: 'Pau', lastName: 'Ferrer', state: 'former', awardedAt: '2026-01-01T10:00:00+00:00' },
    ])
    expect(toBadgeHolders(null)).toEqual([])
  })
})
