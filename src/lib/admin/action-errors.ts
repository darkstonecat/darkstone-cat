/**
 * Stable error codes of the admin server actions (`src/lib/admin/member-actions.ts`,
 * `src/lib/admin/membership-actions.ts`, `src/lib/admin/access-actions.ts`,
 * `src/lib/admin/superadmin-actions.ts`) and the mapping from the database errors behind them.
 * Pure, so client and server can import it.
 *
 * The admin functions raise `<prefix>:<code>: <text>` (migrations 20261005100200, 20261005100400,
 * 20261005100500, 20261005100600, 20261005100700, 20261005100800); supabase-js returns that text as `error.message` and the
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
  // Leave and rejoin (A-6, A-7, M-1).
  | "self_target"
  | "role_held"
  | "invalid_date"
  | "not_former"
  | "register_closed"
  | "no_login"
  | "invalid_channel"
  | "note_too_long"
  // Access link (A-15).
  | "rate_limited"
  | "send_failed"
  // Roles (S-1, S-2) and anonymisation (S-3).
  | "invalid_role"
  | "role_unchanged"
  | "self_role_change"
  | "last_superadmin"
  | "former_member_role"
  | "confirm_mismatch"
  | "already_anonymised"
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
  // Leave and rejoin functions (20261005100400_membership_lifecycle.sql).
  "membership:forbidden": "forbidden",
  "membership:not_found": "not_found",
  "membership:self_target": "self_target",
  "membership:not_active": "not_active",
  "membership:role_held": "role_held",
  "membership:reason_required": "reason_required",
  "membership:reason_too_long": "reason_too_long",
  "membership:invalid_date": "invalid_date",
  "membership:not_former": "not_former",
  "membership:register_closed": "register_closed",
  "membership:no_login": "no_login",
  "membership:invalid_channel": "invalid_channel",
  "membership:note_too_long": "note_too_long",
  // Role functions and the role guard (20261005100100_roles_expand.sql, 20261005100600). BR-11,
  // BR-10, BR-12 (grant to a former member) and BR-12 (deleting a role holder's row).
  "role_guard:self_role_change": "self_role_change",
  "role_guard:last_superadmin": "last_superadmin",
  "role_guard:former_member_role": "former_member_role",
  "role_guard:role_held": "role_held",
  "admin:role_unchanged": "role_unchanged",
  // Anonymisation (S-3). `admin:isolation` is deliberately absent: it maps to `failed`.
  "admin:confirm_mismatch": "confirm_mismatch",
  "admin:not_former": "not_former",
  "admin:already_anonymised": "already_anonymised",
  // `log_admin_event` refusing the target: only the access link (A-15) logs with a target, and
  // its target must be an active, not purged member (20261005100200_audit_log.sql).
  "audit:invalid_target": "not_active",
};

/**
 * `<prefix>:<code>` at the start of the message, ending at `:`, whitespace or the end (so
 * `admin:forbidden-x` or `admin:not_foundX` never match a known code), then optionally the
 * invalid_value key as a whole word.
 */
const PREFIX_RE = /^([a-z_]+:[a-z_]+)(?=:|\s|$)(?::\s*([a-z_]+)\b)?/;

/** Own keys only: `__proto__` / `constructor` must never resolve through the prototype. */
function lookup<T>(table: Record<string, T>, key: string | undefined): T | undefined {
  return key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;
}

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** Maps a database/PostgREST error to a stable action code; anything unknown is `failed`. */
export function adminDbErrorCode(error: DbError): AdminActionError {
  if (!error || typeof error !== "object") return "failed";
  const message = typeof error.message === "string" ? error.message : "";
  const match = PREFIX_RE.exec(message);

  if (match) {
    if (match[1] === "admin:invalid_value") {
      return lookup(INVALID_VALUE_CODES, match[2]) ?? "invalid";
    }
    const code = lookup(PREFIXED_CODES, match[1]);
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
