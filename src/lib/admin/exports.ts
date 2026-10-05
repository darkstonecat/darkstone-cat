import "server-only";

import { decrypt } from "@/lib/encryption";
import { escapeCsv } from "@/lib/csv";
import { isAllowedOrigin } from "@/lib/http/origin";

/**
 * Builders for the audited admin exports (A-10 member CSV, A-11 one member's data, A-16 e-mail
 * lists, S-4 llibre de socis). The rows come from the `admin_export_*()` functions, called with
 * the user's session client: those functions check the role and write the audit entry in the
 * same transaction (migrations 20261005100800, 20261005100900). DNI/phone arrive as ciphertext
 * bound to the row and are decrypted here with the row id; plain values only ever go into the
 * response body, never into a log (BR-15).
 *
 * Every export route is POST with a JSON body and a same-origin `Origin` header (CSRF: a GET or
 * a cross-site form could otherwise make a board member's browser write an audit entry in
 * their name), and answers GET with 405. Order of checks in each route: origin (403
 * `forbidden_origin`), session and role (401/403), body (413/400), then the database.
 */

// --- Request handling shared by the export routes ---------------------------------------------

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Bodies are a few small fields; anything bigger is refused before parsing. */
export const EXPORT_MAX_BODY_BYTES = 4096;

/** 403 `forbidden_origin` unless the request carries a same-origin `Origin` header, else null. */
export function exportOriginError(request: Request): Response | null {
  if (isAllowedOrigin(request.headers.get("origin"))) return null;
  return Response.json({ error: "forbidden_origin" }, { status: 403, headers: NO_STORE });
}

/** The answer of every export route to GET (and any other method Next routes here). */
export function exportMethodNotAllowed(): Response {
  return Response.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { ...NO_STORE, Allow: "POST" } }
  );
}

/**
 * Reads the JSON object body of an export request. An empty body is `{}`; over
 * EXPORT_MAX_BODY_BYTES → 413 `payload_too_large`; not JSON or not an object → 400
 * `invalid_request`.
 */
export async function readExportBody(
  request: Request
): Promise<{ body: Record<string, unknown> } | { response: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > EXPORT_MAX_BODY_BYTES) {
    return { response: exportErrorResponse(413) };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { response: exportErrorResponse(400) };
  }
  if (raw.length > EXPORT_MAX_BODY_BYTES) return { response: exportErrorResponse(413) };
  if (raw.trim() === "") return { body: {} };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { response: exportErrorResponse(400) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { response: exportErrorResponse(400) };
  }
  return { body: parsed as Record<string, unknown> };
}

/** True when every key of `body` is one of `allowed`. */
function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(body).every((key) => allowed.includes(key));
}

/**
 * The optional/required reason of A-11 and S-4: absent or null → null, a string → itself
 * (the database trims it and checks its length), anything else → undefined (invalid).
 */
export function readReason(body: Record<string, unknown>): string | null | undefined {
  const value = body.reason;
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : undefined;
}

/** A-11 body: `{ reason? }` only. */
export function parseMemberDataBody(body: Record<string, unknown>): { reason: string | null } | null {
  if (!onlyKeys(body, ["reason"])) return null;
  const reason = readReason(body);
  return reason === undefined ? null : { reason };
}

/** S-4 body: `{ reason }` only. A blank reason is `reason_required` before the database. */
export function parseRegisterBody(
  body: Record<string, unknown>
): { reason: string } | { error: "invalid_request" | "reason_required" } {
  if (!onlyKeys(body, ["reason"])) return { error: "invalid_request" };
  const reason = readReason(body);
  if (reason === undefined) return { error: "invalid_request" };
  if (reason === null || reason.trim() === "") return { error: "reason_required" };
  return { reason };
}

/** Role filter of the member CSV, the same values as the V-2 "Rol" filter. */
export const MEMBERS_EXPORT_ROLES = ["all", "member", "board", "superadmin"] as const;
export type MembersExportRole = (typeof MEMBERS_EXPORT_ROLES)[number];

export type MembersExportFilter = { role: MembersExportRole };

/**
 * Whitelist of the member CSV filter (the JSON body): `role` (one of MEMBERS_EXPORT_ROLES) and
 * `state`, only as `active` (blocked records are never exported, BR-21). An unknown key or a
 * value that is not one of those strings gives null.
 */
export function parseMembersExportFilter(body: Record<string, unknown>): MembersExportFilter | null {
  if (!onlyKeys(body, ["role", "state"])) return null;
  if (body.state !== undefined && body.state !== "active") return null;

  if (body.role === undefined) return { role: "all" };
  const role = MEMBERS_EXPORT_ROLES.find((r) => r === body.role);
  return role ? { role } : null;
}

