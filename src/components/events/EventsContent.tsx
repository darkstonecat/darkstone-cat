import { serializeJsonLd } from "@/lib/seo";
import { buildEventJsonLd, type EventsPageData } from "@/lib/events/page-data";
import { SpecialBanners } from "./EventsHeader";
import EventsCalendar from "./EventsCalendar";
import EventsDayStrip from "./EventsDayStrip";
import EventsStatus from "./EventsStatus";
import EventsTimeline from "./EventsTimeline";

// The Ludoya-dependent parts of /events. Each one awaits the same data promise
// inside its own <Suspense> boundary (see the page), so the static parts render
// first and these replace their skeletons when Ludoya answers.

type Props = { data: Promise<EventsPageData> };

/** The special-event banners of the dark header. */
export async function EventsBanners({ data }: Props) {
  const { agenda } = await data;
  return <SpecialBanners specials={agenda.specials} />;
}

/** The desktop sidebar calendar. */
export async function EventsSidebarCalendar({ data }: Props) {
  const { calendar, loadedIds } = await data;
  return <EventsCalendar className="hidden lg:flex" initial={calendar} loadedIds={loadedIds} />;
}

/** The mobile day strip, then the timeline (or the error / empty box), plus the Event JSON-LD. */
export async function EventsMain({ data }: Props) {
  const { agenda, calendar, loadedIds, error } = await data;
  const events = agenda.weeks.flatMap((week) => week.events);
  return (
    <>
      {events.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildEventJsonLd(events)) }}
        />
      )}
      {/* Mobile: the day strip and month toggle take the sidebar calendar's place. */}
      {!error && <EventsDayStrip className="mb-7 lg:hidden" strip={agenda.strip} calendar={calendar} loadedIds={loadedIds} />}
      {error ? (
        <EventsStatus kind="error" />
      ) : events.length === 0 ? (
        <EventsStatus kind="empty" />
      ) : (
        <EventsTimeline weeks={agenda.weeks} />
      )}
    </>
  );
}
