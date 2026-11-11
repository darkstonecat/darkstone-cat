import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  supabaseAdmin,
  createTestUser,
  createAuthenticatedClient,
  cleanupUsers,
  runSqlAsPostgres,
} from '../helpers/supabase'

// Migration 20261111100000_member_benefits.sql: public.member_benefits, read by active members
// only, written only through the audited admin_*_benefit functions.
// Spec: odd/tasks/member-benefits.md S3-S4.
//
// Every user and every benefit created here belongs to this file; the seeded Outlet Games row is
// only read. Audit entries cannot be deleted, so assertions filter by this file's benefit ids.

const password = 'password123'
const DOMAIN = 'member-benefits.test'
const emails = {
  board: `mb-board@${DOMAIN}`,
  member: `mb-member@${DOMAIN}`,
  former: `mb-former@${DOMAIN}`,
}
type Key = keyof typeof emails
const users = {} as Record<Key, { id: string }>
const userIds: string[] = []
let board: SupabaseClient
let member: SupabaseClient
let former: SupabaseClient

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  { auth: { persistSession: false } }
)

const createdIds: string[] = []

type CreateArgs = Partial<{ name: unknown; description: unknown; url: unknown; code: unknown; collaborator: unknown }>

async function create(client: SupabaseClient, over: CreateArgs = {}) {
  const result = await client.rpc('admin_create_benefit', {
    p_name: 'name' in over ? over.name : { ca: 'Botiga prova', es: 'Tienda prueba' },
    p_description: 'description' in over ? over.description : { ca: 'Descompte de prova.' },
    p_url: 'url' in over ? over.url : 'https://example.com/shop',
    p_discount_code: 'code' in over ? over.code : 'PROVA10',
    p_collaborator_id: 'collaborator' in over ? over.collaborator : 'outlet-games',
  })
  if (typeof result.data === 'string') createdIds.push(result.data)
  return result
}

async function createOk(over: CreateArgs = {}) {
  const { data, error } = await create(board, over)
  expect(error).toBeNull()
  return data as string
}

async function entries(id: string, action: string) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('actor_id, action, target_member_id, details')
    .eq('action', action)
    .filter('details->>benefit', 'eq', id)
    .order('id')
  expect(error).toBeNull()
  return data!
}

async function listed(id: string) {
  const { data, error } = await board.rpc('admin_list_benefits')
  expect(error).toBeNull()
  return (data as Array<Record<string, unknown>>).find((row) => row.id === id)
}

async function visibleTo(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('member_benefits').select('id, discount_code').eq('id', id)
  expect(error).toBeNull()
  return data!.length === 1
}

function expectError(error: { code?: string; message?: string } | null, code: string, prefix: string) {
  expect(error?.code).toBe(code)
  expect(error?.message).toContain(prefix)
}

beforeAll(async () => {
  for (const key of Object.keys(emails) as Key[]) {
    users[key] = await createTestUser(emails[key], password, { first_name: `Nom${key}`, last_name: 'Beneficis' })
    userIds.push(users[key].id)
  }
  expect((await supabaseAdmin.from('members').update({ role: 'board' }).eq('id', users.board.id)).error).toBeNull()
  board = await createAuthenticatedClient(emails.board, password)
  member = await createAuthenticatedClient(emails.member, password)
  // Signed in before leaving, so the session outlives the leave (as a stolen or stale token would).
  former = await createAuthenticatedClient(emails.former, password)
  expect(
    (await supabaseAdmin.from('members').update({ left_on: '2026-10-01', left_by: 'self' }).eq('id', users.former.id))
      .error
  ).toBeNull()
})

afterAll(async () => {
  if (createdIds.length > 0) {
    // No API role may write the table, so the cleanup runs as the table owner.
    await runSqlAsPostgres('DELETE FROM public.member_benefits WHERE id = ANY($1::uuid[])', [createdIds])
  }
  await cleanupUsers(userIds)
})

// ---------------------------------------------------------------------------------------------
describe('public.member_benefits read access (S3)', () => {
  it('seeds Outlet Games with the code DARKSTONE and its logo', async () => {
    const { data, error } = await member
      .from('member_benefits')
      .select('name, discount_code, url, collaborator_id')
      .eq('collaborator_id', 'outlet-games')
    expect(error).toBeNull()
    expect(data).toEqual([
      {
        name: { ca: 'Outlet Games', es: 'Outlet Games', en: 'Outlet Games' },
        discount_code: 'DARKSTONE',
        url: 'https://outletgames.es',
        collaborator_id: 'outlet-games',
      },
    ])
  })

  it('an active member reads it; an anonymous visitor and a former member read nothing', async () => {
    const id = await createOk()
    expect(await visibleTo(member, id)).toBe(true)

    const anonRead = await anon.from('member_benefits').select('id')
    expect(anonRead.error?.code).toBe('42501')

    const formerRead = await former.from('member_benefits').select('id')
    expect(formerRead.error).toBeNull()
    expect(formerRead.data).toEqual([])
  })

  it('nobody writes the table through the API, not even the service role', async () => {
    const row = { name: { ca: 'X' }, description: { ca: 'X' }, url: 'https://x.example' }
    expect((await member.from('member_benefits').insert(row)).error?.code).toBe('42501')
    expect((await board.from('member_benefits').insert(row)).error?.code).toBe('42501')
    expect((await supabaseAdmin.from('member_benefits').insert(row)).error?.code).toBe('42501')
    expect(
      (await supabaseAdmin.from('member_benefits').update({ discount_code: 'HACK' }).eq('collaborator_id', 'outlet-games'))
        .error?.code
    ).toBe('42501')
  })
})

