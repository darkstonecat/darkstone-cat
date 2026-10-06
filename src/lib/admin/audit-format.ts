/**
 * Audit renderer (spec §5): turns one row of `admin_list_activity` into structured text, an
 * i18n key plus params per sentence, so the V-4 log, the V-1 "Activitat recent" and the V-3
 * "Activitat" card read the same way in every locale. Pure module (no `server-only`).
 *
 * Only whitelisted `details` fields are read, each checked for its type: DNI and phone values
 * never appear in `details` (BR-15) and nothing outside the whitelist is ever rendered. An
 * unknown action, or details of an unexpected shape, falls back to a generic sentence. The
 * free-text `reason` is returned as is: the component prints it as plain text (React escapes it).
 *
 * All keys are relative to the `admin.activity` message namespace.
 */

import { formatAdminDate } from "./members-list";

/** The 18 action keys of spec §5.1 (the `audit_log` CHECK). */
export const AUDIT_ACTIONS = [
  "member.update",
  "member.reveal_sensitive",
  "membership.leave",
  "membership.rejoin",
  "badge.award",
  "badge.revoke",
  "card.regenerate",
  "export.members_csv",
  "export.member_data",
  "export.member_register",
  "export.emails",
  "member.send_access_link",
  "role.grant",
  "role.revoke",
  "member.anonymise",
  "member.purge",
  "account.purge_unconfirmed",
  "ops.cache_refresh",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** One row of `admin_list_activity`. */
export type AdminActivityRow = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_role?: string | null;
  actor_member_number: string | null;
  actor_name: string | null;
  action: string;
  target_member_id?: string | null;
  target_member_number: string | null;
  target_name: string | null;
  details?: unknown;
  reason?: string | null;
  total_count?: number;
};

/** A message value: plain text, a number, a key to translate (`i18n`) or a list of those. */
export type AuditParam = string | number | { i18n: string } | AuditParam[];
export type AuditText = { key: string; params: Record<string, AuditParam> };

export type AuditActor = {
  kind: "system" | "self" | "person";
  name: string | null;
  number: string | null;
  role: "board" | "superadmin" | null;
};

export type AuditDescription = {
  actor: AuditActor;
  sentence: AuditText;
  details: AuditText[];
  reason: string | null;
};

const NO_VALUE = "—";

type Rec = Record<string, unknown>;

function asRecord(value: unknown): Rec {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

/** A short non-blank string, or null. */
function text(value: unknown, max = 100): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed !== "" && trimmed.length <= max ? trimmed : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isoDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatAdminDate(value) : null;
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return allowed.find((item) => item === value) ?? null;
}

const FIELDS = ["first_name", "last_name", "postal_code", "ludoya_username", "bgg_username", "phone", "dni"] as const;
const NAME_FIELDS = ["first_name", "last_name"] as const;
const REVEAL_FIELDS = ["dni", "phone"] as const;
const BADGES = ["volunteer_egara_joga", "ludoteca_donor"] as const;
const ROLES = ["member", "admin", "board", "superadmin"] as const;
const CHANNELS = ["form", "email", "in_person", "other"] as const;
const EMAIL_LISTS = ["association", "newsletter"] as const;
const STATES = ["active", "former", "all"] as const;
const ROLE_FILTERS = ["all", "member", "board", "superadmin"] as const;
const JOBS = ["ludoya", "bgg"] as const;

const t = (key: string, params: AuditText["params"] = {}): AuditText => ({ key, params });
const detail = (key: string, params: AuditText["params"] = {}) => t(`detail.${key}`, params);

function badgeParam(raw: unknown): AuditParam | null {
  const known = oneOf(BADGES, raw);
  if (known) return { i18n: `badge.${known}` };
  return text(raw, 60);
}

function actorOf(row: AdminActivityRow): AuditActor {
  const role: AuditActor["role"] = row.actor_role === "superadmin" ? "superadmin" : row.actor_role === "board" || row.actor_role === "admin" ? "board" : null;
  const base = { name: row.actor_name ?? null, number: row.actor_member_number ?? null, role };
  if (!row.actor_id) return { ...base, kind: "system", role: null };
  if (row.target_member_id && row.actor_id === row.target_member_id) return { ...base, kind: "self" };
  return { ...base, kind: "person" };
}

