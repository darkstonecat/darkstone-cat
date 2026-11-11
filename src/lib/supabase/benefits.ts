import "server-only";
import { createClient } from "./server";
import { BENEFIT_COLUMNS, toBenefitViews, type BenefitView } from "@/lib/benefits/view";

/**
 * Benefits the signed-in member may see, in `locale`. RLS returns rows only to an ACTIVE member
 * and hides archived ones, so the discount codes never reach anyone else. Empty on error: the
 * profile simply shows no benefits card.
 */
export async function getMemberBenefits(locale: string): Promise<BenefitView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_benefits")
    .select(BENEFIT_COLUMNS)
    .is("archived_at", null)
    .order("sort_order");
  if (error) {
    console.error("[benefits] read failed code=%s", error.code ?? "unknown");
    return [];
  }
  return toBenefitViews(data, locale);
}
