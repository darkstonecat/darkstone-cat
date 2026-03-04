import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
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
    openGraph: {
      title: t("cookies_title"),
      description: t("cookies_description"),
      url: alternates.canonical,
    },
    twitter: {
      title: t("cookies_title"),
      description: t("cookies_description"),
    },
  };
}

export default function CookiesPage() {
  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <CookiesContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
