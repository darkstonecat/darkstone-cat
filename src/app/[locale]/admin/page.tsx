import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import type { AdminActivityRow } from "@/lib/admin/audit-format";
import { OVERVIEW_ACTIVITY_LIMIT, parseAdminStats } from "@/lib/admin/stats";
import AdminOverview from "@/components/admin/overview/AdminOverview";

// Live figures and audit entries: computed per request, never cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/admin");
  return {
    title: t("admin_title"),
    description: t("admin_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("admin_title"),
      description: t("admin_description"),
      url: alternates.canonical,
    },
  };
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Board members and superadmins only; anyone else gets the 404 page.
  await requireRole("board", "/admin");

  const [tNav, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/admin",
    tMeta("admin_title"),
    tMeta("admin_description"),
  );

  // The user's own session: the RPCs check the role and never return personal data.
  const supabase = await createClient();
  const [statsResult, activityResult] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.rpc("admin_list_activity", { p_limit: OVERVIEW_ACTIVITY_LIMIT }),
  ]);
  if (statsResult.error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/overview] stats failed code=%s", statsResult.error.code ?? "unknown");
  }
  if (activityResult.error) {
    console.error("[admin/overview] activity failed code=%s", activityResult.error.code ?? "unknown");
  }
  const stats = statsResult.error ? null : parseAdminStats(statsResult.data);
  const activity = activityResult.error ? null : ((activityResult.data ?? []) as AdminActivityRow[]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <AdminOverview stats={stats} activity={activity} />
    </>
  );
}
