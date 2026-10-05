import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import {
  buildMemberDataJson,
  exportDbErrorResponse,
  exportErrorResponse,
  exportMethodNotAllowed,
  exportOriginError,
  parseMemberDataBody,
  readExportBody,
  type MemberDataRow,
} from "@/lib/admin/exports";

/** Member numbers are `000-123`; anything outside this shape cannot exist. */
const MEMBER_NUMBER = /^[0-9A-Za-z-]{1,32}$/;

/**
 * A-11: one member's data as JSON, to answer an access request (P-3). Board+ for an active
 * member; a former member is superadmin only (D-D, provisional) and needs a written reason of
 * at least 10 characters (BR-21), all enforced in the database. POST with a same-origin Origin
 * header and the JSON body `{ reason? }`: the reason never travels in the URL and is never
 * logged; `admin_export_member_data()` stores it in the `export.member_data` entry it writes in
 * the same transaction as the read. Unknown, purged or unconfirmed members answer 404.
 */
export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  const originError = exportOriginError(request);
  if (originError) return originError;

  const access = await getAdminAccess("board");
  if (access.status === "unauthenticated") return exportErrorResponse(401);
  if (access.status !== "ok") return exportErrorResponse(403);
  const user = access.actor;

  const { number } = await params;
  if (typeof number !== "string" || !MEMBER_NUMBER.test(number)) return exportErrorResponse(404);

  const parsed = await readExportBody(request);
  if ("response" in parsed) return parsed.response;
  const body = parseMemberDataBody(parsed.body);
  if (!body) return exportErrorResponse(400);

  const supabase = await createClient();

  // 1. Member number → id (same visibility rules: never purged or unconfirmed, BR-22)
  const found = await supabase.rpc("admin_get_member", { p_member_number: number });
  if (found.error) {
    console.error("[admin-export] member_data lookup failed code=%s", found.error.code ?? "unknown");
    return exportDbErrorResponse(found.error);
  }
  const member = (found.data as { id: string }[] | null)?.[0];
  if (!member) return exportErrorResponse(404);

  // 2. Read + audit (with the reason), with the user's session client
  const { data, error } = await supabase.rpc("admin_export_member_data", {
    p_member_id: member.id,
    p_reason: body.reason,
  });
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin-export] member_data failed code=%s", error.code ?? "unknown");
    return exportDbErrorResponse(error);
  }
  const row = (data as MemberDataRow[] | null)?.[0];
  if (!row) return exportErrorResponse(404);

  // Server log: who exported whose data (ids only, no personal data, never the reason).
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

/** Exports are POST only (CSRF, and the reason must never be in a URL). */
export function GET() {
  return exportMethodNotAllowed();
}
