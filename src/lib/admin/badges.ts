/**
 * Badge catalogue screens (`/admin/badges`, odd/tasks/badge-catalogue.md S7): input validators
 * shared by the server actions (`badge-actions.ts`) and the forms, the key suggested from a name,
 * and the row types of `admin_list_badges` / `admin_list_badge_holders`.
 * Pure module (no `server-only`): client and server import it.
 *
 * The limits mirror the database (20261103100000_badge_catalogue.sql): key
 * `^[a-z][a-z0-9_]{2,47}$` minus the reserved tenure keys, names 60 and texts 200 characters
 * once trimmed, at most 100 members per bulk award, notes of 500 characters.
 */

import { isBadgeIconKey, type BadgeIconKey, type LocalizedText } from "@/lib/badges/catalogue";

export const BADGE_KEY_MAX = 48;
export const BADGE_NAME_MAX = 60;
export const BADGE_TEXT_MAX = 200;
export const BADGE_NOTE_MAX = 500;
export const BADGE_BULK_MAX = 100;
/** Results of the bulk award member search. */
export const BADGE_SEARCH_LIMIT = 20;
/** `sort_order` as `admin_update_badge` accepts it: up to 6 digits, sign allowed. */
export const BADGE_SORT_ORDER_MAX = 999_999;

const BADGE_KEY_RE = /^[a-z][a-z0-9_]{2,47}$/;
/** Keys of the derived tenure badge (current and retired): never in the catalogue. */
const RESERVED_BADGE_KEYS: readonly string[] = ["member_tenure", "member_year"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES = ["ca", "es", "en"] as const;

/** One row of `admin_list_badges` (every badge, archived ones included, in display order). */
export type AdminBadgeRow = {
  key: string;
  name: LocalizedText;
  earned_text: LocalizedText;
  locked_text: LocalizedText;
  icon: BadgeIconKey;
  sort_order: number;
  show_locked: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** Holders, purged stubs excluded (former members included). */
  holders: number;
  /** Active holders: who stops seeing it when it is archived. */
  active_holders: number;
  /** A holder now or a `badge.award` entry ever: `admin_delete_badge` refuses it. */
  ever_awarded: boolean;
};

/** One holder of a badge (`admin_list_badge_holders`), active ones first. */
export type BadgeHolder = {
  memberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  state: "active" | "former";
  awardedAt: string;
};

/** Fields of the "Nova insígnia" dialog (Catalan only; the badge page adds es / en). */
export type NewBadgeInput = { key: string; name: string; earnedText: string; lockedText: string };
export type NewBadgeField = keyof NewBadgeInput;

/** Fields the badge page can change (`admin_update_badge`). The key never changes. */
export type BadgePatch = {
  name?: LocalizedText;
  earnedText?: LocalizedText;
  lockedText?: LocalizedText;
  icon?: BadgeIconKey;
  sortOrder?: number;
  showLocked?: boolean;
};
export type BadgePatchField = keyof BadgePatch;

/** The same patch with the database column names. */
export type BadgeDbPatch = {
  name?: LocalizedText;
  earned_text?: LocalizedText;
  locked_text?: LocalizedText;
  icon?: BadgeIconKey;
  sort_order?: number;
  show_locked?: boolean;
};

export const BADGE_PATCH_COLUMNS: Record<BadgePatchField, keyof BadgeDbPatch> = {
  name: "name",
  earnedText: "earned_text",
  lockedText: "locked_text",
  icon: "icon",
  sortOrder: "sort_order",
  showLocked: "show_locked",
};

/** Result of a validator: the clean value, or the field to point at (`null`: the whole input). */
export type Parsed<T, F> = { ok: true; value: T } | { ok: false; field: F | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Characters as the database counts them (`char_length`), not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

/** Trimmed, non-blank text of at most `max` characters, else null. */
export function parseBadgeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text !== "" && length(text) <= max ? text : null;
}

export function isBadgeKey(value: unknown): value is string {
  return typeof value === "string" && BADGE_KEY_RE.test(value) && !RESERVED_BADGE_KEYS.includes(value);
}

/**
 * A key proposed from a Catalan (or Spanish) name: accents folded, `l·l` → `ll`, lower case,
 * anything else → `_`, no leading/trailing or doubled `_`, starting with a letter, at most 48
 * characters. "" when nothing usable is left. The board can still edit it before creating.
 */
export function suggestBadgeKey(name: string): string {
  if (typeof name !== "string") return "";
  const folded = name
    .replace(/ŀ/g, "l")
    .replace(/Ŀ/g, "L")
    .replace(/l[·.]l/gi, (match) => match[0] + match[2])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "");
  return folded.slice(0, BADGE_KEY_MAX).replace(/_+$/, "");
}

