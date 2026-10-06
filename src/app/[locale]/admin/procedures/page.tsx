import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import ProceduresContent from "@/components/admin/procedures/ProceduresContent";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/admin/procedures");
  return {
    title: t("admin_procedures_title"),
    description: t("admin_procedures_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("admin_procedures_title"),
      description: t("admin_procedures_description"),
      url: alternates.canonical,
    },
  };
}

export default async function AdminProceduresPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Every board member and superadmin can read the procedures; anyone else gets the 404 page.
  await requireRole("board", "/admin/procedures");

  const [tNav, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
    { name: tNav("admin_procedures"), path: "/admin/procedures" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/admin/procedures",
    tMeta("admin_procedures_title"),
    tMeta("admin_procedures_description"),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <ProceduresContent />
    </>
  );
}
