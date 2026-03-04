import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
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
  return {
    title: t("legal_title"),
    description: t("legal_description"),
    alternates: getAlternates(locale, "/legal"),
  };
}

export default function LegalPage() {
  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <LegalContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
