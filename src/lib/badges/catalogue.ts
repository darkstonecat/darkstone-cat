/**
 * The badge catalogue as the app sees it (`public.badges`, odd/tasks/badge-catalogue.md).
 * Pure module (no `server-only`): shared by the member home, the admin member file and tests.
 * The tenure badge "X anys amb Darkstone" is not in the catalogue (see `member-tenure.ts`).
 */

/** Icons the board can pick. Mirrors `badge_icon_keys()` of the database, in the same order. */
export const BADGE_ICON_KEYS = [
  "star",
  "how_to_reg",
  "gift",
  "dice",
  "puzzle",
  "trophy",
  "volunteer",
  "groups",
  "school",
  "celebration",
  "book",
  "medal",
  "heart",
  "handshake",
  "brush",
  "megaphone",
] as const;

export type BadgeIconKey = (typeof BADGE_ICON_KEYS)[number];

export function isBadgeIconKey(value: unknown): value is BadgeIconKey {
  return typeof value === "string" && (BADGE_ICON_KEYS as readonly string[]).includes(value);
}

/** A translated text as stored: `ca` is required, `es` and `en` are optional. */
export type LocalizedText = { ca: string; es?: string; en?: string };

export type CatalogueBadge = {
  key: string;
  name: LocalizedText;
  earnedText: LocalizedText;
  lockedText: LocalizedText;
  icon: BadgeIconKey;
  sortOrder: number;
  showLocked: boolean;
};

/** Columns to select from `public.badges` for `toCatalogueBadge`. */
export const CATALOGUE_COLUMNS = "key, name, earned_text, locked_text, icon, sort_order, show_locked";

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * The text in `locale`, else in Catalan, else in any language it has. Empty string for a
 * missing or malformed text, so a broken row never crashes a page.
 */
export function localize(text: unknown, locale: string): string {
  if (text === null || typeof text !== "object" || Array.isArray(text)) return "";
  const record = text as Record<string, unknown>;
  return (
    nonBlank(record[locale]) ??
    nonBlank(record.ca) ??
    nonBlank(record.es) ??
    nonBlank(record.en) ??
    ""
  );
}

function asText(value: unknown): LocalizedText | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const ca = nonBlank(record.ca);
  if (!ca) return null;
  const text: LocalizedText = { ca };
  const es = nonBlank(record.es);
  const en = nonBlank(record.en);
  if (es) text.es = es;
  if (en) text.en = en;
  return text;
}

/** One `public.badges` row (snake_case, as PostgREST returns it), or null when unusable. */
export function toCatalogueBadge(row: unknown): CatalogueBadge | null {
  if (row === null || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const key = nonBlank(r.key);
  const name = asText(r.name);
  if (!key || !name) return null;
  return {
    key,
    name,
    earnedText: asText(r.earned_text) ?? name,
    lockedText: asText(r.locked_text) ?? name,
    icon: isBadgeIconKey(r.icon) ? r.icon : "star",
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
    showLocked: r.show_locked !== false,
  };
}

/** Rows of `public.badges` → usable badges, in display order. */
export function toCatalogue(rows: unknown[] | null | undefined): CatalogueBadge[] {
  return (rows ?? [])
    .map(toCatalogueBadge)
    .filter((badge): badge is CatalogueBadge => badge !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}