/** `{ca, es?, en?}`: ca required, every text trimmed and within `max`; a blank es / en is dropped. */
export function parseLocalizedText(value: unknown, max: number): LocalizedText | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((locale) => !(LOCALES as readonly string[]).includes(locale))) return null;
  const ca = parseBadgeText(value.ca, max);
  if (!ca) return null;
  const text: LocalizedText = { ca };
  for (const locale of ["es", "en"] as const) {
    const raw = value[locale];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") return null;
    if (raw.trim() === "") continue;
    const parsed = parseBadgeText(raw, max);
    if (!parsed) return null;
    text[locale] = parsed;
  }
  return text;
}

/** The "Nova insígnia" dialog. */
export function parseNewBadge(input: unknown): Parsed<NewBadgeInput, NewBadgeField> {
  if (!isRecord(input)) return { ok: false, field: null };
  if (!isBadgeKey(input.key)) return { ok: false, field: "key" };
  const name = parseBadgeText(input.name, BADGE_NAME_MAX);
  if (!name) return { ok: false, field: "name" };
  const earnedText = parseBadgeText(input.earnedText, BADGE_TEXT_MAX);
  if (!earnedText) return { ok: false, field: "earnedText" };
  const lockedText = parseBadgeText(input.lockedText, BADGE_TEXT_MAX);
  if (!lockedText) return { ok: false, field: "lockedText" };
  return { ok: true, value: { key: input.key, name, earnedText, lockedText } };
}

const TEXT_LIMITS = { name: BADGE_NAME_MAX, earnedText: BADGE_TEXT_MAX, lockedText: BADGE_TEXT_MAX } as const;

/**
 * The badge page's changed fields → the `admin_update_badge` patch. Undefined fields are left
 * out; an unknown field (the key included) or an empty patch is refused.
 */
export function parseBadgePatch(input: unknown): Parsed<BadgeDbPatch, BadgePatchField | "key"> {
  if (!isRecord(input)) return { ok: false, field: null };
  const patch: BadgeDbPatch = {};

  for (const [field, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!Object.hasOwn(BADGE_PATCH_COLUMNS, field)) {
      return { ok: false, field: field === "key" ? "key" : null };
    }
    const key = field as BadgePatchField;
    switch (key) {
      case "name":
      case "earnedText":
      case "lockedText": {
        const text = parseLocalizedText(value, TEXT_LIMITS[key]);
        if (!text) return { ok: false, field: key };
        patch[BADGE_PATCH_COLUMNS[key] as "name" | "earned_text" | "locked_text"] = text;
        break;
      }
      case "icon":
        if (!isBadgeIconKey(value)) return { ok: false, field: key };
        patch.icon = value;
        break;
      case "sortOrder":
        if (!Number.isInteger(value) || Math.abs(value as number) > BADGE_SORT_ORDER_MAX) {
          return { ok: false, field: key };
        }
        patch.sort_order = value as number;
        break;
      case "showLocked":
        if (typeof value !== "boolean") return { ok: false, field: key };
        patch.show_locked = value;
        break;
    }
  }

  return Object.keys(patch).length > 0 ? { ok: true, value: patch } : { ok: false, field: null };
}

/** 1 to 100 member UUIDs, lower-cased and de-duplicated; null for anything else. */
export function parseMemberIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || !UUID_RE.test(id)) return null;
    ids.add(id.toLowerCase());
  }
  return ids.size <= BADGE_BULK_MAX ? [...ids] : null;
}

/** Optional award note: trimmed, blank → null, at most 500 characters. */
export function parseBadgeNote(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const note = value.trim();
  if (length(note) > BADGE_NOTE_MAX) return { ok: false };
  return { ok: true, value: note || null };
}

/** `admin_list_badge_holders` rows → holders; malformed rows are dropped. */
export function toBadgeHolders(rows: unknown): BadgeHolder[] {
  if (!Array.isArray(rows)) return [];
  const holders: BadgeHolder[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const { member_id, member_number, first_name, last_name, state, awarded_at } = row;
    if (typeof member_id !== "string" || typeof member_number !== "string") continue;
    if (state !== "active" && state !== "former") continue;
    if (typeof awarded_at !== "string") continue;
    holders.push({
      memberId: member_id,
      memberNumber: member_number,
      firstName: typeof first_name === "string" ? first_name : "",
      lastName: typeof last_name === "string" ? last_name : "",
      state,
      awardedAt: awarded_at,
    });
  }
  return holders;
}
