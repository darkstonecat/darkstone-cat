import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
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
  const alternates = getAlternates(locale, "/ludoteca");
  return {
    title: t("ludoteca_title"),
    description: t("ludoteca_description"),
    alternates,
    openGraph: {
      title: t("ludoteca_title"),
      description: t("ludoteca_description"),
      url: alternates.canonical,
    },
    twitter: {
      title: t("ludoteca_title"),
      description: t("ludoteca_description"),
    },
  };
}

export default async function LudotecaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [collection, tNav, t] = await Promise.all([
    fetchBggCollection(),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("ludoteca"), path: "/ludoteca" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/ludoteca", t("ludoteca_title"), t("ludoteca_description"));

  const baseGames = collection.games.filter((g) => g.subtype !== "boardgameexpansion");
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("ludoteca_title"),
    numberOfItems: baseGames.length,
    itemListElement: baseGames.slice(0, 50).map((game, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: game.name,
      url: `https://boardgamegeek.com/boardgame/${game.id}`,
    })),
  };

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd, itemListJsonLd]) }}
      />
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
