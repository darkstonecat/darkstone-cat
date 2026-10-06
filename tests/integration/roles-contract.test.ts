import { describe, it, expect } from 'vitest'
import { supabaseAdmin, runSqlAsPostgres } from '../helpers/supabase'

// Migration 20261007100000_roles_contract.sql (M7, T27): the legacy role 'admin' is gone
// (CHECK and role_rank(), tested in roles.test.ts) and the service-role member list
// get_all_members_for_admin() and its type admin_member_view are dropped.

describe('roles contract (M7)', () => {
  it('get_all_members_for_admin() no longer exists', async () => {
    const { data, error } = await supabaseAdmin.rpc('get_all_members_for_admin')
    expect(data).toBeNull()
    expect(error?.code).toBe('PGRST202')

    const sql = await runSqlAsPostgres<{ fn: string | null; type: string | null }>(
      "select to_regprocedure('public.get_all_members_for_admin()')::text as fn, to_regtype('public.admin_member_view')::text as type"
    )
    expect(sql.error).toBeNull()
    expect(sql.data).toEqual([{ fn: null, type: null }])
  })

  it("the role CHECK lists only member, board and superadmin", async () => {
    const { data, error } = await runSqlAsPostgres<{ def: string }>(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'members_role_check' and conrelid = 'public.members'::regclass"
    )
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].def).toContain("'member'")
    expect(data![0].def).toContain("'board'")
    expect(data![0].def).toContain("'superadmin'")
    expect(data![0].def).not.toContain("'admin'")
  })

  it('no member row holds the legacy role', async () => {
    const { count, error } = await supabaseAdmin
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
    expect(error).toBeNull()
    expect(count).toBe(0)
  })
})
