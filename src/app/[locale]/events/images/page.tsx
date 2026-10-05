import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { fetchUpcomingEvents } from "@/lib/ludoya";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import EventImagesHero from "@/components/events/EventImagesHero";
import EventImagesContent from "@/components/events/EventImagesContent";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/events/images");
  return {
    title: t("event_images_title"),
    description: t("event_images_description"),
    alternates,
    robots: { index: false, follow: false },
  };
}

export default async function EventImagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Board members and superadmins only; anyone else gets the 404 page.
  await requireRole("board");

  const [eventsResult, tNav, tMeta] = await Promise.all([
    fetchUpcomingEvents(),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("events"), path: "/events" },
    { name: tMeta("event_images_title"), path: "/events/images" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/events/images",
    tMeta("event_images_title"),
    tMeta("event_images_description")
  );

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]),
        }}
      />
      <NavBar />
      <EventImagesHero />
      <EventImagesContent
        regularEvents={eventsResult.regularEvents}
        specialEvents={eventsResult.specialEvents}
        locale={locale}
      />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
