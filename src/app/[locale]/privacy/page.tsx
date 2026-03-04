import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
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
    openGraph: {
      title: t("privacy_title"),
      description: t("privacy_description"),
      url: alternates.canonical,
    },
    twitter: {
      title: t("privacy_title"),
      description: t("privacy_description"),
    },
  };
}

export default function PrivacyPage() {
  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <PrivacyContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
