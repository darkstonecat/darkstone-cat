"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess, type AdminLevel } from "@/lib/admin/guard";
import { badgeDbErrorCode, type AdminActionError } from "@/lib/admin/action-errors";
import { revalidateMemberPages } from "@/lib/admin/action-context";
import {
  BADGE_PATCH_COLUMNS,
  BADGE_SEARCH_LIMIT,
  isBadgeKey,
  parseBadgeNote,
  parseBadgePatch,
  parseMemberIds,
  parseNewBadge,
  toBadgeHolders,
  type AdminBadgeRow,
  type BadgeHolder,
  type BadgePatch,
  type BadgePatchField,
  type NewBadgeInput,
} from "@/lib/admin/badges";

/*
 * Board actions on the badge catalogue (odd/tasks/badge-catalogue.md S7.2-S7.6). Each one checks
 * the role with `getAdminAccess` (board; superadmin for delete), validates its input, then calls
 * the SECURITY DEFINER `admin_*` function with the user's SESSION client: the function checks the
 * role again and writes the audit entry with `auth.uid()` as the actor (never the service role).
 *
 * Errors are stable codes (`AdminActionError`; `field` names the invalid input when known);
 * database messages are never returned, and only the action name and the Postgres code are logged.
 */

export type BadgeActionFail = { error: AdminActionError; field?: string };

/** One result of the bulk award search. */
export type BadgeMemberOption = {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  alreadyHolds: boolean;
};

const MAX_QUERY_LENGTH = 100;
const PATCH_FIELDS = Object.fromEntries(
  Object.entries(BADGE_PATCH_COLUMNS).map(([field, column]) => [column, field])
) as Record<string, BadgePatchField>;

type Authorised = { ok: true } | { error: AdminActionError };

async function authorise(min: AdminLevel = "board"): Promise<Authorised> {
  const access = await getAdminAccess(min);
  return access.status === "ok" ? { ok: true } : { error: access.status };
}

/** Guard first, then the key of an existing badge. */
async function authoriseOnBadge(key: unknown, min: AdminLevel = "board"): Promise<Authorised> {
  const auth = await authorise(min);
  if ("error" in auth) return auth;
  return isBadgeKey(key) ? auth : { error: "invalid_badge" };
}

function logFailure(action: string, code: string | null | undefined): void {
  console.error("[admin-badge] %s failed code=%s", action, code || "unknown");
}

function invalid(field: string | null): BadgeActionFail {
  return field ? { error: "invalid", field } : { error: "invalid" };
}

function revalidateBadgePages(): void {
  revalidatePath("/[locale]/admin/badges", "page");
  revalidatePath("/[locale]/admin/badges/[key]", "page");
}

type RpcError = { code?: string | null; message?: string | null } | null;

/** Logs and maps a database error. */
function fail(action: string, error: RpcError): BadgeActionFail {
  logFailure(action, error?.code);
  return { error: badgeDbErrorCode(error) };
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/** Every badge, archived ones included, with holder counts (`admin_list_badges`). */
export async function listBadges(): Promise<{ ok: true; badges: AdminBadgeRow[] } | BadgeActionFail> {
  const auth = await authorise();
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_badges", {});
  if (error) return fail("list_badges", error);
  return { ok: true, badges: Array.isArray(data) ? (data as AdminBadgeRow[]) : [] };
}

/** Holders of one badge (archived ones too): active first, newest award first. */
export async function listBadgeHolders(key: string): Promise<{ ok: true; holders: BadgeHolder[] } | BadgeActionFail> {
  const auth = await authoriseOnBadge(key);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_badge_holders", { p_key: key });
  if (error) return fail("list_badge_holders", error);
  return { ok: true, holders: toBadgeHolders(data) };
}

/**
 * Active members matching a name, number or e-mail (`admin_list_members`, at most 20, by name),
 * each marked when it already holds the badge. A blank query lists the first 20.
 */
export async function searchMembersForBadge(
  key: string,
  query: string
): Promise<{ ok: true; members: BadgeMemberOption[] } | BadgeActionFail> {
  const auth = await authoriseOnBadge(key);
  if ("error" in auth) return auth;
  if (typeof query !== "string") return { error: "invalid" };
  const q = query.trim();
  if ([...q].length > MAX_QUERY_LENGTH) return { error: "invalid" };

  const supabase = await createClient();
  const [members, holders] = await Promise.all([
    supabase.rpc("admin_list_members", {
      p_state: "active",
      p_role: null,
      p_q: q || null,
      p_sort: "name_asc",
      p_limit: BADGE_SEARCH_LIMIT,
      p_offset: 0,
    }),
    supabase.rpc("admin_list_badge_holders", { p_key: key }),
  ]);
  if (holders.error) return fail("search_members_for_badge", holders.error);
  if (members.error) return fail("search_members_for_badge", members.error);

  const holding = new Set(toBadgeHolders(holders.data).map((holder) => holder.memberId));
  const rows = Array.isArray(members.data) ? (members.data as Record<string, unknown>[]) : [];
  return {
    ok: true,
    members: rows
      .filter((row) => typeof row.id === "string" && typeof row.member_number === "string")
      .map((row) => ({
        id: row.id as string,
        memberNumber: row.member_number as string,
        firstName: typeof row.first_name === "string" ? row.first_name : "",
        lastName: typeof row.last_name === "string" ? row.last_name : "",
        alreadyHolds: holding.has(row.id as string),
      })),
  };
}

// ---------------------------------------------------------------------------------------------
// Catalogue changes
// ---------------------------------------------------------------------------------------------

/** "Nova insígnia": Catalan texts only, icon "star", shown locked; placed last. */
export async function createBadge(input: NewBadgeInput): Promise<{ ok: true; key: string } | BadgeActionFail> {
  const auth = await authorise();
  if ("error" in auth) return auth;

  const parsed = parseNewBadge(input);
  if (!parsed.ok) return invalid(parsed.field);
  const badge = parsed.value;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_badge", {
    p_key: badge.key,
    p_name: { ca: badge.name },
    p_earned_text: { ca: badge.earnedText },
    p_locked_text: { ca: badge.lockedText },
    p_icon: "star",
    p_show_locked: true,
  });
  if (error) return fail("create_badge", error);

  revalidateBadgePages();
  return { ok: true, key: badge.key };
}

