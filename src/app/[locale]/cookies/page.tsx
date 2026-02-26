import { type Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import CookiesContent from "@/components/legal/CookiesContent";

export const metadata: Metadata = {
  title: "Política de cookies — Darkstone Catalunya",
  description:
    "Política de cookies de l'Associació Darkstone Catalunya. Informació sobre les cookies utilitzades en aquest lloc web.",
};

export default function CookiesPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <CookiesContent />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
