import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import {
  buildEmailsCsv,
  csvResponse,
  exportDbErrorResponse,
  exportErrorResponse,
  exportMethodNotAllowed,
  exportOriginError,
  isTruncated,
  parseEmailsExportBody,
  readExportBody,
  type EmailExportRow,
} from "@/lib/admin/exports";

/**
 * A-16: an e-mail list, to write to the members from the association's Gmail (P-7). Board+.
 * POST with a same-origin Origin header and `{ list: "association" | "newsletter", format?:
 * "csv" | "json" }`. `admin_export_emails()` picks the active, confirmed members of the list
 * (BR-22, BR-23; never a former member) and writes `export.emails` in the same transaction as
 * the read. `csv` ("Descarrega CSV") is name + e-mail as an attachment; `json` ("Copia les
 * adreces") is `{ list, count, addresses }`, each call audited the same way.
 */
export async function POST(request: Request) {
  const originError = exportOriginError(request);
  if (originError) return originError;

  const access = await getAdminAccess("board");
  if (access.status === "unauthenticated") return exportErrorResponse(401);
  if (access.status !== "ok") return exportErrorResponse(403);
  const user = access.actor;

  const parsed = await readExportBody(request);
  if ("response" in parsed) return parsed.response;
  const body = parseEmailsExportBody(parsed.body);
  if (!body) return exportErrorResponse(400);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_export_emails", { p_list: body.list });
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin-export] emails failed code=%s", error.code ?? "unknown");
    return exportDbErrorResponse(error);
  }

  const rows = (data ?? []) as EmailExportRow[];
  if (isTruncated(rows)) {
    console.error("[admin-export] emails truncated rows=%d expected=%d", rows.length, rows[0].total_rows);
    return exportErrorResponse(500);
  }

  // Server log: who exported which list and how many addresses (never an address).
  console.info("[admin-export] user=%s emails list=%s rows=%d", user.id, body.list, rows.length);

  if (body.format === "json") {
    return Response.json(
      { list: body.list, count: rows.length, addresses: rows.map((r) => r.email) },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(buildEmailsCsv(rows), `darkstone_emails_${body.list}_${today}`);
}

/** Exports are POST only (CSRF, audit entries in the user's name). */
export function GET() {
  return exportMethodNotAllowed();
}
