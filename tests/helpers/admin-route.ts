import { vi } from 'vitest'
import { createClient } from '@/lib/supabase/server'

// Shared by the admin export route tests. The caller must `vi.mock('@/lib/supabase/server')`.
// The session client answers getAdminAccess() (auth.getUser + the members row) and the RPCs.

export type RpcResult = { data: unknown; error: { code?: string; message: string } | null }

export const SITE_ORIGIN = 'https://www.darkstone.cat'

export function mockAdminSession(opts: {
  user?: { id: string } | null
  member?: { role: string; left_on?: string | null } | null
  rpc?: (name: string, args: unknown) => RpcResult
}) {
  const rpc = vi.fn((name: string, args: unknown) =>
    Promise.resolve(opts.rpc ? opts.rpc(name, args) : { data: null, error: { code: '42883', message: 'unknown function' } })
  )
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: opts.user ?? null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: opts.member ?? null }),
        }),
      }),
    }),
    rpc,
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
  return { client, rpc }
}

/** A POST as the export dialogs send it: same-origin, JSON body. */
export function postJson(
  url: string,
  body: unknown,
  { origin = SITE_ORIGIN, raw }: { origin?: string | null; raw?: string } = {}
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin !== null) headers.origin = origin
  return new Request(url, {
    method: 'POST',
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
}

/** Response body as bytes and as text, keeping the BOM. */
export async function bodyOf(res: Response) {
  const buffer = await res.arrayBuffer()
  return { bytes: new Uint8Array(buffer), text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer) }
}

/** Every console call, to assert that nothing personal was logged. */
export function spyConsole() {
  const spies = (['info', 'log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
  return {
    info: spies[0],
    error: spies[3],
    logged: () => JSON.stringify(spies.map((s) => s.mock.calls)),
  }
}
