/**
 * V-3 member file: input validation, the row types of `admin_get_member` / `admin_list_activity`
 * and small display helpers. Pure module (no `server-only`): shared by the page, the components
 * and the tests.
 */

import { buildMembersHref, parseMembersParams } from "./members-list";

/** Same rule as the A-11 route: letters, digits and hyphens, 1 to 32 characters. */
export const MEMBER_NUMBER_PATTERN = /^[0-9A-Za-z-]{1,32}$/;

export function isValidMemberNumber(value: unknown): value is string {
  return typeof value === "string" && MEMBER_NUMBER_PATTERN.test(value);
}

export type MemberBadgeEntry = {
  badge_key: string;
  awarded_at: string | null;
  awarded_by: string | null;
  awarded_by_name: string | null;
};

/**
 * One row of `admin_get_member`. DNI and phone never travel here: only whether they exist.
 * For a former member the RPC already returns NULL for postal code, usernames, newsletter and
 * `has_phone` (BR-20/21).
 */
export type AdminMemberFileRow = {
  id: string;
  member_number: string;
  state: "active" | "former";
  first_name: string;
  last_name: string;
  email: string | null;
  has_login: boolean;
  role: string;
  role_since: string | null;
  postal_code: string | null;
  ludoya_username: string | null;
  bgg_username: string | null;
  newsletter_accepted: boolean | null;
  has_dni: boolean;
  has_phone: boolean | null;
  membership_start_date: string | null;
  current_joined_on: string | null;
  left_on: string | null;
  left_by: "self" | "board" | null;
  leave_reason: string | null;
  purge_on: string | null;
  anonymised_at: string | null;
  card_valid: boolean;
  card_issued_at: string | null;
  created_at: string | null;
  badges: MemberBadgeEntry[] | null;
};

/** One row of `admin_list_activity` (the columns the member file uses). */
export type AdminActivityRow = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_member_number: string | null;
  actor_name: string | null;
  action: string;
  target_member_number: string | null;
  target_name: string | null;
};

/** How many entries the "Activitat" card shows. */
export const MEMBER_ACTIVITY_LIMIT = 5;

/**
 * The list's query string travels in `?list=` so the member file can send the board back to
 * the same page, filter and sort. Returns "" for the default list (a plain link).
 */
export function listParamFor(query: Parameters<typeof buildMembersHref>[0]): string {
  const href = buildMembersHref(query);
  const index = href.indexOf("?");
  return index === -1 ? "" : href.slice(index + 1);
}

/**
 * `/admin/members` URL for the `list` search parameter of a member file. The text is parsed
 * and rebuilt through the list's own whitelist, so nothing but valid list filters survives
 * (never a free-form redirect target).
 */
export function backToListHref(raw: string | string[] | undefined): string {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text || text.length > 400) return "/admin/members";
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(text)) {
    if (!(key in params)) params[key] = value;
  }
  return buildMembersHref(parseMembersParams(params));
}

/** Translation key (under `admin.member_file.activity`) of an audit action; unknown → null. */
const ACTIVITY_KEYS: Readonly<Record<string, string>> = {
  "member.update": "member_update",
  "member.reveal_sensitive": "member_reveal_sensitive",
  "member.send_access_link": "member_send_access_link",
  "member.anonymise": "member_anonymise",
  "membership.leave": "membership_leave",
  "membership.rejoin": "membership_rejoin",
  "badge.award": "badge_award",
  "badge.revoke": "badge_revoke",
  "card.regenerate": "card_regenerate",
  "export.member_data": "export_member_data",
  "role.grant": "role_grant",
  "role.revoke": "role_revoke",
};

export function activityKeyOf(action: string): string | null {
  return Object.hasOwn(ACTIVITY_KEYS, action) ? ACTIVITY_KEYS[action] : null;
}

/** Badge keys the member file can name; others fall back to the raw key. */
export const KNOWN_BADGE_KEYS = ["volunteer_egara_joga", "ludoteca_donor"] as const;

/** "2026-10-05T07:15:00+00:00" → "5/10/2026" in Madrid time (the mockup's d/m/yyyy). */
export function formatAdminTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  // en-GB pads day and month ("05"): the mockup writes 5/10/2026.
  const pick = (type: string) => String(Number(parts.find((p) => p.type === type)?.value ?? ""));
  return `${pick("day")}/${pick("month")}/${pick("year")}`;
}

/** Year of a "YYYY-MM-DD" date, for the derived "Membre {year}" badge (BR-6). */
export function yearOf(iso: string | null | undefined): number | null {
  const match = iso ? /^(\d{4})-/.exec(iso) : null;
  return match ? Number(match[1]) : null;
}