/**
 * Sends only the fields present in `patch` (the page sends what changed). Returns the fields
 * that really changed, in the patch's names; `no_value` when nothing would change.
 */
export async function updateBadge(
  key: string,
  patch: BadgePatch
): Promise<{ ok: true; changed: BadgePatchField[] } | BadgeActionFail> {
  const auth = await authoriseOnBadge(key);
  if ("error" in auth) return auth;

  if (patch && typeof patch === "object" && !Array.isArray(patch) && Object.values(patch).every((v) => v === undefined)) {
    return { error: "no_value" };
  }
  const parsed = parseBadgePatch(patch);
  if (!parsed.ok) return invalid(parsed.field);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_badge", { p_key: key, p_patch: parsed.value });
  if (error) return fail("update_badge", error);

  const changed = (Array.isArray(data) ? data : [])
    .map((column) => (typeof column === "string" && Object.hasOwn(PATCH_FIELDS, column) ? PATCH_FIELDS[column] : null))
    .filter((field): field is BadgePatchField => field !== null);
  // Names, texts and icons show on the member file too.
  revalidateBadgePages();
  revalidateMemberPages();
  return { ok: true, changed };
}

/** Hides the badge from every member; holders keep their rows (restore is lossless). */
export async function archiveBadge(key: string): Promise<{ ok: true } | BadgeActionFail> {
  return simpleBadgeChange(key, "admin_archive_badge", "archive_badge", "board");
}

export async function restoreBadge(key: string): Promise<{ ok: true } | BadgeActionFail> {
  return simpleBadgeChange(key, "admin_restore_badge", "restore_badge", "board");
}

/** Superadmin only, and only for a badge never awarded (`badge_in_use` otherwise). */
export async function deleteBadge(key: string): Promise<{ ok: true } | BadgeActionFail> {
  return simpleBadgeChange(key, "admin_delete_badge", "delete_badge", "superadmin");
}

async function simpleBadgeChange(
  key: string,
  fn: "admin_archive_badge" | "admin_restore_badge" | "admin_delete_badge",
  action: string,
  min: AdminLevel
): Promise<{ ok: true } | BadgeActionFail> {
  const auth = await authoriseOnBadge(key, min);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_key: key });
  if (error) return fail(action, error);

  revalidateBadgePages();
  // A deleted badge was never awarded: no member page shows it.
  if (fn !== "admin_delete_badge") revalidateMemberPages();
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Bulk award
// ---------------------------------------------------------------------------------------------

/**
 * "Atorga a socis": one badge to 1..100 active members, all or nothing. Members who already
 * hold it are skipped. One audit entry per new holder, with the note as reason.
 */
export async function awardBadgeToMembers(
  key: string,
  memberIds: string[],
  note?: string | null
): Promise<{ ok: true; awarded: number; skipped: number } | BadgeActionFail> {
  const auth = await authoriseOnBadge(key);
  if ("error" in auth) return auth;

  const ids = parseMemberIds(memberIds);
  if (!ids) return { error: "invalid" };
  const parsedNote = parseBadgeNote(note);
  if (!parsedNote.ok) return { error: typeof note === "string" ? "reason_too_long" : "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_award_badge_bulk", {
    p_badge_key: key,
    p_member_ids: ids,
    p_note: parsedNote.value,
  });
  if (error) {
    const result = fail("award_badge_bulk", error);
    // The ids were checked here, so the only invalid argument left is a badge outside the catalogue.
    return result.error === "invalid" ? { error: "invalid_badge" } : result;
  }

  const row = (Array.isArray(data) ? data[0] : data) as { awarded?: unknown; skipped?: unknown } | null;
  const awarded = typeof row?.awarded === "number" ? row.awarded : 0;
  const skipped = typeof row?.skipped === "number" ? row.skipped : 0;

  revalidateBadgePages();
  revalidateMemberPages();
  return { ok: true, awarded, skipped };
}
