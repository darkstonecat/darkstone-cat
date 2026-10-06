/**
 * V-4 activity log: URL parameters, their sanitiser and the arguments of `admin_list_activity`.
 *
 * Nothing from the URL reaches the RPC unchecked: the action must be one of the 18 keys or a
 * group, the actor a UUID or `system` / `self`, the member a member number, the dates real
 * `YYYY-MM-DD` days and the cursor a plain integer. Pure module (no `server-only`).
 */

import { AUDIT_ACTIONS } from "./audit-format";
import { MEMBER_NUMBER_PATTERN } from "./member-file";

/** Group filters understood by `admin_list_activity`. */
export const ACTION_GROUPS = ["badge.*", "role.*"] as const;

/**
 * Options of the "Acció" select, in the mockup's order (README §4, V-4): 14 single keys plus the
 * two groups, 16 entries. Each value is accepted by the RPC.
 */
export const ACTION_FILTERS = [
  "member.update",
  "member.reveal_sensitive",
  "membership.leave",
  "membership.rejoin",
  "badge.*",
  "card.regenerate",
  "member.send_access_link",
  "export.members_csv",
  "export.member_data",
  "export.member_register",
  "export.emails",
  "role.*",
  "member.anonymise",
  "member.purge",
  "account.purge_unconfirmed",
  "ops.cache_refresh",
] as const;

const ALLOWED_ACTIONS: ReadonlySet<string> = new Set<string>([...AUDIT_ACTIONS, ...ACTION_GROUPS]);

export const ACTOR_KINDS = ["system", "self"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ACTIVITY_PAGE_SIZE = 25;

export type ActivityQuery = {
  action: string | null;
  /** `system`, `self` or a member UUID. */
  actor: string | null;
  /** Member number (the snapshot, so it works after a purge). */
  target: string | null;
  /** Inclusive first day, `YYYY-MM-DD`. */
  from: string | null;
  /** Inclusive last day, `YYYY-MM-DD`. */
  to: string | null;
  /** Keyset cursor: id of the last entry of the previous page. */
  before: number | null;
};

export const EMPTY_ACTIVITY_QUERY: ActivityQuery = {
  action: null,
  actor: null,
  target: null,
  from: null,
  to: null,
  before: null,
};

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A real calendar day between 2000 and 2100, or null. */
export function parseDay(value: string | undefined): string | null {
  const match = value ? DAY_PATTERN.exec(value) : null;
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value! : null;
}

export function parseActivityParams(raw: RawParams): ActivityQuery {
  const action = single(raw.action);
  const actor = single(raw.actor);
  const target = single(raw.target)?.trim();
  const beforeText = single(raw.before);
  const before = beforeText && /^\d{1,15}$/.test(beforeText) ? Number(beforeText) : null;

  let from = parseDay(single(raw.from));
  let to = parseDay(single(raw.to));
  // A reversed range would match nothing: swap it.
  if (from && to && from > to) [from, to] = [to, from];

  return {
    action: action && ALLOWED_ACTIONS.has(action) ? action : null,
    actor:
      actor && ((ACTOR_KINDS as readonly string[]).includes(actor) || UUID_PATTERN.test(actor))
        ? actor.toLowerCase()
        : null,
    target: target && MEMBER_NUMBER_PATTERN.test(target) ? target : null,
    from,
    to,
    before: before !== null && Number.isSafeInteger(before) && before > 0 ? before : null,
  };
}

/** The instant a Madrid calendar day starts (DST transitions never fall at midnight). */
export function madridDayStart(day: string, plusDays = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d + plusDays);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMidnight));
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"));
  return new Date(utcMidnight - (wall - utcMidnight)).toISOString();
}

/** Arguments of `admin_list_activity`; one extra row is asked for to know whether a next page exists. */
export function toActivityArgs(query: ActivityQuery, limit = ACTIVITY_PAGE_SIZE) {
  const actorIsUuid = query.actor !== null && UUID_PATTERN.test(query.actor);
  return {
    p_action: query.action,
    p_actor: actorIsUuid ? query.actor : null,
    p_actor_kind: query.actor === "system" || query.actor === "self" ? query.actor : null,
    p_target_number: query.target,
    p_from: query.from ? madridDayStart(query.from) : null,
    // Half-open: the whole "to" day is included.
    p_to: query.to ? madridDayStart(query.to, 1) : null,
    p_limit: limit + 1,
    p_before_id: query.before,
  };
}

/** `/admin/activity` URL for a query with overrides; empty filters are left out. */
export function buildActivityHref(query: ActivityQuery, overrides: Partial<ActivityQuery> = {}): string {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["action", "actor", "target", "from", "to"] as const) {
    const value = next[key];
    if (value) params.set(key, value);
  }
  if (next.before !== null) params.set("before", String(next.before));
  const text = params.toString();
  return text ? `/admin/activity?${text}` : "/admin/activity";
}

export function hasActivityFilters(query: ActivityQuery): boolean {
  return Boolean(query.action || query.actor || query.target || query.from || query.to);
}
