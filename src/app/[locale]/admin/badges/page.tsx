import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { isSuperadmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { AdminBadgeRow } from "@/lib/admin/badges";
import BadgeCatalogue from "@/components/admin/badges/BadgeCatalogue";

// Live holder counts: never cached or prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("admin_badges_title"),
    description: t("admin_badges_description"),
    alternates: getAlternates(locale, "/admin/badges"),
    robots: { index: false, follow: false },
  };
}

/** V-7 badge catalogue (odd/tasks/badge-catalogue.md S7.2): every board member. */
export default async function AdminBadgesPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  const actor = await requireRole("board", "/admin/badges");

  // The user's own session: the function checks the role again.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_badges", {});
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/badges] list failed code=%s", error.code ?? "unknown");
  }

  return (
    <BadgeCatalogue
      badges={error || !Array.isArray(data) ? [] : (data as AdminBadgeRow[])}
      isSuperadmin={isSuperadmin(actor.role)}
      loadError={Boolean(error)}
    />
  );
}
