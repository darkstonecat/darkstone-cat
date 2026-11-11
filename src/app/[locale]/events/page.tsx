import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getOgImageUrl, getBreadcrumbJsonLd, getWebPageJsonLd, serializeJsonLd } from "@/lib/seo";
import { fetchEventsAgenda } from "@/lib/events/agenda";
import { formatAgenda } from "@/lib/events/agenda-format";
import { fetchEventsCalendar } from "@/lib/events/calendar";
import { currentYearMonth } from "@/lib/events/month-grid";
import { agendaNow } from "@/lib/events/clock";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import EventsHeader from "@/components/events/EventsHeader";
import EventsTimeline from "@/components/events/EventsTimeline";
import EventsCalendar from "@/components/events/EventsCalendar";
import EventsDayStrip from "@/components/events/EventsDayStrip";
import EventsStatus from "@/components/events/EventsStatus";
import HowItWorks from "@/components/events/HowItWorks";
import { VENUE, VENUE_POSTAL_ADDRESS } from "@/lib/venue";

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
  const now = agendaNow();
  const [agendaResult, calendar, tNav, tMeta] = await Promise.all([
    fetchEventsAgenda(now),
    fetchEventsCalendar(currentYearMonth(now), locale, now),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("events"), path: "/events" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/events", tMeta("events_title"), tMeta("events_description"));

  // Build Event schema.org JSON-LD for each event
  const agenda = formatAgenda(agendaResult.agenda, locale, now);
  const loadedIds = agenda.weeks.flatMap((week) => week.events.map((event) => event.id));
  const allEvents = agenda.weeks.flatMap((week) => week.events);
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
      location: event.place
        ? { "@type": "Place", name: event.place.name, address: event.place.address ?? event.place.name }
        : { "@type": "Place", name: VENUE.name, address: VENUE_POSTAL_ADDRESS },
    };
  });

  return (
    <main id="main-content" className="relative min-h-screen font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([breadcrumbJsonLd, webPageJsonLd, ...eventJsonLd]),
        }}
      />
      <NavBar />
      <EventsHeader specials={agenda.specials} />
      <div className="bg-brand-beige px-4 text-stone-custom sm:px-6">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-10 pt-9 pb-[72px] lg:flex-row lg:items-start">
          <aside className="order-last flex shrink-0 flex-col gap-3.5 lg:sticky lg:top-24 lg:order-first lg:w-[330px]">
            <EventsCalendar className="hidden lg:flex" initial={calendar} loadedIds={loadedIds} />
            <HowItWorks />
          </aside>
          <div className="min-w-0 flex-1">
            {/* Mobile: the day strip and month toggle take the sidebar calendar's place. */}
            {!agendaResult.error && (
              <EventsDayStrip className="mb-7 lg:hidden" strip={agenda.strip} calendar={calendar} loadedIds={loadedIds} />
            )}
            {agendaResult.error ? (
              <EventsStatus kind="error" />
            ) : allEvents.length === 0 ? (
              <EventsStatus kind="empty" />
            ) : (
              <EventsTimeline weeks={agenda.weeks} />
            )}
          </div>
        </div>
      </div>
      <Footer />
      <ScrollToTop />
    </main>
  );
}
