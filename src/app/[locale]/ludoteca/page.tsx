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
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <NavBar />
      <LudotecaHero
        totalGames={collection.baseCount}
        totalWithExpansions={collection.totalWithExpansions}
      />

      <section className="flex-1 bg-brand-beige pb-8 md:pb-20">
        <Suspense
          fallback={
            <div className="container mx-auto px-4 pt-8 md:px-6">
              {/* Toolbar skeleton */}
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="h-10 w-32 animate-pulse rounded-lg bg-stone-200" />
                <div className="flex gap-2">
                  <div className="h-10 w-28 animate-pulse rounded-lg bg-stone-200" />
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-stone-200" />
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-stone-200" />
                </div>
              </div>
              {/* Grid skeleton */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl bg-stone-200">
                    <div className="aspect-4/5" />
                  </div>
                ))}
              </div>
            </div>
          }
        >
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
