import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PrivacyContent from "@/components/legal/PrivacyContent";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/privacy");
  return {
    title: t("privacy_title"),
    description: t("privacy_description"),
    alternates,
    robots: { index: false, follow: true },
    openGraph: {
      title: t("privacy_title"),
      description: t("privacy_description"),
      url: alternates.canonical,
      images: [{
        url: locale === "ca"
          ? "https://www.darkstone.cat/opengraph-image/og"
          : `https://www.darkstone.cat/${locale}/opengraph-image/og`,
        width: 1200,
        height: 630,
        type: "image/png",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("privacy_title"),
      description: t("privacy_description"),
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: locale === "ca" ? "Privadesa" : locale === "es" ? "Privacidad" : "Privacy", path: "/privacy" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/privacy", t("privacy_title"), t("privacy_description"));

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <PrivacyContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
