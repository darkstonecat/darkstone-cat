import { type Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import PrivacyContent from "@/components/legal/PrivacyContent";

export const metadata: Metadata = {
  title: "Política de privadesa — Darkstone Catalunya",
  description:
    "Política de privadesa de l'Associació Darkstone Catalunya. Informació sobre el tractament de dades personals.",
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <PrivacyContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
