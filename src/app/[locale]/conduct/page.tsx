import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ConductContent from "@/components/conduct/ConductContent";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/conduct");
  return {
    title: t("conduct_title"),
    description: t("conduct_description"),
    alternates,
    robots: { index: false, follow: true },
    openGraph: {
      title: t("conduct_title"),
      description: t("conduct_description"),
      url: alternates.canonical,
      images: [{ url: `${alternates.canonical}/opengraph-image`, width: 1200, height: 630, alt: t("conduct_title") }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
      creator: "@darkstonecat",
      title: t("conduct_title"),
      description: t("conduct_description"),
    },
  };
}

export default async function ConductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [tNav, t] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("conduct"), path: "/conduct" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/conduct", t("conduct_title"), t("conduct_description"));

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <ConductContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