type Parts = { sentence: AuditText; details?: AuditText[] };

function rowsDetail(d: Rec): AuditText[] {
  const rows = count(d.rows);
  return rows === null ? [] : [detail("rows", { count: rows })];
}

function describeKnown(action: AuditAction, row: AdminActivityRow, actor: AuditActor, d: Rec): Parts {
  const number = row.target_member_number ?? NO_VALUE;
  const person = row.target_name ?? number;
  const sentence = (name: string, params: AuditText["params"] = {}) => t(`sentence.${name}`, params);

  switch (action) {
    case "member.update": {
      const details: AuditText[] = [];
      const fields = Array.isArray(d.fields)
        ? FIELDS.filter((field) => (d.fields as unknown[]).includes(field))
        : [];
      if (fields.length > 0) details.push(detail("fields", { fields: fields.map((f) => ({ i18n: `field.${f}` })) }));
      // Past names of an anonymised or purged member (target_name null) are never shown.
      const changes = row.target_name === null ? {} : asRecord(d.changes);
      for (const field of NAME_FIELDS) {
        const change = asRecord(changes[field]);
        const from = text(change.from);
        const to = text(change.to);
        if (from && to) details.push(detail("change", { field: { i18n: `field.${field}` }, from, to }));
      }
      return { sentence: sentence("member_update", { number }), details };
    }
    case "member.reveal_sensitive": {
      const field = oneOf(REVEAL_FIELDS, d.field);
      return field
        ? { sentence: sentence("member_reveal_sensitive", { number, field: { i18n: `field.${field}` } }) }
        : { sentence: sentence("member_reveal_sensitive_generic", { number }) };
    }
    case "membership.leave": {
      const date = isoDate(d.left_on);
      const details = date ? [detail("left_on", { date })] : [];
      return actor.kind === "self"
        ? { sentence: sentence("membership_leave_self"), details }
        : { sentence: sentence("membership_leave", { number }), details };
    }
    case "membership.rejoin": {
      const details: AuditText[] = [];
      const channel = oneOf(CHANNELS, d.channel);
      if (channel) details.push(detail("channel", { channel: { i18n: `channel.${channel}` } }));
      const previous = isoDate(d.previous_left_on);
      if (previous) details.push(detail("previous_left", { date: previous }));
      return { sentence: sentence("membership_rejoin", { number }), details };
    }
    case "badge.award":
    case "badge.revoke": {
      const badge = badgeParam(d.badge);
      const name = action === "badge.award" ? "badge_award" : "badge_revoke";
      const details: AuditText[] = [];
      const awardedOn = action === "badge.revoke" ? isoDate(d.awarded_on) : null;
      if (awardedOn) details.push(detail("awarded_on", { date: awardedOn }));
      return badge
        ? { sentence: sentence(name, { number, badge }), details }
        : { sentence: sentence(`${name}_generic`, { number }), details };
    }
    case "card.regenerate":
      return { sentence: sentence("card_regenerate", { number }), details: [detail("card_old_invalid")] };
    case "export.members_csv": {
      const filter = asRecord(d.filter);
      const state = oneOf(STATES, filter.state);
      const role = oneOf(ROLE_FILTERS, filter.role);
      const details: AuditText[] = [];
      if (state) {
        details.push(
          role && role !== "all"
            ? detail("filter_role", { state: { i18n: `state.${state}` }, role: { i18n: `role.${role}` } })
            : detail("filter", { state: { i18n: `state.${state}` } }),
        );
      }
      return { sentence: sentence("export_members_csv"), details: [...details, ...rowsDetail(d)] };
    }
    case "export.member_data":
      return { sentence: sentence("export_member_data", { number }) };
    case "export.member_register":
      return { sentence: sentence("export_member_register"), details: rowsDetail(d) };
    case "export.emails": {
      const list = oneOf(EMAIL_LISTS, d.list);
      const details: AuditText[] = list ? [detail("list", { list: { i18n: `list.${list}` } })] : [];
      const rows = count(d.rows);
      if (rows !== null) details.push(detail("addresses", { count: rows }));
      return { sentence: sentence("export_emails"), details };
    }
    case "member.send_access_link":
      return { sentence: sentence("member_send_access_link", { number }), details: [detail("access_link_email")] };
    case "role.grant":
    case "role.revoke": {
      const grant = action === "role.grant";
      const role = oneOf(ROLES, grant ? d.to : d.from);
      const name = grant ? "role_grant" : "role_revoke";
      return role
        ? { sentence: sentence(name, { person, role: { i18n: `role.${role}` } }) }
        : { sentence: sentence(`${name}_generic`, { person }) };
    }
    case "member.anonymise": {
      const details: AuditText[] = [];
      const purgeOn = isoDate(d.purge_on);
      if (purgeOn) details.push(detail("purge_on", { date: purgeOn }));
      const badges = count(d.badges_deleted);
      if (badges) details.push(detail("badges_deleted", { count: badges }));
      return { sentence: sentence("member_anonymise", { number }), details };
    }
    case "member.purge": {
      const leftOn = isoDate(d.left_on);
      const details = [detail("purge_policy"), ...(leftOn ? [detail("left_on", { date: leftOn })] : [])];
      return { sentence: sentence("member_purge", { number }), details };
    }
    case "account.purge_unconfirmed": {
      const accounts = count(d.accounts_deleted);
      return {
        sentence:
          accounts === null
            ? sentence("account_purge_unconfirmed_generic")
            : sentence("account_purge_unconfirmed", { count: accounts }),
        details: [detail("unconfirmed_policy")],
      };
    }
    case "ops.cache_refresh": {
      const jobs = Array.isArray(d.jobs) ? JOBS.filter((job) => (d.jobs as unknown[]).includes(job)) : [];
      const details: AuditText[] = [];
      if (d.ok === true) details.push(detail("refresh_ok"));
      else if (d.ok === false) details.push(detail("refresh_failed"));
      if (jobs.length > 0) details.push(detail("jobs", { jobs: jobs.map((job) => ({ i18n: `job.${job}` })) }));
      return { sentence: sentence("ops_cache_refresh"), details };
    }
  }
}

