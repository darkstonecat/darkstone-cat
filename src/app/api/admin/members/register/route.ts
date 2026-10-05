import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import {
  buildRegisterCsv,
  csvResponse,
  exportDbErrorResponse,
  exportErrorResponse,
  exportMethodNotAllowed,
  exportOriginError,
  isTruncated,
  parseRegisterBody,
  readExportBody,
  type RegisterExportRow,
} from "@/lib/admin/exports";

/**
 * S-4: the *llibre de socis* as CSV (LO 1/2002 art. 14). Superadmin only. Every member, active
 * or former (blocked records included: the one exception of BR-21), never a purged stub or an
 * unconfirmed sign-up, with the D-B fields (DNI decrypted with the row id). POST with a
 * same-origin Origin header and `{ reason }`: the file carries former members' DNI, so a
 * written reason of at least 10 characters is required (checked and stored by
 * `admin_export_register()`, which writes `export.member_register` in the same transaction as
 * the read). The reason is never logged.
 */
export async function POST(request: Request) {
  const originError = exportOriginError(request);
  if (originError) return originError;

  const access = await getAdminAccess("superadmin");
  if (access.status === "unauthenticated") return exportErrorResponse(401);
  if (access.status !== "ok") return exportErrorResponse(403);
  const user = access.actor;

  const parsed = await readExportBody(request);
  if ("response" in parsed) return parsed.response;
  const body = parseRegisterBody(parsed.body);
  if ("error" in body) return exportErrorResponse(400, body.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_export_register", { p_reason: body.reason });
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin-export] register failed code=%s", error.code ?? "unknown");
    return exportDbErrorResponse(error);
  }

  const rows = (data ?? []) as RegisterExportRow[];
  if (isTruncated(rows)) {
    console.error("[admin-export] register truncated rows=%d expected=%d", rows.length, rows[0].total_rows);
    return exportErrorResponse(500);
  }

  // Server log: who exported and how many rows (user id only, no personal data).
  console.info("[admin-export] user=%s register rows=%d", user.id, rows.length);

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(buildRegisterCsv(rows), `darkstone_llibre_socis_${today}`);
}

/** Exports are POST only (CSRF, and the reason must never be in a URL). */
export function GET() {
  return exportMethodNotAllowed();
}
