import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { listAllMembersForAdmin } from "@/lib/admin/members";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const revalidate = false;

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
  const actor = await requireRole("board", "/admin");

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

  let stats = { total: 0, newThisMonth: 0, newsletter: 0 };
  const { data: members } = await listAllMembersForAdmin(actor);
  if (members) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    stats = {
      total: members.length,
      newThisMonth: members.filter((m) => {
        if (!m.created_at) return false;
        return new Date(m.created_at) >= firstOfMonth;
      }).length,
      newsletter: members.filter((m) => m.newsletter_accepted).length,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <div className="container mx-auto max-w-4xl px-6 pt-16">
        <AdminDashboard stats={stats} />
      </div>
    </>
  );
}
