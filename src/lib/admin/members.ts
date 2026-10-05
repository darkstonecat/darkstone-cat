import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminMember } from "@/lib/supabase/auth";
import type { AdminActor } from "./guard";

/**
 * Every member with email and DNI/phone ciphertext, for the current admin screens and the CSV
 * export (until T27 replaces them). `get_all_members_for_admin()` is executable by the service
 * role only, so this uses the admin client: the caller must have checked the role first, and
 * passes the actor returned by `requireRole` / `getAdminAccess` as proof. Not a server action,
 * so the browser can never call it.
 */
export async function listAllMembersForAdmin(actor: AdminActor): Promise<{
  data: AdminMember[] | null;
  error: string | null;
}> {
  if (!actor?.id) return { data: null, error: "forbidden" };

  const { data, error } = await createAdminClient().rpc("get_all_members_for_admin");

  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/members] list failed code=%s", error.code ?? "unknown");
    return { data: null, error: "failed" };
  }

  return { data: data as AdminMember[], error: null };
}