/** One row of `admin_export_members()`. */
export type MembersExportRow = {
  id: string;
  member_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_encrypted: string | null;
  dni_nie_encrypted: string | null;
  postal_code: string | null;
  ludoya_username: string | null;
  bgg_username: string | null;
  role: string;
  newsletter_accepted: boolean | null;
  membership_start_date: string | null;
  current_joined_on: string | null;
  created_at: string | null;
  /** Rows the export returned in the database; more than received means a truncated response. */
  total_rows: number;
};

/** One row of `admin_export_member_data()`. */
export type MemberDataRow = {
  id: string;
  member_number: string;
  state: "active" | "former";
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_encrypted: string | null;
  dni_nie_encrypted: string | null;
  postal_code: string | null;
  ludoya_username: string | null;
  bgg_username: string | null;
  role: string;
  newsletter_accepted: boolean | null;
  membership_start_date: string | null;
  current_joined_on: string | null;
  left_on: string | null;
  left_by: string | null;
  leave_reason: string | null;
  created_at: string | null;
  badges: { key: string; awarded_at: string }[] | null;
};

/** The previous columns plus *Primera alta* and *Alta actual* (A-10). */
export const MEMBERS_CSV_HEADERS = [
  "Número",
  "Nom",
  "Cognoms",
  "Email",
  "Telèfon",
  "DNI/NIE",
  "CP",
  "Ludoya",
  "BGG",
  "Rol",
  "Newsletter",
  "Primera alta",
  "Alta actual",
  "Creat",
] as const;

/** Decrypts a value of the member `memberId`; null when nothing is stored or it cannot be read. */
function decryptOrNull(value: string | null, memberId: string): string | null {
  if (!value) return null;
  try {
    return decrypt(value, memberId);
  } catch {
    return null;
  }
}

/** The CSV body with a UTF-8 BOM (Excel). Every cell goes through escapeCsv. */
export function buildMembersCsv(rows: MembersExportRow[]): string {
  return toCsv(
    MEMBERS_CSV_HEADERS,
    rows.map((m) => [
      m.member_number,
      m.first_name ?? "",
      m.last_name ?? "",
      m.email ?? "",
      decryptOrNull(m.phone_encrypted, m.id) ?? "",
      decryptOrNull(m.dni_nie_encrypted, m.id) ?? "",
      m.postal_code ?? "",
      m.ludoya_username ?? "",
      m.bgg_username ?? "",
      m.role,
      m.newsletter_accepted ? "Sí" : "No",
      m.membership_start_date ?? "",
      m.current_joined_on ?? "",
      m.created_at ?? "",
    ])
  );
}

/**
 * The A-11 file: the same keys as the member's own download (`exportProfileData`), plus the
 * membership fields the association holds about them (alta actual, baixa date, by whom and why).
 */
export function buildMemberDataJson(row: MemberDataRow, now: Date = new Date()): string {
  const data = {
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    member_number: row.member_number,
    phone: decryptOrNull(row.phone_encrypted, row.id),
    dni: decryptOrNull(row.dni_nie_encrypted, row.id),
    postal_code: row.postal_code,
    ludoya_username: row.ludoya_username,
    bgg_username: row.bgg_username,
    role: row.role,
    newsletter_accepted: row.newsletter_accepted,
    membership_start_date: row.membership_start_date,
    created_at: row.created_at,
    badges: (row.badges ?? []).map((b) => ({ key: b.key, awarded_at: b.awarded_at })),
    current_joined_on: row.current_joined_on,
    left_on: row.left_on,
    left_by: row.left_by,
    leave_reason: row.leave_reason,
    exported_at: now.toISOString(),
  };

  return JSON.stringify(data, null, 2);
}

type DbError = { code?: string | null; message?: string | null };

/** `admin:<code>` read up to `:`, whitespace or the end, so a lookalike code never matches. */
function hasPrefix(message: string, prefix: string): boolean {
  return message === prefix || message.startsWith(`${prefix}:`) || message.startsWith(`${prefix} `);
}

/**
 * HTTP status for an error of an `admin_*` export function: 42501 (admin:forbidden, or no
 * EXECUTE grant) → 403, admin:not_found → 404, admin:invalid_argument, admin:reason_required
 * and admin:reason_too_long → 400, anything else 500.
 */
export function exportErrorStatus(error: DbError): 400 | 403 | 404 | 500 {
  if (error.code === "42501") return 403;
  const message = error.message ?? "";
  if (hasPrefix(message, "admin:not_found")) return 404;
  if (
    hasPrefix(message, "admin:invalid_argument") ||
    hasPrefix(message, "admin:reason_required") ||
    hasPrefix(message, "admin:reason_too_long")
  ) {
    return 400;
  }
  return 500;
}

