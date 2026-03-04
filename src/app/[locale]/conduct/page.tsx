import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
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
    openGraph: {
      title: t("conduct_title"),
      description: t("conduct_description"),
      url: alternates.canonical,
    },
    twitter: {
      title: t("conduct_title"),
      description: t("conduct_description"),
    },
  };
}

export default function ConductPage() {
  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <ConductContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
