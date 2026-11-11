import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

type Result = { data: unknown; error: { code?: string; message: string } | null }

const db = vi.hoisted(() => ({
  access: { status: 'ok', actor: { id: 'actor-id', role: 'board' } } as
    | { status: 'ok'; actor: { id: string; role: string } }
    | { status: 'unauthenticated' }
    | { status: 'forbidden' },
  rpc: vi.fn(),
  /** Result per RPC name; anything not listed answers `{ data: null, error: null }`. */
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
    throw new Error('the service role must never be used by badge actions')
  },
}))

import {
  archiveBadge,
  awardBadgeToMembers,
  createBadge,
  deleteBadge,
  listBadgeHolders,
  listBadges,
  restoreBadge,
  searchMembersForBadge,
  updateBadge,
} from '@/lib/admin/badge-actions'

const KEY = 'fira_2026'
const A = '0b7c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const B = '9f8e7d6c-5b4a-4321-8fed-cba987654321'
const NEW = { key: KEY, name: 'Fira 2026', earnedText: 'Hi vas ser.', lockedText: 'Vine a la fira.' }
const SENSITIVE = { code: '23514', message: 'audit:sensitive_details: details hold a DNI or phone 600123456' }

const BADGE_PAGES = [
  ['/[locale]/admin/badges', 'page'],
  ['/[locale]/admin/badges/[key]', 'page'],
]
const MEMBER_PAGES = [
  ['/[locale]/admin/members/(list)', 'page'],
  ['/[locale]/admin/members/[number]', 'page'],
]

