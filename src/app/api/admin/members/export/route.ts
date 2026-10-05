import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import {
  buildMembersCsv,
  csvResponse,
  exportDbErrorResponse,
  exportErrorResponse,
  exportMethodNotAllowed,
  exportOriginError,
  isTruncated,
  parseMembersExportFilter,
  readExportBody,
  type MembersExportRow,
} from "@/lib/admin/exports";

/**
 * A-10: the member list as CSV (active members only, BR-21). `admin_export_members()` checks
 * the role and writes `export.members_csv` in the same transaction as the read, so a file is
 * never served without its audit entry. POST with a same-origin Origin header and the filter
 * in the JSON body: `{ role?: "all" | "member" | "board" | "superadmin", state?: "active" }`.
 */
export async function POST(request: Request) {
  // 1. CSRF: only our own pages may ask for an export
  const originError = exportOriginError(request);
  if (originError) return originError;

  // 2. Auth and role check: an active board member or superadmin
  const access = await getAdminAccess("board");
  if (access.status === "unauthenticated") return exportErrorResponse(401);
  if (access.status !== "ok") return exportErrorResponse(403);
  const user = access.actor;

  // 3. Filters: whitelist only, in the body (a query string is refused, never ignored)
  if (new URL(request.url).search !== "") return exportErrorResponse(400, "invalid_filter");
  const parsed = await readExportBody(request);
  if ("response" in parsed) return parsed.response;
  const filter = parseMembersExportFilter(parsed.body);
  if (!filter) return exportErrorResponse(400, "invalid_filter");

  // 4. Read + audit, with the user's session client (the function takes the actor from it)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_export_members", { p_role: filter.role });

  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin-export] members failed code=%s", error.code ?? "unknown");
    return exportDbErrorResponse(error);
  }

  const rows = (data ?? []) as MembersExportRow[];
  if (isTruncated(rows)) {
    console.error("[admin-export] members truncated rows=%d expected=%d", rows.length, rows[0].total_rows);
    return exportErrorResponse(500);
  }

  // Server log: who exported and how many rows (user id only, no personal data).
  console.info("[admin-export] user=%s rows=%d", user.id, rows.length);

  const today = new Date().toISOString().slice(0, 10);
  const name = filter.role === "all" ? `darkstone_members_${today}` : `darkstone_members_${filter.role}_${today}`;
  return csvResponse(buildMembersCsv(rows), name);
}

/** Exports are POST only (CSRF, audit entries in the user's name). */
export function GET() {
  return exportMethodNotAllowed();
}
