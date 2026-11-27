import { Suspense } from "react";
import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getOgImageUrl, getBreadcrumbJsonLd, getWebPageJsonLd, serializeJsonLd } from "@/lib/seo";
import { loadEventsPageData } from "@/lib/events/page-data";
import { agendaNow } from "@/lib/events/clock";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import EventsHeader from "@/components/events/EventsHeader";
import { EventsBanners, EventsMain, EventsSidebarCalendar } from "@/components/events/EventsContent";
import { BannerSkeleton, CalendarSkeleton, TimelineSkeleton } from "@/components/events/EventsSkeletons";
import HowItWorks from "@/components/events/HowItWorks";

// Seat counts come from the 60 s Ludoya data cache (`fetchMemberAreaSessions`).
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/events");
  return {
    title: t("events_title"),
    description: t("events_description"),
    alternates,
    robots: { index: true, follow: true },
    openGraph: {
      title: t("events_title"),
      description: t("events_description"),
      url: alternates.canonical,
      images: [{ url: getOgImageUrl(locale), width: 1200, height: 630, alt: t("events_title") }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
      creator: "@darkstonecat",
      title: t("events_title"),
      description: t("events_description"),
    },
  };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Started here, awaited only inside the <Suspense> boundaries below: the header,
  // "Com funciona" and the footer never wait for Ludoya (about 5 s on a cold cache).
  const data = loadEventsPageData(locale, agendaNow());
  const [tNav, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("events"), path: "/events" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/events", tMeta("events_title"), tMeta("events_description"));

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <EventsHeader
        banners={
          <Suspense fallback={<BannerSkeleton />}>
            <EventsBanners data={data} />
          </Suspense>
        }
      />
      <div className="bg-brand-beige px-4 text-stone-custom sm:px-6">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 pt-9 pb-[72px] lg:flex-row lg:items-start">
          <aside className="order-last flex shrink-0 flex-col gap-3.5 lg:sticky lg:top-24 lg:order-first lg:w-[330px]">
            <Suspense fallback={<CalendarSkeleton />}>
              <EventsSidebarCalendar data={data} />
            </Suspense>
            <HowItWorks />
          </aside>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<TimelineSkeleton />}>
              <EventsMain data={data} />
            </Suspense>
          </div>
        </div>
      </div>
      <Footer />
      <ScrollToTop />
    </main>
  );
}
