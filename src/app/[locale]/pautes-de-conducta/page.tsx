import { type Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ConductContent from "@/components/conduct/ConductContent";

export const metadata: Metadata = {
  title: "Pautes de conducta — Darkstone Catalunya",
  description:
    "Pautes de conducta de l'Associació Darkstone Catalunya. Espai segur, comunicació respectuosa i col·laboració.",
};

export default function ConductPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <ConductContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
