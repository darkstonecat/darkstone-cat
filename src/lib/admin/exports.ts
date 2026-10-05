import "server-only";

import { decrypt } from "@/lib/encryption";
import { escapeCsv } from "@/lib/csv";

/**
 * Builders for the audited admin exports (A-10 member CSV, A-11 one member's data). The rows
 * come from `admin_export_members()` / `admin_export_member_data()`, called with the user's
 * session client: those functions check the role and write the audit entry in the same
 * transaction (migration 20261005100800). DNI/phone arrive as ciphertext bound to the row and
 * are decrypted here with the row id; plain values only ever go into the response body, never
 * into a log (BR-15).
 */

/** Role filter of the member CSV, the same values as the V-2 "Rol" filter. */
export const MEMBERS_EXPORT_ROLES = ["all", "member", "board", "superadmin"] as const;
export type MembersExportRole = (typeof MEMBERS_EXPORT_ROLES)[number];

export type MembersExportFilter = { role: MembersExportRole };

/**
 * Whitelist of the member CSV query params: `role` (one of MEMBERS_EXPORT_ROLES) and `state`,
 * only as `active` (blocked records are never exported, BR-21). An unknown key, an unknown
 * value or a repeated key gives null.
 */
export function parseMembersExportFilter(params: URLSearchParams): MembersExportFilter | null {
  let role: MembersExportRole = "all";

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length !== 1) return null;
    const value = values[0];

    if (key === "role") {
      const match = MEMBERS_EXPORT_ROLES.find((r) => r === value);
      if (!match) return null;
      role = match;
    } else if (key === "state") {
      if (value !== "active") return null;
    } else {
      return null;
    }
  }

  return { role };
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
  const lines = rows.map((m) =>
    [
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
    ]
      .map(escapeCsv)
      .join(",")
  );

  return "﻿" + [MEMBERS_CSV_HEADERS.map(escapeCsv).join(","), ...lines].join("\n");
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

/**
 * HTTP status for an error of an `admin_*` export function: 42501 (admin:forbidden, or no
 * EXECUTE grant) → 403, admin:not_found → 404, admin:invalid_argument → 400, anything else 500.
 */
export function exportErrorStatus(error: { code?: string | null; message?: string | null }): 400 | 403 | 404 | 500 {
  if (error.code === "42501") return 403;
  const message = error.message ?? "";
  if (message.startsWith("admin:not_found")) return 404;
  if (message.startsWith("admin:invalid_argument")) return 400;
  return 500;
}

const ERROR_BODIES = { 400: "invalid_request", 403: "forbidden", 404: "not_found", 500: "failed" } as const;

/** A JSON error response that is never cached. */
export function exportErrorResponse(status: 400 | 401 | 403 | 404 | 500, error?: string): Response {
  const body = error ?? (status === 401 ? "unauthorized" : ERROR_BODIES[status]);
  return Response.json({ error: body }, { status, headers: { "Cache-Control": "no-store" } });
}
