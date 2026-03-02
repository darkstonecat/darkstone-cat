import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AboutHero from "@/components/about/AboutHero";
import AboutOrigin from "@/components/about/AboutOrigin";
import AboutMissionValues from "@/components/about/AboutMissionValues";
import AboutValues from "@/components/about/AboutValues";
import AboutCollaborators from "@/components/about/AboutCollaborators";
import SectionDivider from "@/components/home/SectionDivider";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("about_title"),
    description: t("about_description"),
  };
}

export default function AboutPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <AboutHero />
      <SectionDivider topColor="#1C1917" bottomColor="#EEE8DC" variant="curve" flip />
      <AboutOrigin />
      <AboutMissionValues />
      <AboutValues />
      <AboutCollaborators />
      <SectionDivider topColor="#EEE8DC" bottomColor="#111" variant="wave" animated />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
