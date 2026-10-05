import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import {
  buildMemberDataJson,
  exportErrorResponse,
  exportErrorStatus,
  type MemberDataRow,
} from "@/lib/admin/exports";

/** Member numbers are `000-123`; anything outside this shape cannot exist. */
const MEMBER_NUMBER = /^[0-9A-Za-z-]{1,32}$/;

/**
 * A-11: one member's data as JSON, to answer an access request (P-3). Board+ for an active
 * member; a former member is superadmin only (D-D, provisional, enforced in the database).
 * `admin_export_member_data()` writes `export.member_data` in the same transaction as the read.
 * Unknown, purged or unconfirmed members answer 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  const access = await getAdminAccess("board");
  if (access.status === "unauthenticated") return exportErrorResponse(401);
  if (access.status !== "ok") return exportErrorResponse(403);
  const user = access.actor;

  const { number } = await params;
  if (typeof number !== "string" || !MEMBER_NUMBER.test(number)) return exportErrorResponse(404);

  const supabase = await createClient();

  // 1. Member number → id (same visibility rules: never purged or unconfirmed, BR-22)
  const found = await supabase.rpc("admin_get_member", { p_member_number: number });
  if (found.error) {
    console.error("[admin-export] member_data lookup failed code=%s", found.error.code ?? "unknown");
    return exportErrorResponse(exportErrorStatus(found.error));
  }
  const member = (found.data as { id: string }[] | null)?.[0];
  if (!member) return exportErrorResponse(404);

  // 2. Read + audit, with the user's session client
  const { data, error } = await supabase.rpc("admin_export_member_data", { p_member_id: member.id });
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin-export] member_data failed code=%s", error.code ?? "unknown");
    return exportErrorResponse(exportErrorStatus(error));
  }
  const row = (data as MemberDataRow[] | null)?.[0];
  if (!row) return exportErrorResponse(404);

  // Server log: who exported whose data (ids only, no personal data).
  console.info("[admin-export] user=%s member_data=%s", user.id, row.id);

  return new Response(buildMemberDataJson(row), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="darkstone-data-${row.member_number}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
