import { type Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import LegalContent from "@/components/legal/LegalContent";

export const metadata: Metadata = {
  title: "Avís legal — Darkstone Catalunya",
  description:
    "Avís legal de l'Associació Darkstone Catalunya. Identificació del titular, propietat intel·lectual i legislació aplicable.",
};

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
