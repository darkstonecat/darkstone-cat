import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import type { AdminBenefitRow } from "@/lib/admin/benefits";
import BenefitList from "@/components/admin/benefits/BenefitList";

// Board data: never cached or prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("admin_benefits_title"),
    description: t("admin_benefits_description"),
    alternates: getAlternates(locale, "/admin/benefits"),
    robots: { index: false, follow: false },
  };
}

/** V-9 member benefits (odd/tasks/member-benefits.md S7): every board member. */
export default async function AdminBenefitsPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  await requireRole("board", "/admin/benefits");

  // The user's own session: the function checks the role again.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_benefits", {});
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/benefits] list failed code=%s", error.code ?? "unknown");
  }

  return (
    <BenefitList
      benefits={error || !Array.isArray(data) ? [] : (data as AdminBenefitRow[])}
      loadError={Boolean(error)}
    />
  );
}
