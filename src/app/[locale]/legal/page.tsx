import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import LegalContent from "@/components/legal/LegalContent";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/legal");
  return {
    title: t("legal_title"),
    description: t("legal_description"),
    alternates,
    robots: { index: false, follow: true },
    openGraph: {
      title: t("legal_title"),
      description: t("legal_description"),
      url: alternates.canonical,
    },
    twitter: {
      title: t("legal_title"),
      description: t("legal_description"),
    },
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: locale === "ca" ? "Avís legal" : locale === "es" ? "Aviso legal" : "Legal notice", path: "/legal" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/legal", t("legal_title"), t("legal_description"));

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <LegalContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
