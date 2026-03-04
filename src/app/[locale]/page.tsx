import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import ScrollProgress from "@/components/ScrollProgress";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import Hero from "@/components/home/Hero";
import About from "@/components/home/About";
import Activities from "@/components/home/Activities";
import Schedule from "@/components/home/Schedule";
import JoinUs from "@/components/home/JoinUs";
import Location from "@/components/home/Location";
import Collaborators from "@/components/home/Collaborators";
import SectionDivider from "@/components/home/SectionDivider";

const localeToOg: Record<string, string> = {
  ca: "ca_ES",
  es: "es_ES",
  en: "en_US",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "");
  return {
    title: t("home_title"),
    description: t("home_description"),
    alternates,
    openGraph: {
      title: t("home_og_title"),
      description: t("home_og_description"),
      url: alternates.canonical,
      siteName: "Darkstone Catalunya",
      locale: localeToOg[locale] ?? "ca_ES",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
      title: t("home_og_title"),
      description: t("home_og_description"),
    },
  };
}

export default function HomePage() {
  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
        <ScrollProgress />
        <NavBar />
        <Hero />
        <div className="relative z-10 -mt-[40vh]">
          <SectionDivider topColor="transparent" bottomColor="#1C1917" variant="wave" animated />
          <About />
        </div>
        <div className="relative z-20 -mt-[15vh]">
          <SectionDivider topColor="transparent" bottomColor="#EEE8DC" variant="wave" animated />
          <Activities />
        </div>
        <SectionDivider topColor="#EEE8DC" bottomColor="#1C1917" variant="wave" animated />
        <Schedule />
        <SectionDivider topColor="#1C1917" bottomColor="#EEE8DC" variant="curve" flip />
        <JoinUs />
        <Collaborators />
        <Location />
        <Footer />
        <ScrollToTop />
    </main>
  );
}
