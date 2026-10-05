import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockUnsubscribe = vi.fn()
let authChangeCallback: ((event: string, session: any) => void) | null = null
const mockRoleQuery = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: vi.fn(
        (cb: (event: string, session: any) => void) => {
          authChangeCallback = cb
          return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
        }
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockRoleQuery,
        })),
      })),
    })),
  })),
}))

import { useAuthUser } from '@/hooks/useAuthUser'

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim()
    if (name) {
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`
    }
  })
}

describe('useAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authChangeCallback = null
    mockRoleQuery.mockResolvedValue({ data: { role: 'member' }, error: null })
    clearCookies()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  })

  it('resolves to null user without session cookie', async () => {
    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.role).toBeNull()
  })

  it('reads user from plain JSON session cookie', async () => {
    const session = { user: { id: 'u1', email: 'a@b.com' } }
    document.cookie = `sb-127-auth-token=${encodeURIComponent(
      JSON.stringify(session)
    )}`

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.user?.id).toBe('u1'))
  })

  it('reads user from base64-encoded cookie', async () => {
    const session = { user: { id: 'u2', email: 'a@b.com' } }
    const b64 = btoa(JSON.stringify(session))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    document.cookie = `sb-127-auth-token=${encodeURIComponent(
      'base64-' + b64
    )}`

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.user?.id).toBe('u2'))
  })

  it('handles chunked cookies (.0, .1)', async () => {
    const session = { user: { id: 'u3', email: 'chunked@test.com' } }
    const json = JSON.stringify(session)
    const mid = Math.floor(json.length / 2)
    document.cookie = `sb-127-auth-token.0=${json.slice(0, mid)}`
    document.cookie = `sb-127-auth-token.1=${json.slice(mid)}`

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.user?.id).toBe('u3'))
  })

  it('fetches role after reading cookie', async () => {
    const session = { user: { id: 'u4', email: 'a@b.com' } }
    document.cookie = `sb-127-auth-token=${encodeURIComponent(
      JSON.stringify(session)
    )}`
    mockRoleQuery.mockResolvedValue({ data: { role: 'admin' }, error: null })

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.role).toBe('admin'))
  })

  it.each(['board', 'superadmin'])('exposes the %s role', async (role) => {
    const session = { user: { id: 'u5', email: 'a@b.com' } }
    document.cookie = `sb-127-auth-token=${encodeURIComponent(
      JSON.stringify(session)
    )}`
    mockRoleQuery.mockResolvedValue({ data: { role }, error: null })

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.role).toBe(role))
  })

  it('maps an unknown role to null', async () => {
    const session = { user: { id: 'u6', email: 'a@b.com' } }
    document.cookie = `sb-127-auth-token=${encodeURIComponent(
      JSON.stringify(session)
    )}`
    mockRoleQuery.mockResolvedValue({ data: { role: 'owner' }, error: null })

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(mockRoleQuery).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current.user?.id).toBe('u6')
    expect(result.current.role).toBeNull()
  })

  it('handles malformed cookie gracefully', async () => {
    document.cookie = `sb-127-auth-token=${encodeURIComponent('not-json{{{')}`

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('updates state on SIGNED_IN auth event', async () => {
    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Simulate sign-in
    await waitFor(() => {
      authChangeCallback?.('SIGNED_IN', {
        user: { id: 'u5', email: 'new@t.com' },
      })
    })

    await waitFor(() => expect(result.current.user?.id).toBe('u5'))
  })

  it('clears state on SIGNED_OUT auth event', async () => {
    const session = { user: { id: 'u6', email: 'a@b.com' } }
    document.cookie = `sb-127-auth-token=${encodeURIComponent(
      JSON.stringify(session)
    )}`

    const { result } = renderHook(() => useAuthUser())
    await waitFor(() => expect(result.current.user?.id).toBe('u6'))

    await waitFor(() => {
      authChangeCallback?.('SIGNED_OUT', null)
    })

    await waitFor(() => expect(result.current.user).toBeNull())
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useAuthUser())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
