import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import LegalContent from "@/components/legal/LegalContent";

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
  };
}

export default function LegalPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <LegalContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
