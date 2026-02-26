import { type Metadata } from "next";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import LudotecaHero from "@/components/ludoteca/LudotecaHero";
import LudotecaClient from "@/components/ludoteca/LudotecaClient";
import { fetchBggCollection } from "@/lib/bgg";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Ludoteca — Darkstone Catalunya",
  description:
    "Descobreix la col·lecció de jocs de taula de Darkstone Catalunya. Més de 250 jocs disponibles per jugar.",
};

export default async function LudotecaPage() {
  const collection = await fetchBggCollection();

  return (
    <main className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <NavBar />
      <LudotecaHero
        totalGames={collection.baseCount}
        totalWithExpansions={collection.totalWithExpansions}
      />

      <section className="flex-1 bg-brand-beige pb-20">
        <Suspense>
          <LudotecaClient
            games={collection.games}
            error={collection.error}
          />
        </Suspense>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}
