import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
} from '../helpers/supabase'
import { encrypt, decrypt } from '@/lib/encryption'

let user: { id: string }
const userIds: string[] = []

beforeAll(async () => {
  user = await createTestUser('profile-upd@test.local', 'password123', {
    first_name: 'Original',
    last_name: 'Name',
  })
  userIds.push(user.id)
})

afterAll(() => cleanupUsers(userIds))

describe('profile update via authenticated client (RLS enforced)', () => {
  it('updates name fields', async () => {
    const client = await createAuthenticatedClient(
      'profile-upd@test.local',
      'password123'
    )
    const { error } = await client
      .from('members')
      .update({ first_name: 'Updated', last_name: 'User' })
      .eq('id', user.id)

    expect(error).toBeNull()

    const { data } = await client
      .from('members')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    expect(data!.first_name).toBe('Updated')
    expect(data!.last_name).toBe('User')
  })

  it('stores encrypted phone, decryptable after read', async () => {
    const client = await createAuthenticatedClient(
      'profile-upd@test.local',
      'password123'
    )
    const encryptedPhone = encrypt('612345678', user.id)
    await client
      .from('members')
      .update({ phone_encrypted: encryptedPhone })
      .eq('id', user.id)

    const { data } = await client
      .from('members')
      .select('phone_encrypted')
      .eq('id', user.id)
      .single()

    expect(data!.phone_encrypted).not.toBe('612345678')
    expect(decrypt(data!.phone_encrypted!, user.id)).toBe('612345678')
  })

  it('stores encrypted DNI, decryptable after read', async () => {
    const client = await createAuthenticatedClient(
      'profile-upd@test.local',
      'password123'
    )
    const encryptedDni = encrypt('12345678A', user.id)
    await client
      .from('members')
      .update({ dni_nie_encrypted: encryptedDni })
      .eq('id', user.id)

    const { data } = await client
      .from('members')
      .select('dni_nie_encrypted')
      .eq('id', user.id)
      .single()

    expect(decrypt(data!.dni_nie_encrypted!, user.id)).toBe('12345678A')
  })

  it('clears phone by setting null', async () => {
    const client = await createAuthenticatedClient(
      'profile-upd@test.local',
      'password123'
    )
    await client
      .from('members')
      .update({ phone_encrypted: null })
      .eq('id', user.id)

    const { data } = await client
      .from('members')
      .select('phone_encrypted')
      .eq('id', user.id)
      .single()

    expect(data!.phone_encrypted).toBeNull()
  })

})

describe('DNI/NIE validation regex', () => {
  const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i

  it('accepts valid DNI formats', () => {
    expect(DNI_NIE_REGEX.test('12345678A')).toBe(true)
    expect(DNI_NIE_REGEX.test('00000000T')).toBe(true)
  })

  it('accepts valid NIE formats', () => {
    expect(DNI_NIE_REGEX.test('X1234567A')).toBe(true)
    expect(DNI_NIE_REGEX.test('Y0000000Z')).toBe(true)
    expect(DNI_NIE_REGEX.test('Z9999999B')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(DNI_NIE_REGEX.test('ABCDEFGH')).toBe(false)
    expect(DNI_NIE_REGEX.test('1234567')).toBe(false)
    expect(DNI_NIE_REGEX.test('123456789AB')).toBe(false)
    expect(DNI_NIE_REGEX.test('')).toBe(false)
  })
})