let consoleSpies: MockInstance[]
function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .map((call) => call.map((a: unknown) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    .join('\n')
}

beforeEach(() => {
  vi.clearAllMocks()
  db.access = { status: 'ok', actor: { id: 'actor-id', role: 'board' } }
  db.results = {}
  consoleSpies = (['error', 'warn', 'log', 'info'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
})

const rpcCalls = () => db.rpc.mock.calls as [string, Record<string, unknown>][]
const revalidated = () => db.revalidatePath.mock.calls

// ---------------------------------------------------------------------------------------------
describe('guard (every action)', () => {
  const calls: [string, 'board' | 'superadmin', () => Promise<unknown>][] = [
    ['listBadges', 'board', () => listBadges()],
    ['createBadge', 'board', () => createBadge(NEW)],
    ['updateBadge', 'board', () => updateBadge(KEY, { icon: 'dice' })],
    ['archiveBadge', 'board', () => archiveBadge(KEY)],
    ['restoreBadge', 'board', () => restoreBadge(KEY)],
    ['deleteBadge', 'superadmin', () => deleteBadge(KEY)],
    ['awardBadgeToMembers', 'board', () => awardBadgeToMembers(KEY, [A])],
    ['searchMembersForBadge', 'board', () => searchMembersForBadge(KEY, 'laia')],
    ['listBadgeHolders', 'board', () => listBadgeHolders(KEY)],
  ]

  it.each(calls)('%s checks the %s level first', async (_name, level, call) => {
    await call()
    expect(db.getAdminAccess).toHaveBeenCalledWith(level)
  })

  it.each(calls)('%s requires a session', async (_name, _level, call) => {
    db.access = { status: 'unauthenticated' }
    expect(await call()).toEqual({ error: 'unauthenticated' })
    expect(db.rpc).not.toHaveBeenCalled()
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })

  it.each(calls)('%s requires the role', async (_name, _level, call) => {
    db.access = { status: 'forbidden' }
    expect(await call()).toEqual({ error: 'forbidden' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['updateBadge', () => updateBadge('Not A Key', { icon: 'dice' })],
    ['archiveBadge', () => archiveBadge('x')],
    ['restoreBadge', () => restoreBadge('member_tenure')],
    ['deleteBadge', () => deleteBadge(42 as unknown as string)],
    ['awardBadgeToMembers', () => awardBadgeToMembers('bad key', [A])],
    ['searchMembersForBadge', () => searchMembersForBadge('', 'laia')],
    ['listBadgeHolders', () => listBadgeHolders('__proto__')],
  ])('%s refuses a malformed key without a database call', async (_name, call) => {
    expect(await call()).toEqual({ error: 'invalid_badge' })
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
describe('listBadges', () => {
  it('returns the admin_list_badges rows', async () => {
    const rows = [{ key: KEY, holders: 2 }]
    db.results.admin_list_badges = { data: rows, error: null }
    expect(await listBadges()).toEqual({ ok: true, badges: rows })
    expect(rpcCalls()).toEqual([['admin_list_badges', {}]])
  })

  it('maps a database error and logs only the action and code', async () => {
    db.results.admin_list_badges = { data: null, error: { code: '42501', message: 'admin:forbidden: board role required' } }
    expect(await listBadges()).toEqual({ error: 'forbidden' })
    expect(consoleOutput()).toBe('[admin-badge] %s failed code=%s list_badges 42501')
  })
})

// ---------------------------------------------------------------------------------------------
describe('createBadge (S7.4)', () => {
  it('creates with Catalan texts and the "star" icon through admin_create_badge', async () => {
    expect(await createBadge({ ...NEW, name: '  Fira 2026 ' })).toEqual({ ok: true, key: KEY })
    expect(rpcCalls()).toEqual([
      [
        'admin_create_badge',
        {
          p_key: KEY,
          p_name: { ca: 'Fira 2026' },
          p_earned_text: { ca: 'Hi vas ser.' },
          p_locked_text: { ca: 'Vine a la fira.' },
          p_icon: 'star',
          p_show_locked: true,
        },
      ],
    ])
    expect(revalidated()).toEqual(BADGE_PAGES)
  })

  it.each([
    ['key', { key: 'Fira 2026' }],
    ['name', { name: '' }],
    ['earnedText', { earnedText: 'x'.repeat(201) }],
    ['lockedText', { lockedText: null }],
  ])('validates %s before the database', async (field, over) => {
    expect(await createBadge({ ...NEW, ...over } as typeof NEW)).toEqual({ error: 'invalid', field })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('refuses input that is not an object', async () => {
    expect(await createBadge(null as unknown as typeof NEW)).toEqual({ error: 'invalid' })
  })

  it.each([
    [{ code: '22023', message: 'admin:badge_exists: a badge with this key already exists' }, 'badge_exists'],
    [SENSITIVE, 'badge_text_sensitive'],
    [{ code: '22023', message: 'admin:invalid_argument: unknown icon' }, 'invalid'],
    [{ code: 'XX000', message: 'something else' }, 'failed'],
  ])('maps %j to %s without revalidating', async (error, expected) => {
    db.results.admin_create_badge = { data: null, error }
    expect(await createBadge(NEW)).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
    expect(consoleOutput()).not.toContain('600123456')
  })
})

// ---------------------------------------------------------------------------------------------
describe('updateBadge (S7.3)', () => {
  it('sends the mapped patch and returns the changed fields in the UI names', async () => {
    db.results.admin_update_badge = { data: ['name', 'sort_order', 'show_locked'], error: null }
    const result = await updateBadge(KEY, {
      name: { ca: ' Fira ', es: ' Feria ', en: '' },
      sortOrder: 30,
      showLocked: false,
    })
    expect(result).toEqual({ ok: true, changed: ['name', 'sortOrder', 'showLocked'] })
    expect(rpcCalls()).toEqual([
      ['admin_update_badge', { p_key: KEY, p_patch: { name: { ca: 'Fira', es: 'Feria' }, sort_order: 30, show_locked: false } }],
    ])
    expect(revalidated()).toEqual([...BADGE_PAGES, ...MEMBER_PAGES])
  })

  it('validates the patch before the database', async () => {
    expect(await updateBadge(KEY, { icon: 'rocket' as never })).toEqual({ error: 'invalid', field: 'icon' })
    expect(await updateBadge(KEY, { key: 'other' } as never)).toEqual({ error: 'invalid', field: 'key' })
    expect(await updateBadge(KEY, {})).toEqual({ error: 'no_value' })
    expect(await updateBadge(KEY, null as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    [{ code: '22023', message: 'admin:no_value: nothing to change' }, 'no_value'],
    [{ code: '22023', message: 'admin:not_found: unknown badge' }, 'not_found'],
    [SENSITIVE, 'badge_text_sensitive'],
  ])('maps %j to %s', async (error, expected) => {
    db.results.admin_update_badge = { data: null, error }
    expect(await updateBadge(KEY, { name: { ca: 'Fira' } })).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
describe('archiveBadge / restoreBadge / deleteBadge (S7.2, S7.6)', () => {
  it('archives through admin_archive_badge and revalidates the badge and member pages', async () => {
    expect(await archiveBadge(KEY)).toEqual({ ok: true })
    expect(rpcCalls()).toEqual([['admin_archive_badge', { p_key: KEY }]])
    expect(revalidated()).toEqual([...BADGE_PAGES, ...MEMBER_PAGES])
  })

  it('restores through admin_restore_badge', async () => {
    expect(await restoreBadge(KEY)).toEqual({ ok: true })
    expect(rpcCalls()).toEqual([['admin_restore_badge', { p_key: KEY }]])
    expect(revalidated()).toEqual([...BADGE_PAGES, ...MEMBER_PAGES])
  })

  it('deletes through admin_delete_badge and revalidates the badge pages only', async () => {
    db.access = { status: 'ok', actor: { id: 'actor-id', role: 'superadmin' } }
    expect(await deleteBadge(KEY)).toEqual({ ok: true })
    expect(rpcCalls()).toEqual([['admin_delete_badge', { p_key: KEY }]])
    expect(revalidated()).toEqual(BADGE_PAGES)
  })

  it.each([
    [() => archiveBadge(KEY), 'admin_archive_badge', 'admin:badge_archived: the badge is already archived', 'badge_archived'],
    [() => restoreBadge(KEY), 'admin_restore_badge', 'admin:invalid_argument: the badge is not archived', 'invalid'],
    [() => deleteBadge(KEY), 'admin_delete_badge', 'admin:badge_in_use: the badge was awarded; archive it instead', 'badge_in_use'],
    [() => deleteBadge(KEY), 'admin_delete_badge', 'admin:not_found: unknown badge', 'not_found'],
  ])('maps the %# database error', async (call, fn, message, expected) => {
    db.results[fn] = { data: null, error: { code: '22023', message } }
    expect(await call()).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
describe('awardBadgeToMembers (S7.5)', () => {
  it('awards through admin_award_badge_bulk with clean ids and note, and returns the counts', async () => {
    db.results.admin_award_badge_bulk = { data: [{ awarded: 1, skipped: 1 }], error: null }
    expect(await awardBadgeToMembers(KEY, [A.toUpperCase(), B, A], '  Fira 2026 ')).toEqual({ ok: true, awarded: 1, skipped: 1 })
    expect(rpcCalls()).toEqual([['admin_award_badge_bulk', { p_badge_key: KEY, p_member_ids: [A, B], p_note: 'Fira 2026' }]])
    expect(revalidated()).toEqual([...BADGE_PAGES, ...MEMBER_PAGES])
  })

  it('sends a blank or missing note as null', async () => {
    db.results.admin_award_badge_bulk = { data: [{ awarded: 1, skipped: 0 }], error: null }
    await awardBadgeToMembers(KEY, [A])
    await awardBadgeToMembers(KEY, [A], '   ')
    expect(rpcCalls().map(([, args]) => args.p_note)).toEqual([null, null])
  })

  it('validates the ids and the note before the database', async () => {
    const many = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(await awardBadgeToMembers(KEY, [])).toEqual({ error: 'invalid' })
    expect(await awardBadgeToMembers(KEY, many)).toEqual({ error: 'invalid' })
    expect(await awardBadgeToMembers(KEY, [A, '000-203'])).toEqual({ error: 'invalid' })
    expect(await awardBadgeToMembers(KEY, [A], 'x'.repeat(501))).toEqual({ error: 'reason_too_long' })
    expect(await awardBadgeToMembers(KEY, [A], 5 as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['admin:badge_archived: the badge is archived', 'badge_archived'],
    ['admin:invalid_argument: unknown badge', 'invalid_badge'],
    ['admin:not_active: a former member cannot get a badge', 'not_active'],
    ['admin:not_found: unknown member', 'not_found'],
    ['audit:sensitive_details: details hold a DNI or phone', 'badge_text_sensitive'],
  ])('maps %s to %s', async (message, expected) => {
    db.results.admin_award_badge_bulk = { data: null, error: { code: '22023', message } }
    expect(await awardBadgeToMembers(KEY, [A])).toEqual({ error: expected })
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------
const holderRow = (id: string, state = 'active') => ({
  member_id: id,
  member_number: '000-001',
  first_name: 'Laia',
  last_name: 'Serra',
  state,
  awarded_at: '2026-03-01T10:00:00+00:00',
})

describe('listBadgeHolders (S7.3)', () => {
  it('reads admin_list_badge_holders and maps the rows', async () => {
    db.results.admin_list_badge_holders = { data: [holderRow(A), holderRow(B, 'former')], error: null }
    expect(await listBadgeHolders(KEY)).toEqual({
      ok: true,
      holders: [
        { memberId: A, memberNumber: '000-001', firstName: 'Laia', lastName: 'Serra', state: 'active', awardedAt: '2026-03-01T10:00:00+00:00' },
        { memberId: B, memberNumber: '000-001', firstName: 'Laia', lastName: 'Serra', state: 'former', awardedAt: '2026-03-01T10:00:00+00:00' },
      ],
    })
    expect(rpcCalls()).toEqual([['admin_list_badge_holders', { p_key: KEY }]])
    expect(db.revalidatePath).not.toHaveBeenCalled()
  })

  it('answers not_found for an unknown badge', async () => {
    db.results.admin_list_badge_holders = { data: null, error: { code: '22023', message: 'admin:not_found: unknown badge' } }
    expect(await listBadgeHolders(KEY)).toEqual({ error: 'not_found' })
  })
})

describe('searchMembersForBadge (S7.5)', () => {
  const member = (id: string, number: string) => ({ id, member_number: number, first_name: 'Laia', last_name: 'Serra', state: 'active', total_count: 2 })

  it('searches active members (20 at most, by name) and marks who already holds the badge', async () => {
    db.results.admin_list_members = { data: [member(A, '000-001'), member(B, '000-002')], error: null }
    db.results.admin_list_badge_holders = { data: [holderRow(B)], error: null }

    expect(await searchMembersForBadge(KEY, '  laia ')).toEqual({
      ok: true,
      members: [
        { id: A, memberNumber: '000-001', firstName: 'Laia', lastName: 'Serra', alreadyHolds: false },
        { id: B, memberNumber: '000-002', firstName: 'Laia', lastName: 'Serra', alreadyHolds: true },
      ],
    })
    expect(rpcCalls()).toContainEqual([
      'admin_list_members',
      { p_state: 'active', p_role: null, p_q: 'laia', p_sort: 'name_asc', p_limit: 20, p_offset: 0 },
    ])
    expect(rpcCalls()).toContainEqual(['admin_list_badge_holders', { p_key: KEY }])
  })

  it('sends a blank query as null (the first 20 active members)', async () => {
    db.results.admin_list_members = { data: [], error: null }
    db.results.admin_list_badge_holders = { data: [], error: null }
    expect(await searchMembersForBadge(KEY, '  ')).toEqual({ ok: true, members: [] })
    expect(rpcCalls().find(([fn]) => fn === 'admin_list_members')![1].p_q).toBeNull()
  })

  it('refuses a query that is not a string or is over 100 characters', async () => {
    expect(await searchMembersForBadge(KEY, 'x'.repeat(101))).toEqual({ error: 'invalid' })
    expect(await searchMembersForBadge(KEY, 3 as never)).toEqual({ error: 'invalid' })
    expect(db.rpc).not.toHaveBeenCalled()
  })

  it('maps an error of either read', async () => {
    db.results.admin_list_members = { data: [], error: null }
    db.results.admin_list_badge_holders = { data: null, error: { code: '22023', message: 'admin:not_found: unknown badge' } }
    expect(await searchMembersForBadge(KEY, 'laia')).toEqual({ error: 'not_found' })
    db.results.admin_list_badge_holders = { data: [], error: null }
    db.results.admin_list_members = { data: null, error: { code: 'XX000', message: 'boom' } }
    expect(await searchMembersForBadge(KEY, 'laia')).toEqual({ error: 'failed' })
  })
})
