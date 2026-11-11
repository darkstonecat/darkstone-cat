/**
 * Member benefits screen (`/admin/benefits`, odd/tasks/member-benefits.md S7): the form
 * validator shared by the server actions (`benefit-actions.ts`) and the dialog, the logos the
 * board can pick and the row type of `admin_list_benefits`.
 * Pure module (no `server-only`): client and server import it.
 *
 * The limits mirror the database (20261111100000_member_benefits.sql): names 60 and descriptions
 * 200 characters once trimmed, https links of at most 300, codes of 1 to 40 characters without
 * spaces. The logo must be a collaborator of `src/data/collaborators.ts` (the database only checks
 * the slug shape).
 */

import { collaborators } from "@/data/collaborators";
import type { LocalizedText } from "@/lib/badges/catalogue";
import { BADGE_SORT_ORDER_MAX, parseLocalizedText, type Parsed } from "@/lib/admin/badges";

export const BENEFIT_NAME_MAX = 60;
export const BENEFIT_DESCRIPTION_MAX = 200;
export const BENEFIT_URL_MAX = 300;
export const BENEFIT_CODE_MAX = 40;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_RE = /^https:\/\/[^\s/]+\S*$/;
const CODE_RE = /^\S+$/;

/** Logos the board can pick: every collaborator, by name. */
export const BENEFIT_LOGOS: ReadonlyArray<{ id: string; name: string }> = collaborators
  .map((c) => ({ id: c.id, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name, "ca"));

/** One row of `admin_list_benefits` (archived ones included, active first, in display order). */
export type AdminBenefitRow = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  discount_code: string | null;
  url: string;
  collaborator_id: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** What the create / edit dialog sends. `sortOrder` only when editing. */
export type BenefitInput = {
  name: Partial<LocalizedText>;
  description: Partial<LocalizedText>;
  url: string;
  discountCode: string;
  collaboratorId: string;
  sortOrder?: number;
};

export type BenefitField = "name" | "description" | "url" | "discountCode" | "collaboratorId" | "sortOrder";

/** The `admin_create_benefit` arguments / `admin_update_benefit` patch, in database names. */
export type BenefitDbFields = {
  name: LocalizedText;
  description: LocalizedText;
  url: string;
  discount_code: string | null;
  collaborator_id: string | null;
  sort_order?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Characters as the database counts them (`char_length`), not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

export function isBenefitId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** The dialog's fields → database values; the first invalid field is named. */
export function parseBenefitInput(input: unknown): Parsed<BenefitDbFields, BenefitField> {
  if (!isRecord(input)) return { ok: false, field: null };

  const name = parseLocalizedText(input.name, BENEFIT_NAME_MAX);
  if (!name) return { ok: false, field: "name" };
  const description = parseLocalizedText(input.description, BENEFIT_DESCRIPTION_MAX);
  if (!description) return { ok: false, field: "description" };

  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!URL_RE.test(url) || length(url) > BENEFIT_URL_MAX) return { ok: false, field: "url" };

  if (typeof input.discountCode !== "string") return { ok: false, field: "discountCode" };
  const code = input.discountCode.trim();
  if (code !== "" && (!CODE_RE.test(code) || length(code) > BENEFIT_CODE_MAX)) {
    return { ok: false, field: "discountCode" };
  }

  if (typeof input.collaboratorId !== "string") return { ok: false, field: "collaboratorId" };
  const collaboratorId = input.collaboratorId.trim();
  if (collaboratorId !== "" && !BENEFIT_LOGOS.some((logo) => logo.id === collaboratorId)) {
    return { ok: false, field: "collaboratorId" };
  }

  const value: BenefitDbFields = {
    name,
    description,
    url,
    discount_code: code || null,
    collaborator_id: collaboratorId || null,
  };

  if (input.sortOrder !== undefined) {
    const order = input.sortOrder;
    if (typeof order !== "number" || !Number.isInteger(order) || Math.abs(order) > BADGE_SORT_ORDER_MAX) {
      return { ok: false, field: "sortOrder" };
    }
    value.sort_order = order;
  }

  return { ok: true, value };
}
