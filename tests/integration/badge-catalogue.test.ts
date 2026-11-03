import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261103100000_badge_catalogue.sql: the badge catalogue (public.badges), the board
// functions that manage it, archiving ("Desaparecen para todos"), bulk award and the audit
// name snapshot. Spec: odd/tasks/badge-catalogue.md S1-S5.
//
// Every user and every badge here belongs to this file (keys start with a per-run prefix).
// Superadmin-only delete lives in roles.test.ts, the only file allowed to create superadmins.
// Audit entries cannot be deleted, so assertions filter by this file's own badge keys.

const password = 'password123'
const DOMAIN = 'badge-catalogue.test'
const emails = {
  board: `bc-board@${DOMAIN}`,
  member: `bc-member@${DOMAIN}`,
  holderA: `bc-holder-a@${DOMAIN}`,
  holderB: `bc-holder-b@${DOMAIN}`,
  holderC: `bc-holder-c@${DOMAIN}`,
  former: `bc-former@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

const RUN = `bc${Date.now().toString(36)}`
const createdKeys: string[] = []
const keyFor = (name: string) => {
  const key = `${RUN}_${name}`
  createdKeys.push(key)
  return key
}

const texts = (ca: string, extra: Record<string, string> = {}) => ({ ca, ...extra })
const ICON_KEYS = [
  'star', 'how_to_reg', 'gift', 'dice', 'puzzle', 'trophy', 'volunteer', 'groups',
  'school', 'celebration', 'book', 'medal', 'heart', 'handshake', 'brush', 'megaphone',
]

function create(
  client: SupabaseClient,
  key: string,
  over: Partial<{ name: unknown; earned: unknown; locked: unknown; icon: unknown; show_locked: boolean }> = {}
) {
  return client.rpc('admin_create_badge', {
    p_key: key,
    p_name: over.name ?? texts('Insígnia de prova', { es: 'Insignia de prueba', en: 'Test badge' }),
    p_earned_text: over.earned ?? texts('La tens.'),
    p_locked_text: over.locked ?? texts('Encara no la tens.'),
    p_icon: over.icon ?? 'dice',
    p_show_locked: over.show_locked ?? true,
  })
}

const award = (client: SupabaseClient, memberId: string, key: string, note: string | null = null) =>
  client.rpc('admin_award_badge', { p_member_id: memberId, p_badge_key: key, p_note: note })
const revoke = (client: SupabaseClient, memberId: string, key: string) =>
  client.rpc('admin_revoke_badge', { p_member_id: memberId, p_badge_key: key, p_reason: null })
const archive = (client: SupabaseClient, key: string) => client.rpc('admin_archive_badge', { p_key: key })
const restore = (client: SupabaseClient, key: string) => client.rpc('admin_restore_badge', { p_key: key })

async function catalogueEntries(key: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('id, actor_id, action, target_member_id, details, reason')
    .eq('action', action)
    .filter('details->>badge', 'eq', key)
    .order('id')
  expect(error).toBeNull()
  return data!
}

async function listed(key: string) {
  const { data, error } = await board.rpc('admin_list_badges')
  expect(error).toBeNull()
  return (data as Array<Record<string, unknown>>).find((row) => row.key === key)
}

function expectError(error: { code?: string; message?: string } | null, code: string, prefix: string) {
  expect(error?.code).toBe(code)
  expect(error?.message).toContain(prefix)
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Cataleg' })
    userIds.push(users[key].id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  expect(
    (await supabaseAdmin.from('members').update({ left_on: '2026-10-01', left_by: 'self' }).eq('id', users.former.id))
      .error
  ).toBeNull()
  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
})

afterAll(async () => {
  if (createdKeys.length > 0) {
    await supabaseAdmin.from('member_badges').delete().in('badge_key', createdKeys)
    // No API role may write the catalogue, so the cleanup runs as the table owner.
    await runSqlAsPostgres('DELETE FROM public.badges WHERE key = ANY($1::text[])', [createdKeys])
  }
  await cleanupUsers(userIds)
})

// ---------------------------------------------------------------------------------------------
describe('public.badges (S1)', () => {
  it('is seeded with the two existing badges and their texts in three languages', async () => {
    const { data, error } = await supabaseAdmin
      .from('badges')
      .select('key, name, earned_text, locked_text, icon, show_locked, archived_at')
      .in('key', ['volunteer_egara_joga', 'ludoteca_donor'])
      .order('sort_order')
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        key: 'volunteer_egara_joga',
        name: { ca: 'Voluntariat Egara Juga', es: 'Voluntariado Egara Juga', en: 'Egara Juga volunteer' },
        earned_text: {
          ca: 'Ha col·laborat a la fira Egara Juga.',
          es: 'Ha colaborado en la feria Egara Juga.',
          en: 'Helped out at the Egara Juga fair.',
        },
        locked_text: {
          ca: 'Col·labora a la fira Egara Juga per aconseguir-la.',
          es: 'Colabora en la feria Egara Juga para conseguirla.',
          en: 'Help out at the Egara Juga fair to earn it.',
        },
        icon: 'how_to_reg',
        show_locked: true,
        archived_at: null,
      },
      {
        key: 'ludoteca_donor',
        name: { ca: 'Donant de la ludoteca', es: 'Donante de la ludoteca', en: 'Library donor' },
        earned_text: {
          ca: "Ha donat un joc a la ludoteca de l'associació.",
          es: 'Ha donado un juego a la ludoteca de la asociación.',
          en: "Donated a game to the association's library.",
        },
        locked_text: {
          ca: "Dona un joc a la ludoteca de l'associació per aconseguir-la.",
          es: 'Dona un juego a la ludoteca de la asociación para conseguirla.',
          en: "Donate a game to the association's library to earn it.",
        },
        icon: 'gift',
        show_locked: true,
        archived_at: null,
      },
    ])
  })

  it('pins the closed icon list', async () => {
    const { data, error } = await runSqlAsPostgres<{ keys: string[] }>('SELECT public.badge_icon_keys() AS keys')
    expect(error).toBeNull()
    expect(data![0].keys).toEqual(ICON_KEYS)
  })

  it('members read the catalogue, anonymous visitors read nothing, nobody writes through the API', async () => {
    const { data: rows, error } = await member.from('badges').select('key')
    expect(error).toBeNull()
    expect(rows!.map((r) => r.key)).toEqual(expect.arrayContaining(['volunteer_egara_joga', 'ludoteca_donor']))

    const { data: anonRows } = await anon.from('badges').select('key')
    expect(anonRows ?? []).toEqual([])

    const key = keyFor('direct')
    for (const client of [member, board]) {
      const insert = await client.from('badges').insert({ key, name: { ca: 'X' }, earned_text: { ca: 'X' }, locked_text: { ca: 'X' }, icon: 'dice' })
      expect(insert.error?.code).toBe('42501')
      const upd = await client.from('badges').update({ icon: 'star' }).eq('key', 'ludoteca_donor').select()
      expect(upd.data ?? []).toEqual([])
      const del = await client.from('badges').delete().eq('key', 'ludoteca_donor').select()
      expect(del.data ?? []).toEqual([])
    }
    const { data: still } = await supabaseAdmin.from('badges').select('icon').eq('key', 'ludoteca_donor').single()
    expect(still!.icon).toBe('gift')
  })

  it('not even the service role writes the catalogue: only the audited functions do', async () => {
    const key = keyFor('service_role')
    const insert = await supabaseAdmin
      .from('badges')
      .insert({ key, name: { ca: 'X' }, earned_text: { ca: 'X' }, locked_text: { ca: 'X' }, icon: 'dice' })
    expect(insert.error?.code).toBe('42501')
    const upd = await supabaseAdmin.from('badges').update({ icon: 'star' }).eq('key', 'ludoteca_donor')
    expect(upd.error?.code).toBe('42501')
    const del = await supabaseAdmin.from('badges').delete().eq('key', 'ludoteca_donor')
    expect(del.error?.code).toBe('42501')
    const { data } = await supabaseAdmin.from('badges').select('icon').eq('key', 'ludoteca_donor').single()
    expect(data!.icon).toBe('gift')
  })

  it('member_badges only accepts keys of the catalogue (foreign key)', async () => {
    const { error } = await supabaseAdmin.from('member_badges').insert({ member_id: users.holderA.id, badge_key: 'made_up' })
    expect(error?.code).toBe('23503')
  })

  it('the key never changes, even for the table owner', async () => {
    const key = keyFor('immutable')
    expect((await create(board, key)).error).toBeNull()
    const { error } = await runSqlAsPostgres('UPDATE public.badges SET key = $1 WHERE key = $2', [`${key}_new`, key])
    expect(error?.message).toContain('badges:key_immutable')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_create_badge() (S2)', () => {
  it('creates a badge, puts it last and writes badge.create with the Catalan name', async () => {
    const key = keyFor('created')
    const { error } = await create(board, key, { name: texts('Mestre de rol', { es: 'Máster de rol' }), icon: 'book' })
    expect(error).toBeNull()

    const { data: row } = await supabaseAdmin.from('badges').select('*').eq('key', key).single()
    expect(row).toMatchObject({
      key,
      name: { ca: 'Mestre de rol', es: 'Máster de rol' },
      icon: 'book',
      show_locked: true,
      archived_at: null,
      created_by: users.board.id,
    })
    const { data: max } = await supabaseAdmin.from('badges').select('sort_order').order('sort_order', { ascending: false }).limit(1).single()
    expect(row!.sort_order).toBe(max!.sort_order)

    const entries = await catalogueEntries(key, 'badge.create')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      actor_id: users.board.id,
      target_member_id: null,
      details: { badge: key, name: 'Mestre de rol' },
    })
  })

  it('refuses a key that already exists, archived or not', async () => {
    expectError((await create(board, 'ludoteca_donor')).error, '22023', 'admin:badge_exists')
    const key = keyFor('dup')
    expect((await create(board, key)).error).toBeNull()
    expect((await archive(board, key)).error).toBeNull()
    expectError((await create(board, key)).error, '22023', 'admin:badge_exists')
  })

  it('validates the key, the texts and the icon', async () => {
    const bad: Array<[string, Parameters<typeof create>[2]]> = [
      ['Bad-Key', {}],
      ['ab', {}],
      ['member_tenure', {}],
      ['member_year', {}],
    ]
    for (const [key, over] of bad) {
      expectError((await create(board, key, over)).error, '22023', 'admin:invalid_argument')
    }
    const key = keyFor('invalid')
    const invalid: Array<Parameters<typeof create>[2]> = [
      { name: { es: 'Sin catalán' } },
      { name: { ca: '   ' } },
      { name: { ca: 'Nom', fr: 'Nom' } },
      { name: { ca: 7 } },
      { name: 'Nom' },
      { name: { ca: 'x'.repeat(61) } },
      { earned: { ca: 'x'.repeat(201) } },
      { locked: {} },
      { icon: 'rocket' },
    ]
    for (const over of invalid) {
      expectError((await create(board, key, over)).error, '22023', 'admin:invalid_argument')
    }
    const { data } = await supabaseAdmin.from('badges').select('key').eq('key', key)
    expect(data).toEqual([])
  })

  it('is board only', async () => {
    const key = keyFor('forbidden')
    expectError((await create(member, key)).error, '42501', 'admin:forbidden')
    expect((await anon.rpc('admin_create_badge', { p_key: key })).error).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_update_badge() (S2)', () => {
  it('changes texts, icon, order and visibility, returns the changed fields and audits them', async () => {
    const key = keyFor('updated')
    expect((await create(board, key)).error).toBeNull()

    const { data, error } = await board.rpc('admin_update_badge', {
      p_key: key,
      p_patch: { name: { ca: 'Nom nou', en: 'New name' }, icon: 'trophy', show_locked: false, sort_order: 5 },
    })
    expect(error).toBeNull()
    expect([...(data as string[])].sort()).toEqual(['icon', 'name', 'show_locked', 'sort_order'])

    const { data: row } = await supabaseAdmin.from('badges').select('*').eq('key', key).single()
    expect(row).toMatchObject({ name: { ca: 'Nom nou', en: 'New name' }, icon: 'trophy', show_locked: false, sort_order: 5 })
    expect(new Date(row!.updated_at).getTime()).toBeGreaterThan(new Date(row!.created_at).getTime())

    const entries = await catalogueEntries(key, 'badge.update')
    expect(entries).toHaveLength(1)
    expect(entries[0].details).toMatchObject({ badge: key, name: 'Nom nou' })
    expect([...entries[0].details.fields].sort()).toEqual(['icon', 'name', 'show_locked', 'sort_order'])
  })

  it('refuses a patch that changes nothing, an unknown field, the key or an invalid value', async () => {
    const key = keyFor('patch')
    expect((await create(board, key)).error).toBeNull()
    const upd = (p_patch: unknown) => board.rpc('admin_update_badge', { p_key: key, p_patch })

    expectError((await upd({ icon: 'dice' })).error, '22023', 'admin:no_value')
    expectError((await upd({})).error, '22023', 'admin:invalid_argument')
    expectError((await upd({ key: 'other_key' })).error, '22023', 'admin:invalid_argument')
    expectError((await upd({ archived_at: null })).error, '22023', 'admin:invalid_argument')
    expectError((await upd({ icon: 'rocket' })).error, '22023', 'admin:invalid_argument')
    expectError((await upd({ name: { es: 'Sin catalán' } })).error, '22023', 'admin:invalid_argument')
    expectError((await upd({ sort_order: 'first' })).error, '22023', 'admin:invalid_argument')
    expect(await catalogueEntries(key, 'badge.update')).toEqual([])
  })

  it('answers not_found for an unknown badge and forbidden for a plain member', async () => {
    expectError(
      (await board.rpc('admin_update_badge', { p_key: `${RUN}_nobody`, p_patch: { icon: 'star' } })).error,
      '22023',
      'admin:not_found'
    )
    expectError(
      (await member.rpc('admin_update_badge', { p_key: 'ludoteca_donor', p_patch: { icon: 'star' } })).error,
      '42501',
      'admin:forbidden'
    )
  })
})

// ---------------------------------------------------------------------------------------------
describe('archiving (S3) and awarding a catalogue badge (S4, S5)', () => {
  it('awards a new badge with the name snapshot, then archiving hides it but keeps the rows', async () => {
    const key = keyFor('archived')
    expect((await create(board, key, { name: texts('Insígnia arxivable') })).error).toBeNull()

    expect((await award(board, users.holderA.id, key, 'Primera')).error).toBeNull()
    const awards = await catalogueEntries(key, 'badge.award')
    expect(awards).toHaveLength(1)
    expect(awards[0]).toMatchObject({
      target_member_id: users.holderA.id,
      details: { badge: key, name: 'Insígnia arxivable' },
      reason: 'Primera',
    })

    expect((await archive(board, key)).error).toBeNull()
    const { data: row } = await supabaseAdmin.from('badges').select('archived_at, archived_by').eq('key', key).single()
    expect(row!.archived_at).not.toBeNull()
    expect(row!.archived_by).toBe(users.board.id)
    const archived = await catalogueEntries(key, 'badge.archive')
    expect(archived).toHaveLength(1)
    expect(archived[0].details).toMatchObject({ badge: key, name: 'Insígnia arxivable', active_holders: 1 })

    // Hidden from members, kept in member_badges (the member's own data export still has it).
    const { data: seen } = await member.from('badges').select('key').eq('key', key)
    expect(seen).toEqual([])
    const holder = await createAuthenticatedClient(emails.holderA, password)
    const { data: own } = await holder.from('member_badges').select('badge_key').eq('badge_key', key)
    expect(own).toEqual([{ badge_key: key }])

    // Neither awarded nor revoked while archived.
    expectError((await award(board, users.holderB.id, key)).error, '22023', 'admin:badge_archived')
    expectError((await revoke(board, users.holderA.id, key)).error, '22023', 'admin:badge_archived')
    expectError((await archive(board, key)).error, '22023', 'admin:badge_archived')

    // The board still lists it, with its holders.
    expect(await listed(key)).toMatchObject({ key, holders: 1, active_holders: 1, ever_awarded: true })
    expect((await listed(key))!.archived_at).not.toBeNull()

    // Restoring brings everything back as it was.
    expect((await restore(board, key)).error).toBeNull()
    expect(await catalogueEntries(key, 'badge.restore')).toHaveLength(1)
    const { data: back } = await member.from('badges').select('key').eq('key', key)
    expect(back).toEqual([{ key }])
    const { data: kept } = await supabaseAdmin.from('member_badges').select('member_id').eq('badge_key', key)
    expect(kept).toEqual([{ member_id: users.holderA.id }])
    expectError((await restore(board, key)).error, '22023', 'admin:invalid_argument')
  })

  it('revoking writes the name snapshot too', async () => {
    const key = keyFor('revoked')
    expect((await create(board, key, { name: texts('Insígnia retirable') })).error).toBeNull()
    expect((await award(board, users.holderB.id, key)).error).toBeNull()
    expect((await revoke(board, users.holderB.id, key)).error).toBeNull()
    const entries = await catalogueEntries(key, 'badge.revoke')
    expect(entries).toHaveLength(1)
    expect(entries[0].details).toMatchObject({ badge: key, name: 'Insígnia retirable' })
    expect(await listed(key)).toMatchObject({ holders: 0, active_holders: 0, ever_awarded: true })
  })

  it('archive and restore are board only and answer not_found for an unknown badge', async () => {
    expectError((await archive(member, 'ludoteca_donor')).error, '42501', 'admin:forbidden')
    expectError((await restore(member, 'ludoteca_donor')).error, '42501', 'admin:forbidden')
    expectError((await archive(board, `${RUN}_nobody`)).error, '22023', 'admin:not_found')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_list_badges() (S2)', () => {
  it('lists every badge with holders, active holders and whether it was ever awarded', async () => {
    const key = keyFor('listed')
    expect((await create(board, key)).error).toBeNull()
    expect(await listed(key)).toMatchObject({
      key,
      icon: 'dice',
      show_locked: true,
      archived_at: null,
      holders: 0,
      active_holders: 0,
      ever_awarded: false,
    })

    // A former member counts as a holder, not as an active one.
    expect((await supabaseAdmin.from('member_badges').insert({ member_id: users.former.id, badge_key: key })).error).toBeNull()
    expect(await listed(key)).toMatchObject({ holders: 1, active_holders: 0, ever_awarded: true })
  })

  it('orders by sort_order and is board only', async () => {
    const { data } = await board.rpc('admin_list_badges')
    const orders = (data as Array<{ sort_order: number }>).map((r) => r.sort_order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expectError((await member.rpc('admin_list_badges')).error, '42501', 'admin:forbidden')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_delete_badge() (S2)', () => {
  it('is superadmin only: the board gets forbidden and nothing is deleted', async () => {
    const key = keyFor('undeletable')
    expect((await create(board, key)).error).toBeNull()
    expectError((await board.rpc('admin_delete_badge', { p_key: key })).error, '42501', 'admin:forbidden')
    const { data } = await supabaseAdmin.from('badges').select('key').eq('key', key)
    expect(data).toEqual([{ key }])
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_award_badge_bulk() (S4)', () => {
  const bulk = (client: SupabaseClient, key: string, ids: unknown, note: string | null = null) =>
    client.rpc('admin_award_badge_bulk', { p_badge_key: key, p_member_ids: ids, p_note: note })

  it('awards to every active member who does not hold it yet, one audit entry each', async () => {
    const key = keyFor('bulk')
    expect((await create(board, key, { name: texts('Voluntariat fira') })).error).toBeNull()
    expect((await award(board, users.holderA.id, key)).error).toBeNull()

    const { data, error } = await bulk(board, key, [users.holderA.id, users.holderB.id, users.holderC.id, users.holderB.id], 'Fira 2026')
    expect(error).toBeNull()
    expect(data).toEqual([{ awarded: 2, skipped: 1 }])

    const { data: rows } = await supabaseAdmin.from('member_badges').select('member_id, awarded_by').eq('badge_key', key)
    expect(rows!.map((r) => r.member_id).sort()).toEqual([users.holderA.id, users.holderB.id, users.holderC.id].sort())

    const entries = await catalogueEntries(key, 'badge.award')
    expect(entries).toHaveLength(3) // the single award plus two from the bulk call
    const bulkEntries = entries.filter((e) => e.reason === 'Fira 2026')
    expect(bulkEntries.map((e) => e.target_member_id).sort()).toEqual([users.holderB.id, users.holderC.id].sort())
    for (const e of bulkEntries) expect(e.details).toMatchObject({ badge: key, name: 'Voluntariat fira' })
  })

  it('is all or nothing: a former or unknown member in the list awards nobody', async () => {
    const key = keyFor('bulk_atomic')
    expect((await create(board, key)).error).toBeNull()
    expectError((await bulk(board, key, [users.holderA.id, users.former.id])).error, '22023', 'admin:not_active')
    expectError(
      (await bulk(board, key, [users.holderA.id, '00000000-0000-0000-0000-000000000000'])).error,
      '22023',
      'admin:not_found'
    )
    const { data } = await supabaseAdmin.from('member_badges').select('member_id').eq('badge_key', key)
    expect(data).toEqual([])
    expect(await catalogueEntries(key, 'badge.award')).toEqual([])
  })

  it('validates the list, the badge, the note and the caller', async () => {
    const key = keyFor('bulk_invalid')
    expect((await create(board, key)).error).toBeNull()
    expectError((await bulk(board, key, [])).error, '22023', 'admin:invalid_argument')
    expectError((await bulk(board, key, null)).error, '22023', 'admin:invalid_argument')
    const many = Array.from({ length: 101 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`)
    expectError((await bulk(board, key, many)).error, '22023', 'admin:invalid_argument')
    expectError((await bulk(board, 'made_up', [users.holderA.id])).error, '22023', 'admin:invalid_argument')
    expectError((await bulk(board, key, [users.holderA.id], 'x'.repeat(501))).error, '22023', 'admin:reason_too_long')
    expectError((await bulk(member, key, [users.holderA.id])).error, '42501', 'admin:forbidden')

    expect((await archive(board, key)).error).toBeNull()
    expectError((await bulk(board, key, [users.holderA.id])).error, '22023', 'admin:badge_archived')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_get_member() badges (S3)', () => {
  it('carries each badge name, icon and whether it is archived', async () => {
    const key = keyFor('in_file')
    expect((await create(board, key, { name: texts('A la fitxa'), icon: 'medal' })).error).toBeNull()
    expect((await award(board, users.holderC.id, key)).error).toBeNull()
    expect((await archive(board, key)).error).toBeNull()

    const { data: row } = await supabaseAdmin.from('members').select('member_number').eq('id', users.holderC.id).single()
    const { data, error } = await board.rpc('admin_get_member', { p_member_number: row!.member_number })
    expect(error).toBeNull()
    const badge = (data[0].badges as Array<Record<string, unknown>>).find((b) => b.badge_key === key)
    expect(badge).toMatchObject({ badge_key: key, name: { ca: 'A la fitxa' }, icon: 'medal', archived: true })
  })
})
