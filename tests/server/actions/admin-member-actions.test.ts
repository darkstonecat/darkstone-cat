import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

const db = vi.hoisted(() => {
  // Real AES-GCM with a fixed test key, so the tests can prove the ciphertext is bound to the
  // target member (the key is cached on first use).
  process.env.ENCRYPTION_KEY = '0123456789abcdef'.repeat(4)
  return {
    access: { status: 'ok', actor: { id: 'actor-id', role: 'board' } } as
      | { status: 'ok'; actor: { id: string; role: string } }
      | { status: 'unauthenticated' }
      | { status: 'forbidden' },
    rpc: vi.fn(),
    result: { data: null, error: null } as { data: unknown; error: { code?: string; message: string } | null },
    revalidatePath: vi.fn(),
    getAdminAccess: vi.fn(),
  }
})

vi.mock('next/cache', () => ({ revalidatePath: db.revalidatePath }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminAccess: async (min: string) => (db.getAdminAccess(min), db.access),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: unknown) => (db.rpc(fn, args), db.result),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('the service role must never be used by admin member actions')
  },
}))

import { decrypt, encrypt } from '@/lib/encryption'
import {
  awardBadge,
  regenerateCard,
  revealSensitive,
  revokeBadge,
  updateMember,
} from '@/lib/admin/member-actions'

const TARGET = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const OTHER = '9f8e7d6c-5b4a-4321-8fed-cba987654321'
const DNI = '12345678Z'
const PHONE = '+34 600 123 456'
const REASON = 'Requeriment escrit de l’autoritat'

let consoleSpies: MockInstance[]

/** Every string written to the console during a test. */
function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .map((call) => call.map((a: unknown) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    .join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'board' } }
  db.result = { data: null, error: null }
  consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {})
  )
})

const lastRpc = () => db.rpc.mock.calls.at(-1) as [string, Record<string, unknown>]

