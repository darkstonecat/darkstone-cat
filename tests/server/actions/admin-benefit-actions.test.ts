import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

type Result = { data: unknown; error: { code?: string; message: string } | null }

const db = vi.hoisted(() => ({
  access: { status: 'ok', actor: { id: 'actor-id', role: 'board' } } as
    | { status: 'ok'; actor: { id: string; role: string } }
    | { status: 'unauthenticated' }
    | { status: 'forbidden' },
  rpc: vi.fn(),
  results: {} as Record<string, Result>,
  revalidatePath: vi.fn(),
  getAdminAccess: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: db.revalidatePath }))
vi.mock('@/lib/admin/guard', () => ({
  getAdminAccess: async (min: string) => (db.getAdminAccess(min), db.access),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: unknown) => (db.rpc(fn, args), db.results[fn] ?? { data: null, error: null }),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('the service role must never be used by benefit actions')
  },
}))

import { archiveBenefit, createBenefit, restoreBenefit, updateBenefit } from '@/lib/admin/benefit-actions'

const ID = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const INPUT = {
  name: { ca: 'Outlet Games', es: '', en: '' },
  description: { ca: 'Descompte amb el codi.', es: '', en: '' },
  url: 'https://outletgames.es',
  discountCode: 'DARKSTONE',
  collaboratorId: 'outlet-games',
}
const PAGES = [
  ['/[locale]/admin/benefits', 'page'],
  ['/[locale]/profile/details', 'page'],
]

let consoleSpies: MockInstance[]
const consoleOutput = () => consoleSpies.flatMap((spy) => spy.mock.calls.flat()).map(String).join('\n')

beforeEach(() => {
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'board' } }
  db.results = {}
  db.rpc.mockReset()
  db.revalidatePath.mockReset()
  db.getAdminAccess.mockReset()
  consoleSpies = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {})]
})

describe('createBenefit', () => {
  it('creates through admin_create_benefit with the board guard and refreshes the pages', async () => {
    db.results.admin_create_benefit = { data: ID, error: null }
    expect(await createBenefit({ ...INPUT, sortOrder: 5 })).toEqual({ ok: true, id: ID })
    expect(db.getAdminAccess).toHaveBeenCalledWith('board')
    expect(db.rpc).toHaveBeenCalledWith('admin_create_benefit', {
      p_name: { ca: 'Outlet Games' },
      p_description: { ca: 'Descompte amb el codi.' },
      p_url: 'https://outletgames.es',
      p_discount_code: 'DARKSTONE',
      p_collaborator_id: 'outlet-games',
    })
    expect(db.revalidatePath.mock.calls).toEqual(PAGES)
  })

  it('answers the guard error without touching the database', async () => {
    db.access = { status: 'forbidden' }
    expect(await createBenefit(INPUT)).toEqual({ error: 'forbidden' })
    db.access = { status: 'unauthenticated' }
    expect(await createBenefit(INPUT)).toEqual({ error: 'unauthenticated' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('names the invalid field and sends nothing', async () => {
    expect(await createBenefit({ ...INPUT, url: 'http://x.es' })).toEqual({ error: 'invalid', field: 'url' })
    expect(await createBenefit({ ...INPUT, collaboratorId: 'trollcave' })).toEqual({ error: 'invalid', field: 'collaboratorId' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('maps a name that looks like a phone, and logs only the code', async () => {
    db.results.admin_create_benefit = {
      data: null,
      error: { code: '23514', message: 'audit:sensitive_details: details hold a DNI or phone 600123456' },
    }
    expect(await createBenefit(INPUT)).toEqual({ error: 'benefit_text_sensitive' })
    expect(consoleOutput()).toContain('create_benefit')
    expect(consoleOutput()).not.toContain('600123456')
    expect(consoleOutput()).not.toContain('DARKSTONE')
  })
})

describe('updateBenefit', () => {
  it('sends every field and returns what changed', async () => {
    db.results.admin_update_benefit = { data: ['discount_code'], error: null }
    expect(await updateBenefit(ID, { ...INPUT, discountCode: 'NOU', sortOrder: 20 })).toEqual({
      ok: true,
      changed: ['discount_code'],
    })
    expect(db.rpc).toHaveBeenCalledWith('admin_update_benefit', {
      p_id: ID,
      p_patch: {
        name: { ca: 'Outlet Games' },
        description: { ca: 'Descompte amb el codi.' },
        url: 'https://outletgames.es',
        discount_code: 'NOU',
        collaborator_id: 'outlet-games',
        sort_order: 20,
      },
    })
    expect(db.revalidatePath.mock.calls).toEqual(PAGES)
  })

  it('maps no change and refuses a bad id', async () => {
    db.results.admin_update_benefit = { data: null, error: { code: '22023', message: 'admin:no_value: nothing to change' } }
    expect(await updateBenefit(ID, INPUT)).toEqual({ error: 'no_value' })
    db.rpc.mockReset()
    expect(await updateBenefit('not-a-uuid', INPUT)).toEqual({ error: 'not_found' })
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

describe('archiveBenefit / restoreBenefit', () => {
  it('call their function with the id', async () => {
    expect(await archiveBenefit(ID)).toEqual({ ok: true })
    expect(await restoreBenefit(ID)).toEqual({ ok: true })
    expect(db.rpc.mock.calls).toEqual([
      ['admin_archive_benefit', { p_id: ID }],
      ['admin_restore_benefit', { p_id: ID }],
    ])
  })

  it('map an already archived benefit', async () => {
    db.results.admin_archive_benefit = {
      data: null,
      error: { code: '22023', message: 'admin:benefit_archived: the benefit is already archived' },
    }
    expect(await archiveBenefit(ID)).toEqual({ error: 'benefit_archived' })
  })
})
