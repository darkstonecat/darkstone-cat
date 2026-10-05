/**
 * Stable error codes of the admin server actions (`src/lib/admin/member-actions.ts`) and the
 * mapping from the database errors behind them. Pure, so client and server can import it.
 *
 * The admin functions raise `<prefix>:<code>: <text>` (migrations 20261005100500,
 * 20261005100700, 20261005100800); supabase-js returns that text as `error.message` and the
 * SQLSTATE as `error.code`. Only the prefix and code are read: the text can echo values, so it
 * is never returned to the browser or logged.
 */

export type AdminActionError =
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  | "not_found"
  | "not_active"
  | "invalid_name"
  | "invalid_phone"
  | "invalid_dni"
  | "invalid_postal_code"
  | "invalid_username"
  | "reason_required"
  | "reason_too_long"
  | "no_value"
  | "badge_held"
  | "badge_not_held"
  | "invalid_badge"
  | "failed";

/** `admin:invalid_value: <patch key> …` → the profile edit's code for that field. */
const INVALID_VALUE_CODES: Record<string, AdminActionError> = {
  first_name: "invalid_name",
  last_name: "invalid_name",
  postal_code: "invalid_postal_code",
  ludoya_username: "invalid_username",
  bgg_username: "invalid_username",
  phone_encrypted: "invalid_phone",
  dni_nie_encrypted: "invalid_dni",
};

const PREFIXED_CODES: Record<string, AdminActionError> = {
  "admin:forbidden": "forbidden",
  "audit:forbidden": "forbidden",
  "admin:not_found": "not_found",
  "admin:not_active": "not_active",
  "admin:invalid_argument": "invalid",
  "admin:no_value": "no_value",
  "admin:reason_required": "reason_required",
  "admin:reason_too_long": "reason_too_long",
  "admin:badge_held": "badge_held",
  "admin:badge_not_held": "badge_not_held",
  // The BR-15 detector refusing the audit details: the only free text an A-4..A-9 action puts
  // there is a name (member.update before/after), e.g. a name shaped like a phone.
  "audit:sensitive_details": "invalid_name",
};

const PREFIX_RE = /^([a-z_]+:[a-z_]+)(?::\s*([a-z_]+))?/;

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** Maps a database/PostgREST error to a stable action code; anything unknown is `failed`. */
export function adminDbErrorCode(error: DbError): AdminActionError {
  if (!error || typeof error !== "object") return "failed";
  const message = typeof error.message === "string" ? error.message : "";
  const match = PREFIX_RE.exec(message);

  if (match) {
    if (match[1] === "admin:invalid_value") {
      return (match[2] && INVALID_VALUE_CODES[match[2]]) || "invalid";
    }
    const code = PREFIXED_CODES[match[1]];
    if (code) return code;
  }

  // Plain Postgres "permission denied" (no EXECUTE grant).
  if (!match && error.code === "42501") return "forbidden";
  return "failed";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A member id as the actions accept it: a UUID string (any case). */
export function isMemberId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