// ---------------------------------------------------------------------------------------------
describe('guard (every action)', () => {
  const calls: [string, () => Promise<unknown>][] = [
    ['updateMember', () => updateMember(TARGET, { first_name: 'Laia', last_name: 'Serra' })],
    ['revealSensitive', () => revealSensitive(TARGET, 'dni', REASON)],
    ['awardBadge', () => awardBadge(TARGET, 'ludoteca_donor')],
    ['revokeBadge', () => revokeBadge(TARGET, 'ludoteca_donor')],
    ['regenerateCard', () => regenerateCard(TARGET)],
  ]

  it.each(calls)('%s requires a session', async (_name, call) => {
    db.access = { status: 'unauthenticated' }
    expect(await call()).toEqual({ error: 'unauthenticated' })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })

  it.each(calls)('%s requires a board role', async (_name, call) => {
    db.access = { status: 'forbidden' }
    expect(await call()).toEqual({ error: 'forbidden' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each(calls)('%s asks the guard for board', async (_name, call) => {
    await call()
    expect(db.getAdminAccess).toHaveBeenCalledWith('board')
  })

  it.each([
    ['updateMember', (id: unknown) => updateMember(id as string, { first_name: 'A', last_name: 'B' })],
    ['revealSensitive', (id: unknown) => revealSensitive(id as string, 'dni')],
    ['awardBadge', (id: unknown) => awardBadge(id as string, 'ludoteca_donor')],
    ['revokeBadge', (id: unknown) => revokeBadge(id as string, 'ludoteca_donor')],
    ['regenerateCard', (id: unknown) => regenerateCard(id as string)],
  ])('%s rejects a member id that is not a UUID without a database call', async (_name, call) => {
    for (const id of ['000-203', '', 5, null, { id: TARGET }]) {
      expect(await call(id)).toEqual({ error: 'invalid' })
    }
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
describe('updateMember (A-4)', () => {
  const valid = {
    first_name: '  Laia ',
    last_name: 'Serra',
    postal_code: '08221',
    ludoya_username: '@laia_serra',
    bgg_username: 'laia',
  }

  it('sends trimmed, normalised values through admin_update_member with the session client', async () => {
    db.result = { data: ['first_name', 'ludoya_username'], error: null }
    expect(await updateMember(TARGET, valid)).toEqual({ changed: ['first_name', 'ludoya_username'] })
    expect(db.rpc).toHaveBeenCalledTimes(1)
    expect(lastRpc()).toEqual([
      'admin_update_member',
      {
        p_member_id: TARGET,
        p_patch: {
          first_name: 'Laia',
          last_name: 'Serra',
          postal_code: '08221',
          ludoya_username: 'laia_serra',
          bgg_username: 'laia',
        },
      },
    ])
  })

  it('never sends DNI or phone keys unless the input includes them', async () => {
    db.result = { data: [], error: null }
    await updateMember(TARGET, { ...valid, dni: undefined })
    const patch = lastRpc()[1].p_patch as Record<string, unknown>
    expect(patch).not.toHaveProperty('dni_nie_encrypted')
    expect(patch).not.toHaveProperty('phone_encrypted')
  })

  it('leaves out optional fields that are not in the input (no accidental clearing)', async () => {
    db.result = { data: [], error: null }
    await updateMember(TARGET, { first_name: 'Laia', last_name: 'Serra' })
    expect(lastRpc()[1].p_patch).toEqual({ first_name: 'Laia', last_name: 'Serra' })
  })

  it('clears an optional field sent as an empty string or null', async () => {
    db.result = { data: ['bgg_username', 'dni', 'phone', 'postal_code'], error: null }
    await updateMember(TARGET, {
      first_name: 'Laia',
      last_name: 'Serra',
      postal_code: ' ',
      bgg_username: null,
      phone: '',
      dni: null,
    })
    expect(lastRpc()[1].p_patch).toEqual({
      first_name: 'Laia',
      last_name: 'Serra',
      postal_code: null,
      bgg_username: null,
      phone_encrypted: null,
      dni_nie_encrypted: null,
    })
  })

  it('encrypts DNI and phone for the TARGET member, never the actor', async () => {
    db.result = { data: ['dni', 'phone'], error: null }
    await updateMember(TARGET, { ...valid, dni: ` ${DNI} `, phone: PHONE })
    const patch = lastRpc()[1].p_patch as Record<string, string>

    expect(patch.dni_nie_encrypted).toMatch(new RegExp(`^v2:${TARGET}:`))
    expect(patch.phone_encrypted).toMatch(new RegExp(`^v2:${TARGET}:`))
    expect(decrypt(patch.dni_nie_encrypted, TARGET)).toBe(DNI)
    expect(decrypt(patch.phone_encrypted, TARGET)).toBe(PHONE)
    expect(() => decrypt(patch.dni_nie_encrypted, OTHER)).toThrow()
    expect(JSON.stringify(patch)).not.toContain(DNI)
  })

  it('binds to the lower-cased target id even when the caller passes upper case', async () => {
    db.result = { data: ['dni'], error: null }
    await updateMember(TARGET.toUpperCase(), { ...valid, dni: DNI })
    const [, args] = lastRpc()
    expect(args.p_member_id).toBe(TARGET)
    expect(decrypt((args.p_patch as Record<string, string>).dni_nie_encrypted, TARGET)).toBe(DNI)
  })

  it('revalidates the admin member pages after a change', async () => {
    db.result = { data: ['first_name'], error: null }
    await updateMember(TARGET, valid)
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members', 'page')
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
  })

  it('does not revalidate a no-op edit', async () => {
    db.result = { data: [], error: null }
    expect(await updateMember(TARGET, valid)).toEqual({ changed: [] })
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    ['blank first name', { first_name: '  ' }, 'invalid_name'],
    ['missing last name', { last_name: undefined }, 'invalid_name'],
    ['first name over 100 chars', { first_name: 'a'.repeat(101) }, 'invalid_name'],
    ['phone with letters', { phone: 'abc123456' }, 'invalid_phone'],
    ['phone over 20 chars', { phone: '6'.repeat(21) }, 'invalid_phone'],
    ['malformed DNI', { dni: '1234' }, 'invalid_dni'],
    ['postal code with 4 digits', { postal_code: '8221' }, 'invalid_postal_code'],
    ['username with a slash', { ludoya_username: 'a/b' }, 'invalid_username'],
    ['username over 64 chars', { bgg_username: 'x'.repeat(65) }, 'invalid_username'],
  ])('rejects %s without a database call', async (_label, patch, code) => {
    expect(await updateMember(TARGET, { ...valid, ...patch } as never)).toEqual({ error: code })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    [{ first_name: 5 }, 'invalid_name'],
    [{ last_name: { a: 1 } }, 'invalid_name'],
    [{ phone: 600123456 }, 'invalid_phone'],
    [{ dni: ['12345678Z'] }, 'invalid_dni'],
    [{ postal_code: 8221 }, 'invalid_postal_code'],
    [{ ludoya_username: {} }, 'invalid_username'],
  ])('returns a validation error, not a crash, for non-string input %j', async (patch, code) => {
    expect(await updateMember(TARGET, { ...valid, ...patch } as never)).toEqual({ error: code })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([[null], [undefined], ['x'], [[]], [42]])('rejects input that is not an object (%j)', async (input) => {
    expect(await updateMember(TARGET, input as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('ignores keys outside A-4 (e-mail is not editable, BR-13)', async () => {
    db.result = { data: [], error: null }
    await updateMember(TARGET, { ...valid, email: 'x@y.z', member_number: '1', role: 'superadmin' } as never)
    expect(Object.keys(lastRpc()[1].p_patch as object).sort()).toEqual(
      ['bgg_username', 'first_name', 'last_name', 'ludoya_username', 'postal_code']
    )
  })

  it.each([
    ["admin:not_active: a former member's register is read-only", '22023', 'not_active'],
    ['admin:not_found: unknown member', '22023', 'not_found'],
    ['admin:forbidden: board role required', '42501', 'forbidden'],
    ['admin:invalid_value: dni_nie_encrypted must be ciphertext bound to the member', '22023', 'invalid_dni'],
    ['audit:sensitive_details: details hold a DNI or phone', '23514', 'invalid_name'],
    ['members:ciphertext_unbound: phone_encrypted must be v2', '23514', 'failed'],
  ])('maps %s to %s and logs only the code', async (message, code, expected) => {
    db.result = { data: null, error: { code, message } }
    expect(await updateMember(TARGET, { ...valid, dni: DNI, phone: PHONE })).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
    const out = consoleOutput()
    expect(out).toContain(code)
    expect(out).toContain('update_member')
    expect(out).not.toContain(message)
    expect(out).not.toContain(DNI)
    expect(out).not.toContain(PHONE)
    expect(out).not.toContain('Laia')
  })
})

// ---------------------------------------------------------------------------------------------
describe('revealSensitive (A-5)', () => {
  it('returns the plaintext decrypted with the target id and passes the trimmed reason', async () => {
    db.result = { data: encrypt(DNI, TARGET), error: null }
    expect(await revealSensitive(TARGET, 'dni', `  ${REASON}  `)).toEqual({ value: DNI })
    expect(lastRpc()).toEqual([
      'admin_reveal_sensitive',
      { p_member_id: TARGET, p_field: 'dni', p_reason: REASON },
    ])
  })

  it('reveals a phone, sending a null reason when none is given', async () => {
    db.result = { data: encrypt(PHONE, TARGET), error: null }
    expect(await revealSensitive(TARGET, 'phone')).toEqual({ value: PHONE })
    expect(lastRpc()[1]).toEqual({ p_member_id: TARGET, p_field: 'phone', p_reason: null })
  })

  it('sends a blank reason as null (the database decides whether one is required)', async () => {
    db.result = { data: encrypt(DNI, TARGET), error: null }
    await revealSensitive(TARGET, 'dni', '   ')
    expect(lastRpc()[1].p_reason).toBeNull()
  })

  it('refuses a ciphertext bound to another member (failed, value never returned)', async () => {
    db.result = { data: encrypt(DNI, OTHER), error: null }
    expect(await revealSensitive(TARGET, 'dni', REASON)).toEqual({ error: 'failed' })
    const out = consoleOutput()
    expect(out).toContain('reveal_sensitive')
    expect(out).not.toContain(DNI)
    expect(out).not.toContain(REASON)
  })

  it('answers no_value when the database returns nothing', async () => {
    db.result = { data: null, error: null }
    expect(await revealSensitive(TARGET, 'dni', REASON)).toEqual({ error: 'no_value' })
  })

  it.each([['email'], ['dni_nie_encrypted'], [''], [5], [null]])(
    'rejects field %j without a database call',
    async (field) => {
      expect(await revealSensitive(TARGET, field as never, REASON)).toEqual({ error: 'invalid' })
      expect(db.rpc).not.toHaveBeenCalled()
    }
  )

  it('rejects a reason that is not a string', async () => {
    expect(await revealSensitive(TARGET, 'dni', 12345678901 as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('rejects a reason over 500 characters without a database call', async () => {
    expect(await revealSensitive(TARGET, 'dni', 'a'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('accepts a 500-character reason with surrounding spaces', async () => {
    db.result = { data: encrypt(DNI, TARGET), error: null }
    expect(await revealSensitive(TARGET, 'dni', ` ${'a'.repeat(500)} `)).toEqual({ value: DNI })
  })

  it.each([
    ["admin:reason_required: revealing a former member's DNI needs a reason", '22023', 'reason_required'],
    ['admin:reason_too_long: at most 500 characters', '22023', 'reason_too_long'],
    ['admin:no_value: nothing stored for dni', '22023', 'no_value'],
    ["admin:forbidden: only a superadmin can reveal a former member's DNI", '42501', 'forbidden'],
    ['admin:not_found: unknown member', '22023', 'not_found'],
    ['admin:invalid_argument: a former member has no phone to reveal', '22023', 'invalid'],
    ['boom', '500', 'failed'],
  ])('maps %s to %s', async (message, code, expected) => {
    db.result = { data: null, error: { code, message } }
    expect(await revealSensitive(TARGET, 'dni', REASON)).toEqual({ error: expected })
    const out = consoleOutput()
    expect(out).not.toContain(REASON)
    expect(out).not.toContain(message)
  })

  it('never writes the value or the reason to the console on success', async () => {
    db.result = { data: encrypt(DNI, TARGET), error: null }
    await revealSensitive(TARGET, 'dni', REASON)
    expect(consoleOutput()).toBe('')
  })

  it('does not revalidate (the value lives on that screen only)', async () => {
    db.result = { data: encrypt(DNI, TARGET), error: null }
    await revealSensitive(TARGET, 'dni', REASON)
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
describe('awardBadge / revokeBadge (A-8)', () => {
  it('awards through admin_award_badge with a trimmed note and returns awarded_at', async () => {
    db.result = { data: '2026-10-05T10:00:00+00:00', error: null }
    expect(await awardBadge(TARGET, 'ludoteca_donor', '  Va donar 12 jocs ')).toEqual({
      ok: true,
      awardedAt: '2026-10-05T10:00:00+00:00',
    })
    expect(lastRpc()).toEqual([
      'admin_award_badge',
      { p_member_id: TARGET, p_badge_key: 'ludoteca_donor', p_note: 'Va donar 12 jocs' },
    ])
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
  })

  it('revokes through admin_revoke_badge with a null reason when none is given', async () => {
    db.result = { data: null, error: null }
    expect(await revokeBadge(TARGET, 'volunteer_egara_joga')).toEqual({ ok: true })
    expect(lastRpc()).toEqual([
      'admin_revoke_badge',
      { p_member_id: TARGET, p_badge_key: 'volunteer_egara_joga', p_reason: null },
    ])
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
  })

  it.each([[''], ['Ludoteca Donor'], ['a'.repeat(65)], [5], [null], [{}]])(
    'rejects badge key %j as invalid_badge without a database call',
    async (key) => {
      expect(await awardBadge(TARGET, key as never)).toEqual({ error: 'invalid_badge' })
      expect(await revokeBadge(TARGET, key as never)).toEqual({ error: 'invalid_badge' })
      expect(db.rpc).not.toHaveBeenCalled()
    }
  )

  it('rejects a note or reason that is not a string, or over 500 characters', async () => {
    expect(await awardBadge(TARGET, 'ludoteca_donor', 5 as never)).toEqual({ error: 'invalid' })
    expect(await revokeBadge(TARGET, 'ludoteca_donor', 'a'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['admin:badge_held: the member already holds this badge', 'badge_held'],
    ['admin:invalid_argument: unknown badge', 'invalid_badge'],
    ["admin:not_active: a former member's badges are kept as they are", 'not_active'],
    ['admin:not_found: unknown member', 'not_found'],
    ['admin:reason_too_long: at most 500 characters', 'reason_too_long'],
  ])('award maps %s to %s', async (message, expected) => {
    db.result = { data: null, error: { code: '22023', message } }
    expect(await awardBadge(TARGET, 'ludoteca_donor')).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
    expect(consoleOutput()).toContain('award_badge')
  })

  it.each([
    ['admin:badge_not_held: the member does not hold this badge', 'badge_not_held'],
    ['admin:invalid_argument: unknown badge', 'invalid_badge'],
    ["admin:not_active: a former member's badges are kept as they are", 'not_active'],
  ])('revoke maps %s to %s', async (message, expected) => {
    db.result = { data: null, error: { code: '22023', message } }
    expect(await revokeBadge(TARGET, 'ludoteca_donor')).toEqual({ error: expected })
    expect(consoleOutput()).toContain('revoke_badge')
  })
})

// ---------------------------------------------------------------------------------------------
describe('regenerateCard (A-9)', () => {
  it('calls regenerate_card_token and never returns the token', async () => {
    db.result = { data: 'a'.repeat(32), error: null }
    const res = await regenerateCard(TARGET)
    expect(res).toEqual({ ok: true })
    expect(JSON.stringify(res)).not.toContain('a'.repeat(32))
    expect(lastRpc()).toEqual(['regenerate_card_token', { target_member_id: TARGET }])
    expect(db.revalidatePath).toHaveBeenCalledWith('/[locale]/admin/members/[number]', 'page')
    expect(consoleOutput()).not.toContain('a'.repeat(32))
  })

  it.each([
    ['admin:not_active: a former member gets a new card on return', '22023', 'not_active'],
    ['admin:not_found: unknown member', '22023', 'not_found'],
    ['admin:forbidden: board role required', '42501', 'forbidden'],
    ['network down', '', 'failed'],
  ])('maps %s to %s', async (message, code, expected) => {
    db.result = { data: null, error: { code, message } }
    expect(await regenerateCard(TARGET)).toEqual({ error: expected })
    expect(consoleOutput()).toContain('regenerate_card')
  })
})
