import { describe, expect, it } from 'vitest'
import { adminDbErrorCode, isMemberId } from '@/lib/admin/action-errors'

// Error shapes as supabase-js returns them for an RPC that raised: `code` is the SQLSTATE and
// `message` carries the `prefix:code: text` the T7/T7b/T8 functions raise.
const err = (message: string, code = '22023') => ({ code, message })

describe('adminDbErrorCode', () => {
  it.each([
    ['admin:forbidden: board role required', '42501', 'forbidden'],
    ["admin:forbidden: only a superadmin can reveal a former member's DNI", '42501', 'forbidden'],
    ['audit:forbidden: board role required', '42501', 'forbidden'],
    ['admin:not_found: unknown member', '22023', 'not_found'],
    ["admin:not_active: a former member's register is read-only", '22023', 'not_active'],
    ['admin:no_value: nothing stored for dni', '22023', 'no_value'],
    ["admin:reason_required: revealing a former member's DNI needs a reason", '22023', 'reason_required'],
    ['admin:reason_too_long: at most 500 characters', '22023', 'reason_too_long'],
    ['admin:badge_held: the member already holds this badge', '22023', 'badge_held'],
    ['admin:badge_not_held: the member does not hold this badge', '22023', 'badge_not_held'],
    ['admin:invalid_argument: unknown badge', '22023', 'invalid'],
    ['admin:invalid_argument: email cannot be edited', '22023', 'invalid'],
  ])('maps %s to %s', (message, code, expected) => {
    expect(adminDbErrorCode(err(message, code))).toBe(expected)
  })

  it.each([
    ['first_name', 'invalid_name'],
    ['last_name', 'invalid_name'],
    ['postal_code', 'invalid_postal_code'],
    ['ludoya_username', 'invalid_username'],
    ['bgg_username', 'invalid_username'],
    ['phone_encrypted', 'invalid_phone'],
    ['dni_nie_encrypted', 'invalid_dni'],
  ])('maps admin:invalid_value for %s to the profile edit code %s', (key, expected) => {
    expect(adminDbErrorCode(err(`admin:invalid_value: ${key} must have 1 to 100 characters`))).toBe(expected)
  })

  it('maps admin:invalid_value for an unknown key to invalid', () => {
    expect(adminDbErrorCode(err('admin:invalid_value: newsletter_accepted must be a string or null'))).toBe('invalid')
  })

  it('maps a name the BR-15 detector refuses to invalid_name (names are the only free text in details)', () => {
    expect(adminDbErrorCode(err('audit:sensitive_details: details hold a DNI or phone', '23514'))).toBe('invalid_name')
  })

  it('maps a bare permission denial to forbidden', () => {
    expect(adminDbErrorCode(err('permission denied for function admin_update_member', '42501'))).toBe('forbidden')
  })

  it.each([
    ['members:ciphertext_unbound: dni_nie_encrypted must be v2 ciphertext bound to its row', '23514'],
    ['admin:isolation: run in READ COMMITTED', '25000'],
    ['admin:something_new: added later', '22023'],
    ['TypeError: fetch failed', ''],
    ['invalid input syntax for type uuid: "x"', '22P02'],
  ])('maps anything else (%s) to failed', (message, code) => {
    expect(adminDbErrorCode(err(message, code))).toBe('failed')
  })

  it('maps a missing or malformed error to failed', () => {
    expect(adminDbErrorCode(null)).toBe('failed')
    expect(adminDbErrorCode(undefined)).toBe('failed')
    expect(adminDbErrorCode({} as never)).toBe('failed')
    expect(adminDbErrorCode({ message: 42 } as never)).toBe('failed')
  })

  it('only matches the prefix at the start of the message', () => {
    expect(adminDbErrorCode(err('wrapped: admin:not_found: unknown member'))).toBe('failed')
  })

  it.each([
    ['admin:forbidden-x: lookalike', '22023'],
    ['admin:not_foundX unknown member', '22023'],
    ['admin:reason_required2: lookalike', '22023'],
    ['audit:forbidden_extra: lookalike', '22023'],
  ])('needs a boundary after the code: %s is failed', (message, code) => {
    expect(adminDbErrorCode(err(message, code))).toBe('failed')
  })

  it('still maps a known code followed by the end of the message or a space', () => {
    expect(adminDbErrorCode(err('admin:not_found'))).toBe('not_found')
    expect(adminDbErrorCode(err('admin:not_found unknown member'))).toBe('not_found')
  })

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'never resolves admin:invalid_value: %s through the object prototype',
    (key) => {
      expect(adminDbErrorCode(err(`admin:invalid_value: ${key} is not a column`))).toBe('invalid')
    }
  )

  it('needs a word boundary after the invalid_value key', () => {
    expect(adminDbErrorCode(err('admin:invalid_value: first_name2 must have 1 to 100 characters'))).toBe('invalid')
  })
})

// The T6 leave/rejoin functions (20261005100400_membership_lifecycle.sql) raise `membership:*`.
describe('adminDbErrorCode · membership prefixes', () => {
  it.each([
    ['membership:forbidden: board role required', '42501', 'forbidden'],
    ['membership:forbidden: a signed-in member is required', '42501', 'forbidden'],
    ['membership:not_found: unknown member', '22023', 'not_found'],
    ['membership:self_target: use member_leave_self to leave yourself', '22023', 'self_target'],
    ['membership:not_active: the member has already left', '22023', 'not_active'],
    ['membership:role_held: a superadmin must revoke the role before the baixa', '23514', 'role_held'],
    [
      'membership:reason_required: a baixa given by the board needs a reason of at least 5 characters',
      '22023',
      'reason_required',
    ],
    ['membership:reason_too_long: at most 500 characters', '22023', 'reason_too_long'],
    [
      'membership:invalid_date: the date cannot be in the future, before the current alta or more than 365 days back',
      '22023',
      'invalid_date',
    ],
    ['membership:not_former: the member is active', '22023', 'not_former'],
    [
      'membership:register_closed: an anonymised or purged record cannot return; the person signs up again',
      '22023',
      'register_closed',
    ],
    ['membership:no_login: the login account no longer exists; the person signs up again', '22023', 'no_login'],
    ['membership:invalid_channel: form, email, in_person or other', '22023', 'invalid_channel'],
    ['membership:note_too_long: at most 500 characters', '22023', 'note_too_long'],
  ])('maps %s to %s', (message, code, expected) => {
    expect(adminDbErrorCode(err(message, code))).toBe(expected)
  })

  it.each([
    ['membership:not_former2: lookalike', '22023'],
    ['membership:role_heldX: lookalike', '23514'],
    ['membership:something_new: added later', '22023'],
    ['membership:__proto__: lookalike', '22023'],
    ['membership:constructor: lookalike', '22023'],
    ['wrapped: membership:no_login: lookalike', '22023'],
  ])('keeps the boundary and own-key rules: %s is failed', (message, code) => {
    expect(adminDbErrorCode(err(message, code))).toBe('failed')
  })
})

describe('isMemberId', () => {
  it('accepts a UUID in either case', () => {
    expect(isMemberId('0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b')).toBe(true)
    expect(isMemberId('0B7C1F2E-3A4D-4E5F-8A9B-0C1D2E3F4A5B')).toBe(true)
  })

  it.each([[''], ['000-203'], ['0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5'], [42], [null], [undefined], [{}]])(
    'rejects %j',
    (value) => {
      expect(isMemberId(value)).toBe(false)
    }
  )
})