// ---------------------------------------------------------------------------------------------
describe('admin_*_benefit functions (S4)', () => {
  it('only the board calls them', async () => {
    expectError((await create(member)).error, '42501', 'admin:forbidden')
    expectError((await member.rpc('admin_list_benefits')).error, '42501', 'admin:forbidden')
    expect((await anon.rpc('admin_list_benefits')).error?.code).toBe('42501')
  })

  it('creates a benefit at the end, trimmed, with one audit entry holding the Catalan name', async () => {
    const id = await createOk({
      name: { ca: '  Botiga nova  ' },
      code: '  NOU5 ',
      collaborator: '',
    })
    const row = await listed(id)
    expect(row).toMatchObject({
      name: { ca: 'Botiga nova' },
      discount_code: 'NOU5',
      collaborator_id: null,
      url: 'https://example.com/shop',
      archived_at: null,
    })
    expect(row!.sort_order as number).toBeGreaterThanOrEqual(20)

    const audit = await entries(id, 'benefit.create')
    expect(audit).toEqual([
      {
        actor_id: users.board.id,
        action: 'benefit.create',
        target_member_id: null,
        details: { benefit: id, name: 'Botiga nova' },
      },
    ])
  })

  it('a benefit without a code stores null', async () => {
    const id = await createOk({ code: null })
    expect((await listed(id))!.discount_code).toBeNull()
  })

  it('refuses invalid texts, links, codes and logos', async () => {
    const bad: CreateArgs[] = [
      { name: { es: 'Sense català' } },
      { name: { ca: 'x'.repeat(61) } },
      { description: { ca: 'x'.repeat(201) } },
      { url: 'http://example.com' },
      { url: 'https://exa mple.com' },
      { url: `https://example.com/${'x'.repeat(300)}` },
      { code: 'AMB ESPAI' },
      { code: 'x'.repeat(41) },
      { collaborator: 'Not A Slug' },
    ]
    for (const over of bad) {
      expectError((await create(board, over)).error, '22023', 'admin:invalid_argument')
    }
  })

  it('updates only the given fields and returns them; the audit lists fields, never the code', async () => {
    const id = await createOk()
    const { data, error } = await board.rpc('admin_update_benefit', {
      p_id: id,
      p_patch: { discount_code: 'SECRET99', name: { ca: 'Botiga canviada', en: 'Changed shop' } },
    })
    expect(error).toBeNull()
    expect(data).toEqual(['name', 'discount_code'])
    expect(await listed(id)).toMatchObject({ discount_code: 'SECRET99', name: { ca: 'Botiga canviada', en: 'Changed shop' } })

    const audit = await entries(id, 'benefit.update')
    expect(audit).toHaveLength(1)
    expect(audit[0].details).toEqual({ benefit: id, name: 'Botiga canviada', fields: ['name', 'discount_code'] })
    expect(JSON.stringify(audit[0].details)).not.toContain('SECRET99')
  })

  it('clears the code and the logo with null or an empty string', async () => {
    const id = await createOk()
    const { data, error } = await board.rpc('admin_update_benefit', {
      p_id: id,
      p_patch: { discount_code: null, collaborator_id: '' },
    })
    expect(error).toBeNull()
    expect(data).toEqual(['discount_code', 'collaborator_id'])
    expect(await listed(id)).toMatchObject({ discount_code: null, collaborator_id: null })
  })

  it('refuses unknown fields, bad values, an empty patch, no change and an unknown id', async () => {
    const id = await createOk()
    const update = (patch: unknown, target = id) => board.rpc('admin_update_benefit', { p_id: target, p_patch: patch })
    expectError((await update({ archived_at: null })).error, '22023', 'admin:invalid_argument')
    expectError((await update({ url: 'ftp://x' })).error, '22023', 'admin:invalid_argument')
    expectError((await update({ url: 5 })).error, '22023', 'admin:invalid_argument')
    expectError((await update({ sort_order: 1.5 })).error, '22023', 'admin:invalid_argument')
    expectError((await update({})).error, '22023', 'admin:invalid_argument')
    expectError((await update({ discount_code: 'PROVA10' })).error, '22023', 'admin:no_value')
    expectError(
      (await update({ sort_order: 1 }, '00000000-0000-0000-0000-000000000000')).error,
      '22023',
      'admin:not_found'
    )
  })

  it('archive hides it from members, restore shows it again, each with one audit entry', async () => {
    const id = await createOk({ name: { ca: 'Per arxivar' } })

    expect((await board.rpc('admin_archive_benefit', { p_id: id })).error).toBeNull()
    expect(await visibleTo(member, id)).toBe(false)
    expect((await listed(id))!.archived_at).not.toBeNull()
    expectError((await board.rpc('admin_archive_benefit', { p_id: id })).error, '22023', 'admin:benefit_archived')

    expect((await board.rpc('admin_restore_benefit', { p_id: id })).error).toBeNull()
    expect(await visibleTo(member, id)).toBe(true)
    expectError((await board.rpc('admin_restore_benefit', { p_id: id })).error, '22023', 'admin:invalid_argument')

    expect((await entries(id, 'benefit.archive')).map((e) => e.details)).toEqual([{ benefit: id, name: 'Per arxivar' }])
    expect((await entries(id, 'benefit.restore')).map((e) => e.details)).toEqual([{ benefit: id, name: 'Per arxivar' }])
  })

  it('a member cannot archive, restore or update', async () => {
    const id = await createOk()
    expectError((await member.rpc('admin_archive_benefit', { p_id: id })).error, '42501', 'admin:forbidden')
    expectError((await member.rpc('admin_restore_benefit', { p_id: id })).error, '42501', 'admin:forbidden')
    expectError(
      (await member.rpc('admin_update_benefit', { p_id: id, p_patch: { sort_order: 1 } })).error,
      '42501',
      'admin:forbidden'
    )
  })
})
