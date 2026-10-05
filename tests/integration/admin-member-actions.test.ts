import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'

// The T11a server actions (src/lib/admin/member-actions.ts) against the real database: the
// guard and the SECURITY DEFINER functions run with a real board (or member) SESSION client,
// and DNI/phone go through the real AES-GCM module (ENCRYPTION_KEY from .env.test.local).
// Only `createClient` is swapped for the signed-in test client, and `revalidatePath` (no
// Next.js request here). Every user is this file's own throwaway account; no superadmins.

const session = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => session.client }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { decrypt } from '@/lib/encryption'
import {
  awardBadge,
  regenerateCard,
  revealSensitive,
  revokeBadge,
  updateMember,
} from '@/lib/admin/member-actions'

const password = 'password123'
const DOMAIN = 'admin-member-actions.test'
const emails = {
  board: `ama-board@${DOMAIN}`,
  member: `ama-member@${DOMAIN}`,
  target: `ama-target@${DOMAIN}`,
  former: `ama-former@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const DNI = 'X1234567L'
const PHONE = '+34 612 345 678'

async function getRow(id: string) {
  const { data, error } = await supabaseAdmin.from('members').select('*').eq('id', id).single()
  expect(error).toBeNull()
  return data!
}

async function auditEntries(target: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('actor_id, action, details, reason')
    .eq('target_member_id', target)
    .eq('action', action)
    .order('id')
  expect(error).toBeNull()
  return data!
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Accions' })
    userIds.push(users[key].id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  expect(
    (await supabaseAdmin.from('members').update({ left_on: '2026-10-01', left_by: 'self' }).eq('id', users.former.id))
      .error
  ).toBeNull()
  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
  session.client = board
})

afterAll(() => cleanupUsers(userIds))

describe('updateMember (A-4)', () => {
  it('stores DNI and phone encrypted for the target; the trigger accepts them', async () => {
    session.client = board
    const res = await updateMember(users.target.id, {
      first_name: ' Laia ',
      last_name: 'Serra',
      postal_code: '08221',
      ludoya_username: '@laia_serra',
      dni: DNI,
      phone: PHONE,
    })
    expect(res).toEqual({
      changed: ['dni', 'first_name', 'last_name', 'ludoya_username', 'phone', 'postal_code'],
    })

    const row = await getRow(users.target.id)
    expect(row).toMatchObject({ first_name: 'Laia', last_name: 'Serra', postal_code: '08221', ludoya_username: 'laia_serra' })
    expect(decrypt(row.dni_nie_encrypted, users.target.id)).toBe(DNI)
    expect(decrypt(row.phone_encrypted, users.target.id)).toBe(PHONE)
    expect(() => decrypt(row.dni_nie_encrypted, users.board.id)).toThrow()

    const [entry] = await auditEntries(users.target.id, 'member.update')
    expect(entry.actor_id).toBe(users.board.id)
    expect(JSON.stringify(entry)).not.toContain(DNI)
    expect(JSON.stringify(entry)).not.toContain('612')
  })

  it('keeps DNI and phone when the input leaves them out (no-op → no entry)', async () => {
    session.client = board
    const before = await getRow(users.target.id)
    const entriesBefore = (await auditEntries(users.target.id, 'member.update')).length

    expect(await updateMember(users.target.id, { first_name: 'Laia', last_name: 'Serra' })).toEqual({ changed: [] })

    const after = await getRow(users.target.id)
    expect(after.dni_nie_encrypted).toBe(before.dni_nie_encrypted)
    expect(after.phone_encrypted).toBe(before.phone_encrypted)
    expect(after.postal_code).toBe('08221')
    expect(await auditEntries(users.target.id, 'member.update')).toHaveLength(entriesBefore)
  })

  it('refuses a former member (not_active), an unknown member and a plain member session', async () => {
    session.client = board
    expect(await updateMember(users.former.id, { first_name: 'A', last_name: 'B' })).toEqual({ error: 'not_active' })
    expect(await updateMember(UNKNOWN_ID, { first_name: 'A', last_name: 'B' })).toEqual({ error: 'not_found' })

    session.client = member
    expect(await updateMember(users.target.id, { first_name: 'Hacked', last_name: 'B' })).toEqual({ error: 'forbidden' })
    expect((await getRow(users.target.id)).first_name).toBe('Laia')
    session.client = board
  })
})

describe('revealSensitive (A-5)', () => {
  it('returns the original plaintext and logs the reveal without the value', async () => {
    session.client = board
    expect(await revealSensitive(users.target.id, 'dni', '  Comprovació presencial  ')).toEqual({ value: DNI })
    expect(await revealSensitive(users.target.id, 'phone')).toEqual({ value: PHONE })

    const entries = await auditEntries(users.target.id, 'member.reveal_sensitive')
    expect(entries.map((e) => e.details)).toEqual([{ field: 'dni' }, { field: 'phone' }])
    expect(entries[0].reason).toBe('Comprovació presencial')
    expect(JSON.stringify(entries)).not.toContain(DNI)
  })

  it('answers no_value for an empty field and forbidden for a former member (board)', async () => {
    session.client = board
    expect(await revealSensitive(users.board.id, 'dni')).toEqual({ error: 'no_value' })
    expect(await revealSensitive(users.former.id, 'dni', 'Requeriment escrit de l’autoritat')).toEqual({
      error: 'forbidden',
    })
  })

  it('refuses a plain member session before the database', async () => {
    session.client = member
    expect(await revealSensitive(users.target.id, 'dni', 'curiositat malsana')).toEqual({ error: 'forbidden' })
    session.client = board
  })
})

describe('awardBadge / revokeBadge (A-8)', () => {
  it('awards, refuses a second award, revokes and refuses a second revoke', async () => {
    session.client = board
    const awarded = await awardBadge(users.target.id, 'ludoteca_donor', 'Va donar jocs')
    expect(awarded).toMatchObject({ ok: true })
    expect(typeof (awarded as { awardedAt: string }).awardedAt).toBe('string')
    expect(await awardBadge(users.target.id, 'ludoteca_donor')).toEqual({ error: 'badge_held' })
    expect(await revokeBadge(users.target.id, 'ludoteca_donor')).toEqual({ ok: true })
    expect(await revokeBadge(users.target.id, 'ludoteca_donor')).toEqual({ error: 'badge_not_held' })
  })

  it('maps a key outside the catalogue and a former member', async () => {
    session.client = board
    expect(await awardBadge(users.target.id, 'membre_2026')).toEqual({ error: 'invalid_badge' })
    expect(await awardBadge(users.former.id, 'ludoteca_donor')).toEqual({ error: 'not_active' })
  })
})

describe('regenerateCard (A-9)', () => {
  it('rotates the token without returning it', async () => {
    session.client = board
    const before = (await getRow(users.target.id)).card_token
    expect(await regenerateCard(users.target.id)).toEqual({ ok: true })
    expect((await getRow(users.target.id)).card_token).not.toBe(before)
    expect(await auditEntries(users.target.id, 'card.regenerate')).toHaveLength(1)
  })

  it('refuses a former member', async () => {
    session.client = board
    expect(await regenerateCard(users.former.id)).toEqual({ error: 'not_active' })
  })
})
