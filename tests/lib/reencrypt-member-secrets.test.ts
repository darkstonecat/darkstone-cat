import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createCipheriv, randomBytes } from 'node:crypto'
import {
  parseKey,
  formatOf,
  planReencryption,
  run,
  encryptForMember,
} from '../../scripts/reencrypt-member-secrets.mjs'

const KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const key = parseKey(KEY_HEX)
const A = '11111111-2222-4333-8444-555555555555'
const B = '99999999-8888-4777-8666-555555555555'

function legacy(plainText: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  const data = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

let decrypt: (value: string, memberId: string) => string
beforeAll(async () => {
  process.env.ENCRYPTION_KEY = KEY_HEX
  ;({ decrypt } = await import('@/lib/encryption'))
})

describe('planReencryption', () => {
  it('re-encrypts legacy values into v2 bound to the row, readable by src/lib/encryption.ts', () => {
    const { updates, counts, findings } = planReencryption(
      [{ id: A, dni_nie_encrypted: legacy('12345678Z'), phone_encrypted: legacy('612345678') }],
      key
    )
    expect(findings).toEqual([])
    expect(counts).toMatchObject({ legacy: 2, already_v2: 0, errors: 0, duplicates: 0 })
    expect(updates.map((u: { column: string }) => u.column)).toEqual(['dni_nie_encrypted', 'phone_encrypted'])
    expect(formatOf(updates[0].to)).toBe('v2')
    expect(decrypt(updates[0].to, A)).toBe('12345678Z')
    expect(decrypt(updates[1].to, A)).toBe('612345678')
    expect(() => decrypt(updates[0].to, B)).toThrow()
  })

  it('is idempotent: v2 values and nulls are skipped', () => {
    const { updates, counts } = planReencryption(
      [{ id: A, dni_nie_encrypted: encryptForMember('12345678Z', A, key), phone_encrypted: null }],
      key
    )
    expect(updates).toEqual([])
    expect(counts.already_v2).toBe(1)
  })

  it('leaves a legacy value stored in two places alone and reports both (copied ciphertext)', () => {
    const copied = legacy('12345678Z')
    const { updates, findings, counts } = planReencryption(
      [
        { id: A, dni_nie_encrypted: copied, phone_encrypted: null },
        { id: B, dni_nie_encrypted: copied, phone_encrypted: null },
      ],
      key
    )
    expect(updates).toEqual([])
    expect(counts.duplicates).toBe(2)
    expect(findings).toEqual([
      { id: A, column: 'dni_nie_encrypted', reason: 'duplicate_ciphertext' },
      { id: B, column: 'dni_nie_encrypted', reason: 'duplicate_ciphertext' },
    ])
  })

  it('reports values that do not decrypt or have an unknown format, per row, without the value', () => {
    const otherKey = parseKey('f'.repeat(64))
    const wrongKey = (() => {
      const iv = randomBytes(12)
      const c = createCipheriv('aes-256-gcm', otherKey, iv, { authTagLength: 16 })
      const d = Buffer.concat([c.update('12345678Z', 'utf8'), c.final()])
      return [iv.toString('base64'), c.getAuthTag().toString('base64'), d.toString('base64')].join(':')
    })()
    const { updates, findings, counts } = planReencryption(
      [
        { id: A, dni_nie_encrypted: wrongKey, phone_encrypted: '612345678' },
        { id: B, dni_nie_encrypted: legacy('X1234567L'), phone_encrypted: null },
      ],
      key
    )
    expect(findings).toEqual([
      { id: A, column: 'dni_nie_encrypted', reason: 'decrypt_failed' },
      { id: A, column: 'phone_encrypted', reason: 'unknown_format' },
    ])
    expect(counts.errors).toBe(2)
    expect(updates).toHaveLength(1)
    expect(JSON.stringify(findings)).not.toContain('612345678')
  })
})

describe('run', () => {
  function fakeSupabase(rows: Record<string, unknown>[], updated: unknown[] = [{ id: A }]) {
    const update = vi.fn()
    const eqs: unknown[][] = []
    const supabase = {
      from: () => ({
        select: () => ({
          or: () => ({ order: () => ({ range: async () => ({ data: rows, error: null }) }) }),
        }),
        update: (values: unknown) => {
          update(values)
          const chain = {
            eq: (...a: unknown[]) => (eqs.push(a), chain),
            select: async () => ({ data: updated, error: null }),
          }
          return chain
        },
      }),
    }
    return { supabase, update, eqs }
  }

  it('dry run writes nothing and prints a summary without values', async () => {
    const value = legacy('12345678Z')
    const { supabase, update } = fakeSupabase([{ id: A, dni_nie_encrypted: value, phone_encrypted: null }])
    const log = vi.fn()
    const result = await run({ supabase, key, apply: false, log })
    expect(update).not.toHaveBeenCalled()
    expect(result.summary).toBe(
      'Summary: mode=dry-run rows=1 already_v2=0 legacy=1 would_reencrypt=1 duplicates=0 errors=0'
    )
    expect(JSON.stringify(log.mock.calls)).not.toContain(value)
    expect(JSON.stringify(log.mock.calls)).not.toContain('12345678Z')
  })

  it('apply writes with compare-and-set on the value that was read', async () => {
    const value = legacy('12345678Z')
    const { supabase, update, eqs } = fakeSupabase([{ id: A, dni_nie_encrypted: value, phone_encrypted: null }])
    const result = await run({ supabase, key, apply: true, log: vi.fn() })
    expect(result.written).toBe(1)
    expect(decrypt((update.mock.calls[0][0] as { dni_nie_encrypted: string }).dni_nie_encrypted, A)).toBe('12345678Z')
    expect(eqs).toEqual([
      ['id', A],
      ['dni_nie_encrypted', value],
    ])
  })

  it('reports a value changed meanwhile instead of overwriting it', async () => {
    const { supabase } = fakeSupabase([{ id: A, dni_nie_encrypted: legacy('12345678Z'), phone_encrypted: null }], [])
    const result = await run({ supabase, key, apply: true, log: vi.fn() })
    expect(result.written).toBe(0)
    expect(result.findings).toEqual([{ id: A, column: 'dni_nie_encrypted', reason: 'changed_concurrently' }])
  })
})
