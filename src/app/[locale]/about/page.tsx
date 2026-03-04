import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
import { fetchBggCollection } from "@/lib/bgg";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AboutHero from "@/components/about/AboutHero";
import AboutOrigin from "@/components/about/AboutOrigin";
import AboutStats from "@/components/about/AboutStats";
import AboutMissionValues from "@/components/about/AboutMissionValues";
import AboutValues from "@/components/about/AboutValues";
import AboutBoard from "@/components/about/AboutBoard";
import AboutTimeline from "@/components/about/AboutTimeline";
import AboutCollaborators from "@/components/about/AboutCollaborators";
import AboutWhyJoin from "@/components/about/AboutWhyJoin";
import AboutCTA from "@/components/about/AboutCTA";
import SectionDivider from "@/components/home/SectionDivider";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/about");
  return {
    title: t("about_title"),
    description: t("about_description"),
    alternates,
    openGraph: {
      title: t("about_title"),
      description: t("about_description"),
      url: alternates.canonical,
    },
    twitter: {
      title: t("about_title"),
      description: t("about_description"),
    },
  };
}

export default async function AboutPage() {
  const collection = await fetchBggCollection();
  const gameCount = collection.baseCount || 0;

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <AboutHero />
      <SectionDivider topColor="#1C1917" bottomColor="#EEE8DC" variant="curve" flip />
      <AboutOrigin />
      <AboutStats gameCount={gameCount} />
      <AboutMissionValues />
      <AboutValues />
      <AboutBoard />
      <AboutTimeline />
      <AboutCollaborators />
      <AboutWhyJoin />
      <AboutCTA />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
