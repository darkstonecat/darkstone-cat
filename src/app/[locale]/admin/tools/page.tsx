import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { parseOpsStatus } from "@/lib/admin/ops-status";
import ToolsContent from "@/components/admin/tools/ToolsContent";

// Run history: never cached or prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/admin/tools");
  return {
    title: t("admin_tools_title"),
    description: t("admin_tools_description"),
    alternates,
    robots: { index: false, follow: false },
  };
}

export default async function AdminToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Board members and superadmins only; anyone else gets the 404 page.
  await requireRole("board", "/admin/tools");

  const [tNav, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
    { name: tNav("admin_tools"), path: "/admin/tools" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/admin/tools",
    tMeta("admin_tools_title"),
    tMeta("admin_tools_description"),
  );

  // The user's own session: the function checks the role and returns no personal data beyond
  // the name of the board member who ran the last manual refresh.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_ops_status");
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/tools] ops_status failed code=%s", error.code ?? "unknown");
  }
  const jobs = error ? null : parseOpsStatus(data);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <ToolsContent jobs={jobs} />
    </>
  );
}
