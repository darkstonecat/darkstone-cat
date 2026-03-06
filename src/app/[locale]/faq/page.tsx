import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import FaqContent from "@/components/faq/FaqContent";

export const revalidate = false;

const FAQ_KEYS = [
  "what_is",
  "cost",
  "bring_games",
  "age",
  "location",
  "schedule",
  "non_member",
  "game_types",
  "rpg",
  "join",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/faq");
  return {
    title: t("faq_title"),
    description: t("faq_description"),
    alternates,
    robots: { index: true, follow: true },
    openGraph: {
      title: t("faq_title"),
      description: t("faq_description"),
      url: alternates.canonical,
      images: [{ url: `${alternates.canonical}/opengraph-image`, width: 1200, height: 630, alt: t("faq_title") }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
      creator: "@darkstonecat",
      title: t("faq_title"),
      description: t("faq_description"),
    },
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [tNav, tMeta, tFaq] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
    getTranslations({ locale, namespace: "faq" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("faq"), path: "/faq" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/faq", tMeta("faq_title"), tMeta("faq_description"));

  const faqPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_KEYS.map((key) => ({
      "@type": "Question",
      name: tFaq(`${key}_q`),
      acceptedAnswer: {
        "@type": "Answer",
        text: tFaq(`${key}_a`),
      },
    })),
  };

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd, faqPageJsonLd]) }}
      />
      <NavBar />
      <FaqContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