/** The JSON error response for a database error: the reason codes keep their own name. */
export function exportDbErrorResponse(error: DbError): Response {
  const status = exportErrorStatus(error);
  const message = error.message ?? "";
  if (status === 400 && hasPrefix(message, "admin:reason_required")) return exportErrorResponse(400, "reason_required");
  if (status === 400 && hasPrefix(message, "admin:reason_too_long")) return exportErrorResponse(400, "reason_too_long");
  return exportErrorResponse(status);
}

const ERROR_BODIES = {
  400: "invalid_request",
  403: "forbidden",
  404: "not_found",
  413: "payload_too_large",
  500: "failed",
} as const;

/** A JSON error response that is never cached. */
export function exportErrorResponse(status: 400 | 401 | 403 | 404 | 413 | 500, error?: string): Response {
  const body = error ?? (status === 401 ? "unauthorized" : ERROR_BODIES[status]);
  return Response.json({ error: body }, { status, headers: NO_STORE });
}

/** True when PostgREST capped the response (`max_rows`): never serve a partial list. */
export function isTruncated(rows: { total_rows: number }[]): boolean {
  return rows.length > 0 && rows[0].total_rows !== rows.length;
}

/** `attachment` CSV response with the given file name (no extension), never cached. */
export function csvResponse(body: string, fileName: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}.csv"`,
      ...NO_STORE,
    },
  });
}

/** A CSV body with a UTF-8 BOM (Excel); every cell goes through escapeCsv. */
function toCsv(headers: readonly string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cells) => cells.map(escapeCsv).join(","));
  return "\uFEFF" + lines.join("\n");
}

// --- A-16: e-mail lists ---------------------------------------------------------------------------

/** The two lists of BR-23: every active member, or those who accepted the newsletter. */
export const EMAIL_LISTS = ["association", "newsletter"] as const;
export type EmailList = (typeof EMAIL_LISTS)[number];
export type EmailExportFormat = "csv" | "json";

/** A-16 body: `{ list, format? }` with `format` "csv" (default) or "json". */
export function parseEmailsExportBody(
  body: Record<string, unknown>
): { list: EmailList; format: EmailExportFormat } | null {
  if (!onlyKeys(body, ["list", "format"])) return null;
  const list = EMAIL_LISTS.find((l) => l === body.list);
  if (!list) return null;
  if (body.format === undefined || body.format === "csv") return { list, format: "csv" };
  if (body.format === "json") return { list, format: "json" };
  return null;
}

/** One row of `admin_export_emails()`. */
export type EmailExportRow = {
  first_name: string | null;
  last_name: string | null;
  email: string;
  total_rows: number;
};

export const EMAILS_CSV_HEADERS = ["Nom", "Cognoms", "Email"] as const;

/** Name and e-mail, to import into a Google Group or Google Contacts (A-16). */
export function buildEmailsCsv(rows: EmailExportRow[]): string {
  return toCsv(
    EMAILS_CSV_HEADERS,
    rows.map((r) => [r.first_name ?? "", r.last_name ?? "", r.email])
  );
}

// --- S-4: llibre de socis -------------------------------------------------------------------------

/** One row of `admin_export_register()`. */
export type RegisterExportRow = {
  id: string;
  member_number: string;
  first_name: string | null;
  last_name: string | null;
  dni_nie_encrypted: string | null;
  membership_start_date: string | null;
  current_joined_on: string | null;
  left_on: string | null;
  left_by: string | null;
  total_rows: number;
};

/** The D-B fields: member number, names, DNI/NIE, first and current alta, baixa date and by whom. */
export const REGISTER_CSV_HEADERS = [
  "Número",
  "Nom",
  "Cognoms",
  "DNI/NIE",
  "Primera alta",
  "Alta actual",
  "Data de baixa",
  "Baixa per",
] as const;

const LEFT_BY_LABELS: Record<string, string> = { self: "Soci", board: "Junta" };

export function buildRegisterCsv(rows: RegisterExportRow[]): string {
  return toCsv(
    REGISTER_CSV_HEADERS,
    rows.map((m) => [
      m.member_number,
      m.first_name ?? "",
      m.last_name ?? "",
      decryptOrNull(m.dni_nie_encrypted, m.id) ?? "",
      m.membership_start_date ?? "",
      m.current_joined_on ?? "",
      m.left_on ?? "",
      m.left_by ? (Object.hasOwn(LEFT_BY_LABELS, m.left_by) ? LEFT_BY_LABELS[m.left_by] : m.left_by) : "",
    ])
  );
}