function isKnownAction(action: string): action is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(action);
}

/** Structured sentence, detail parts and reason of one audit entry. Never throws. */
export function describeAuditEntry(row: AdminActivityRow): AuditDescription {
  const actor = actorOf(row);
  const reason = text(row.reason ?? null, 1000);
  const d = asRecord(row.details);

  let parts: Parts;
  if (isKnownAction(row.action)) {
    parts = describeKnown(row.action, row, actor, d);
  } else {
    const action = typeof row.action === "string" ? row.action.slice(0, 80) : NO_VALUE;
    parts = row.target_member_number
      ? { sentence: t("sentence.unknown_target", { action, number: row.target_member_number }) }
      : { sentence: t("sentence.unknown", { action }) };
  }

  return { actor, sentence: parts.sentence, details: parts.details ?? [], reason };
}

export type AuditTime = { kind: "today" | "yesterday" | "date"; time: string; date: string };

const MADRID = { timeZone: "Europe/Madrid" } as const;

function madridParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    ...MADRID,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { y: Number(pick("year")), m: Number(pick("month")), d: Number(pick("day")), hh: pick("hour"), mm: pick("minute") };
}

/** "Avui 10:42" / "Ahir 19:30" / "3/10/2026 20:10" parts, in Madrid time. Null for an invalid date. */
export function describeAuditTime(iso: string, now: Date = new Date()): AuditTime | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const a = madridParts(at);
  const n = madridParts(now);
  const dayNumber = (p: { y: number; m: number; d: number }) => Date.UTC(p.y, p.m - 1, p.d) / 86_400_000;
  const diff = dayNumber(n) - dayNumber(a);
  return {
    kind: diff === 0 ? "today" : diff === 1 ? "yesterday" : "date",
    time: `${a.hh}:${a.mm}`,
    date: `${a.d}/${a.m}/${a.y}`,
  };
}
