import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const session = vi.hoisted(() => ({ user: null as { id: string } | null }))

vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }))
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn(async (_req: unknown, response: NextResponse) => ({
    response,
    user: session.user,
  })),
}))

import middleware from '@/proxy'

async function visit(path: string) {
  return middleware(new NextRequest(new URL(path, 'http://localhost')))
}

function loginRedirect(res: Response) {
  const location = res.headers.get('location')
  return location ? new URL(location) : null
}

describe('proxy admin protection', () => {
  beforeEach(() => {
    session.user = null
  })

  it.each([
    ['/admin', '/login'],
    ['/admin/members', '/login'],
    ['/admin/roles', '/login'],
    ['/admin/members/000-001', '/login'],
    ['/es/admin/activity', '/es/login'],
    ['/en/admin/tools/event-images', '/en/login'],
    ['/admin/tools', '/login'],
  ])('sends an anonymous visitor of %s to %s', async (path, login) => {
    const url = loginRedirect(await visit(path))
    expect(url?.pathname).toBe(login)
    expect(url?.searchParams.get('redirect')).toBe(path)
  })

  it('does not treat a path that only starts with "admin" as an admin route', async () => {
    expect(loginRedirect(await visit('/administration'))).toBeNull()
  })

  it('lets a signed-in user through (the page checks the role)', async () => {
    session.user = { id: 'u1' }
    expect(loginRedirect(await visit('/admin/roles'))).toBeNull()
  })
})
