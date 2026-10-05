import { describe, it, expect, vi, beforeEach } from 'vitest'

const nav = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: nav.notFound }))
vi.mock('@/i18n/routing', () => ({ redirect: nav.redirect }))
vi.mock('next-intl/server', () => ({ getLocale: vi.fn().mockResolvedValue('es') }))

import { createClient } from '@/lib/supabase/server'
import { getAdminAccess, requireRole } from '@/lib/admin/guard'

function setup(opts: {
  user?: { id: string } | null
  member?: { role: unknown; left_on: string | null } | null
  memberError?: { message: string } | null
}) {
  const eq = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: opts.member ?? null,
      error: opts.memberError ?? null,
    }),
  })
  const select = vi.fn().mockReturnValue({ eq })
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }) },
    from: vi.fn().mockReturnValue({ select }),
  }
  vi.mocked(createClient).mockResolvedValue(client as any)
  return { client, select, eq }
}

const user = { id: 'u1' }
const active = (role: string) => ({ role, left_on: null })

describe('getAdminAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is unauthenticated without a session', async () => {
    setup({ user: null })
    expect(await getAdminAccess('board')).toEqual({ status: 'unauthenticated' })
  })

  it('reads role and left_on of the signed-in member with the session client', async () => {
    const { client, select, eq } = setup({ user, member: active('board') })
    await getAdminAccess('board')
    expect(client.from).toHaveBeenCalledWith('members')
    expect(select.mock.calls[0][0]).toMatch(/role/)
    expect(select.mock.calls[0][0]).toMatch(/left_on/)
    expect(eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('denies a member', async () => {
    setup({ user, member: active('member') })
    expect(await getAdminAccess('board')).toEqual({ status: 'forbidden' })
  })

  it('lets a board member in for board but not for superadmin', async () => {
    setup({ user, member: active('board') })
    expect(await getAdminAccess('board')).toEqual({
      status: 'ok',
      actor: { id: 'u1', role: 'board' },
    })
    expect(await getAdminAccess('superadmin')).toEqual({ status: 'forbidden' })
  })

  it('treats the legacy admin role as board', async () => {
    setup({ user, member: active('admin') })
    expect((await getAdminAccess('board')).status).toBe('ok')
    expect((await getAdminAccess('superadmin')).status).toBe('forbidden')
  })

  it('lets a superadmin in for both levels', async () => {
    setup({ user, member: active('superadmin') })
    expect((await getAdminAccess('board')).status).toBe('ok')
    expect(await getAdminAccess('superadmin')).toEqual({
      status: 'ok',
      actor: { id: 'u1', role: 'superadmin' },
    })
  })

  it('denies a former member even if the row still holds a role', async () => {
    setup({ user, member: { role: 'superadmin', left_on: '2026-09-01' } })
    expect(await getAdminAccess('board')).toEqual({ status: 'forbidden' })
  })

  it('denies an unknown role', async () => {
    setup({ user, member: active('owner') })
    expect(await getAdminAccess('board')).toEqual({ status: 'forbidden' })
  })

  it('denies when the member row cannot be read', async () => {
    setup({ user, member: null, memberError: { message: 'boom' } })
    expect(await getAdminAccess('board')).toEqual({ status: 'forbidden' })
  })
})

describe('requireRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the actor when the role is enough', async () => {
    setup({ user, member: active('board') })
    expect(await requireRole('board')).toEqual({ id: 'u1', role: 'board' })
    expect(nav.notFound).not.toHaveBeenCalled()
  })

  it('redirects to the localized login without a session', async () => {
    setup({ user: null })
    await expect(requireRole('board')).rejects.toThrow('NEXT_REDIRECT')
    expect(nav.redirect).toHaveBeenCalledWith({ href: '/login', locale: 'es' })
  })

  it('renders not found for a member', async () => {
    setup({ user, member: active('member') })
    await expect(requireRole('board')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('renders not found for a board member on a superadmin page', async () => {
    setup({ user, member: active('board') })
    await expect(requireRole('superadmin')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('renders not found for a former member', async () => {
    setup({ user, member: { role: 'board', left_on: '2026-09-01' } })
    await expect(requireRole('board')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
