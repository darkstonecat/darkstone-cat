import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import LudotecaHero from "@/components/ludoteca/LudotecaHero";
import LudotecaClient from "@/components/ludoteca/LudotecaClient";
import { fetchBggCollection } from "@/lib/bgg";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("ludoteca_title"),
    description: t("ludoteca_description"),
  };
}

export default async function LudotecaPage() {
  const collection = await fetchBggCollection();

  return (
    <main className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <NavBar />
      <LudotecaHero
        totalGames={collection.baseCount}
        totalWithExpansions={collection.totalWithExpansions}
      />

      <section className="flex-1 bg-brand-beige pb-8 md:pb-20">
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
