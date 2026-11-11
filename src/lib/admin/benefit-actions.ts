"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/admin/guard";
import { benefitDbErrorCode, type AdminActionError } from "@/lib/admin/action-errors";
import { isBenefitId, parseBenefitInput, type BenefitField, type BenefitInput } from "@/lib/admin/benefits";

/*
 * Board actions on member benefits (odd/tasks/member-benefits.md S4, S7). Each one checks the
 * role with `getAdminAccess("board")`, validates its input, then calls the SECURITY DEFINER
 * `admin_*` function with the user's SESSION client: the function checks the role again and
 * writes the audit entry with `auth.uid()` as the actor (never the service role).
 *
 * Errors are stable codes; database messages are never returned, and only the action name and
 * the Postgres code are logged (never a discount code).
 */

export type BenefitActionFail = { error: AdminActionError; field?: BenefitField };

type Authorised = { ok: true } | { error: AdminActionError };

async function authorise(): Promise<Authorised> {
  const access = await getAdminAccess("board");
  return access.status === "ok" ? { ok: true } : { error: access.status };
}

async function authoriseOnBenefit(id: unknown): Promise<Authorised> {
  const auth = await authorise();
  if ("error" in auth) return auth;
  return isBenefitId(id) ? auth : { error: "not_found" };
}

type RpcError = { code?: string | null; message?: string | null } | null;

function fail(action: string, error: RpcError): BenefitActionFail {
  console.error("[admin-benefit] %s failed code=%s", action, error?.code || "unknown");
  return { error: benefitDbErrorCode(error) };
}

function invalid(field: BenefitField | null): BenefitActionFail {
  return field ? { error: "invalid", field } : { error: "invalid" };
}

function revalidateBenefitPages(): void {
  revalidatePath("/[locale]/admin/benefits", "page");
  revalidatePath("/[locale]/profile", "page");
}

/** "Nou benefici": placed last. Returns the new id. */
export async function createBenefit(input: BenefitInput): Promise<{ ok: true; id: string } | BenefitActionFail> {
  const auth = await authorise();
  if ("error" in auth) return auth;

  const parsed = parseBenefitInput(input && typeof input === "object" ? { ...input, sortOrder: undefined } : input);
  if (!parsed.ok) return invalid(parsed.field);
  const benefit = parsed.value;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_benefit", {
    p_name: benefit.name,
    p_description: benefit.description,
    p_url: benefit.url,
    p_discount_code: benefit.discount_code,
    p_collaborator_id: benefit.collaborator_id,
  });
  if (error) return fail("create_benefit", error);
  if (typeof data !== "string") return fail("create_benefit", null);

  revalidateBenefitPages();
  return { ok: true, id: data };
}

/**
 * Sends every field of the dialog; the database compares them with the stored row and returns
 * the ones that changed (`no_value` when none did).
 */
export async function updateBenefit(
  id: string,
  input: BenefitInput
): Promise<{ ok: true; changed: string[] } | BenefitActionFail> {
  const auth = await authoriseOnBenefit(id);
  if ("error" in auth) return auth;

  const parsed = parseBenefitInput(input);
  if (!parsed.ok) return invalid(parsed.field);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_benefit", { p_id: id, p_patch: parsed.value });
  if (error) return fail("update_benefit", error);

  revalidateBenefitPages();
  return { ok: true, changed: Array.isArray(data) ? data.filter((f): f is string => typeof f === "string") : [] };
}

/** Hides the benefit from every member. */
export async function archiveBenefit(id: string): Promise<{ ok: true } | BenefitActionFail> {
  return stateChange(id, "admin_archive_benefit", "archive_benefit");
}

export async function restoreBenefit(id: string): Promise<{ ok: true } | BenefitActionFail> {
  return stateChange(id, "admin_restore_benefit", "restore_benefit");
}

async function stateChange(
  id: string,
  fn: "admin_archive_benefit" | "admin_restore_benefit",
  action: string
): Promise<{ ok: true } | BenefitActionFail> {
  const auth = await authoriseOnBenefit(id);
  if ("error" in auth) return auth;

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_id: id });
  if (error) return fail(action, error);

  revalidateBenefitPages();
  return { ok: true };
}
