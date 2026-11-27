import "server-only";
import { fetchEventsAgenda } from "@/lib/events/agenda";
import { formatAgenda, type AgendaViewModel, type EventView } from "@/lib/events/agenda-format";
import { fetchEventsCalendar } from "@/lib/events/calendar";
import type { EventsCalendarMonth } from "@/lib/events/calendar-view";
import { currentYearMonth } from "@/lib/events/month-grid";
import { VENUE, VENUE_POSTAL_ADDRESS } from "@/lib/venue";

export interface EventsPageData {
  agenda: AgendaViewModel;
  /** The current month of the calendar (sidebar on desktop, under the strip on mobile). */
  calendar: EventsCalendarMonth;
  /** Ids of the events in the timeline: calendar days of these open their card. */
  loadedIds: string[];
  /** Ludoya failed: the timeline shows the error box. */
  error: boolean;
}

/**
 * Everything /events reads from Ludoya. The page starts it once without awaiting
 * and hands the promise to its streamed parts (banners, calendar, timeline), so a
 * cold Ludoya cache (about 5 s) never holds back the static parts of the page.
 * The agenda and the calendar share one events request (`fetchMemberAreaSessions`).
 */
export async function loadEventsPageData(locale: string, now: Date): Promise<EventsPageData> {
  const [agendaResult, calendar] = await Promise.all([
    fetchEventsAgenda(now),
    fetchEventsCalendar(currentYearMonth(now), locale, now),
  ]);
  const agenda = formatAgenda(agendaResult.agenda, locale, now);
  const loadedIds = agenda.weeks.flatMap((week) => week.events.map((event) => event.id));
  return { agenda, calendar, loadedIds, error: Boolean(agendaResult.error) };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ORGANIZATION = {
  "@type": "Organization",
  name: "Darkstone Catalunya",
  url: "https://www.darkstone.cat",
} as const;

/** schema.org Event JSON-LD for the first 20 timeline events. */
export function buildEventJsonLd(events: EventView[]) {
  return events.slice(0, 20).map((event) => {
    const offerValidFrom = new Date(new Date(event.startsAt).getTime() - 30 * DAY_MS).toISOString();
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
      performer: ORGANIZATION,
      organizer: ORGANIZATION,
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
}
