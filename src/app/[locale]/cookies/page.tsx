import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import CookiesContent from "@/components/legal/CookiesContent";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/cookies");
  return {
    title: t("cookies_title"),
    description: t("cookies_description"),
    alternates,
    robots: { index: false, follow: true },
    openGraph: {
      title: t("cookies_title"),
      description: t("cookies_description"),
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
      title: t("cookies_title"),
      description: t("cookies_description"),
    },
  };
}

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: "Cookies", path: "/cookies" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/cookies", t("cookies_title"), t("cookies_description"));

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <CookiesContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
