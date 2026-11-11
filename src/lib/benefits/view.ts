import { collaborators } from "@/data/collaborators";
import { localize } from "@/lib/badges/catalogue";

/** Columns to select from `public.member_benefits` for `toBenefitViews`. */
export const BENEFIT_COLUMNS = "id, name, description, discount_code, url, collaborator_id, sort_order";

export type BenefitLogo = {
  src: string;
  /** Collaborator name, used as the image alt text. */
  name: string;
  background: string | null;
  invert: boolean;
};

/** A benefit ready to render: texts already in the page locale. */
export type BenefitView = {
  id: string;
  name: string;
  description: string;
  code: string | null;
  url: string;
  logo: BenefitLogo | null;
};

/** The logo of a collaborator of `src/data/collaborators.ts`, or null for an unknown id. */
export function collaboratorLogo(id: unknown): BenefitLogo | null {
  if (typeof id !== "string" || id === "") return null;
  const collaborator = collaborators.find((c) => c.id === id);
  if (!collaborator) return null;
  return {
    src: collaborator.logo,
    name: collaborator.name,
    background: collaborator.brandColor ?? null,
    invert: collaborator.invertLogo === true,
  };
}

function nonBlank(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Rows of `public.member_benefits` (snake_case, as PostgREST returns them) → benefits in
 * display order. A row without id, Catalan name or https link is dropped, so a broken row never
 * reaches the page (the database enforces the same rules).
 */
export function toBenefitViews(rows: unknown[] | null | undefined, locale: string): BenefitView[] {
  const entries: Array<{ order: number; view: BenefitView }> = [];
  for (const row of rows ?? []) {
    if (row === null || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = nonBlank(r.id);
    const name = localize(r.name, locale);
    const url = nonBlank(r.url);
    const hasCatalan = r.name !== null && typeof r.name === "object" && nonBlank((r.name as Record<string, unknown>).ca);
    if (!id || !hasCatalan || !url || !url.startsWith("https://")) continue;
    entries.push({
      order: typeof r.sort_order === "number" ? r.sort_order : 0,
      view: {
        id,
        name,
        description: localize(r.description, locale),
        code: nonBlank(r.discount_code),
        url,
        logo: collaboratorLogo(r.collaborator_id),
      },
    });
  }
  return entries.sort((a, b) => a.order - b.order).map((entry) => entry.view);
}
