import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import {
  buildMembersCsv,
  exportErrorResponse,
  exportErrorStatus,
  parseMembersExportFilter,
  type MembersExportRow,
} from "@/lib/admin/exports";

/**
 * A-10: the member list as CSV (active members only, BR-21). `admin_export_members()` checks
 * the role and writes `export.members_csv` in the same transaction as the read, so a file is
 * never served without its audit entry. Optional `?role=all|member|board|superadmin`.
 */
export async function GET(request: Request) {
  // 1. Auth and role check: an active board member or superadmin
  const access = await getAdminAccess("board");
  if (access.status === "unauthenticated") return exportErrorResponse(401);
  if (access.status !== "ok") return exportErrorResponse(403);
  const user = access.actor;

  // 2. Filters: whitelist only
  const filter = parseMembersExportFilter(new URL(request.url).searchParams);
  if (!filter) return exportErrorResponse(400, "invalid_filter");

  // 3. Read + audit, with the user's session client (the function takes the actor from it)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_export_members", { p_role: filter.role });

  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin-export] members failed code=%s", error.code ?? "unknown");
    return exportErrorResponse(exportErrorStatus(error));
  }

  const rows = (data ?? []) as MembersExportRow[];
  if (rows.length > 0 && rows[0].total_rows !== rows.length) {
    // PostgREST capped the response (max_rows): never serve a partial list.
    console.error("[admin-export] members truncated rows=%d expected=%d", rows.length, rows[0].total_rows);
    return exportErrorResponse(500);
  }

  // Server log: who exported and how many rows (user id only, no personal data).
  console.info("[admin-export] user=%s rows=%d", user.id, rows.length);

  const today = new Date().toISOString().slice(0, 10);
  const name = filter.role === "all" ? `darkstone_members_${today}` : `darkstone_members_${filter.role}_${today}`;

  return new Response(buildMembersCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
