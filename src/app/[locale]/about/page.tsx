import { type Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AboutHero from "@/components/about/AboutHero";
import AboutOrigin from "@/components/about/AboutOrigin";
import AboutMissionValues from "@/components/about/AboutMissionValues";
import BoardMembers from "@/components/about/BoardMembers";

export const metadata: Metadata = {
  title: "Qui som — Darkstone Catalunya",
  description:
    "Coneix l'Associació Darkstone Catalunya: el nostre origen, missió, valors i la junta directiva.",
};

export default function AboutPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <AboutHero />
      <AboutOrigin />
      <AboutMissionValues />
      <BoardMembers />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
