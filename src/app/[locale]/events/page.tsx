import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getOgImageUrl, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { fetchUpcomingEvents } from "@/lib/ludoya";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import EventsHero from "@/components/events/EventsHero";
import EventsContent from "@/components/events/EventsContent";
import { VENUE, VENUE_POSTAL_ADDRESS } from "@/lib/venue";

export const revalidate = 86400;

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
  const [eventsResult, tNav, tMeta] = await Promise.all([
    fetchUpcomingEvents(),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("events"), path: "/events" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/events", tMeta("events_title"), tMeta("events_description"));

  // Build Event schema.org JSON-LD for each event
  const allEvents = [...eventsResult.regularEvents, ...eventsResult.specialEvents];
  const eventJsonLd = allEvents.slice(0, 20).map((event) => {
    const startMs = new Date(event.startsAt).getTime();
    const offerValidFrom = new Date(startMs - 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.title,
      description: event.description || event.title,
      startDate: event.startsAt,
      endDate: event.endsAt,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      url: event.ludoyaUrl,
      image: event.imageUrl || "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
      performer: {
        "@type": "Organization",
        name: "Darkstone Catalunya",
        url: "https://www.darkstone.cat",
      },
      organizer: {
        "@type": "Organization",
        name: "Darkstone Catalunya",
        url: "https://www.darkstone.cat",
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        validFrom: offerValidFrom,
        url: event.ludoyaUrl,
      },
      location: {
        "@type": "Place",
        name: VENUE.name,
        address: VENUE_POSTAL_ADDRESS,
      },
    };
  });

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd, ...eventJsonLd]),
        }}
      />
      <NavBar />
      <EventsHero />
      <EventsContent
        regularEvents={eventsResult.regularEvents}
        specialEvents={eventsResult.specialEvents}
        error={eventsResult.error}
        locale={locale}
      />
      <Footer />
      <ScrollToTop />
    </main>
  );
}
