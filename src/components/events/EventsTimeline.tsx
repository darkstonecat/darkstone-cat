"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useLenis } from "@/components/SmoothScroll";
import type { EventView, WeekView } from "@/lib/events/agenda-format";
import { weekSummary } from "@/lib/events/agenda-view";
import { LUDOYA_AGENDA_URL, eventAnchor, eventIdFromHash } from "@/lib/events/links";
import { cn } from "@/lib/utils";
import EventCard, { RAIL } from "./EventCard";

/** Room for the fixed NavBar when scrolling to a card. */
const SCROLL_OFFSET = -96;

/** This week's events and every special start open; later sessions start closed. */
export const isOpenByDefault = (event: EventView, week: WeekView) => event.type === "special" || week.isCurrent;

function WeekHeader({
  week,
  allOpen,
  onToggleAll,
  rail,
}: {
  week: WeekView;
  allOpen: boolean;
  onToggleAll: () => void;
  /** Events above and below: the timeline line runs through the header. */
  rail: boolean;
}) {
  const t = useTranslations("events");
  const counts = weekSummary(week.events);
  const summary = week.isCurrent
    ? [week.range, t("summary_plays", { count: counts.plays }), ...(counts.free > 0 ? [t("summary_free", { count: counts.free })] : [])]
    : [
        ...(counts.sessions > 0 ? [t("summary_sessions", { count: counts.sessions })] : []),
        ...(counts.plays > 0 ? [t("summary_plays", { count: counts.plays })] : []),
        ...(counts.specials > 0 ? [t("summary_specials", { count: counts.specials })] : []),
      ];
  return (
    // Padding, not margin: the line has to cover the space under the header too.
    <div className="relative flex flex-wrap items-baseline justify-between gap-2 pb-4 pl-[60px] sm:pl-[84px]">
      {rail && <span aria-hidden="true" data-timeline-rail className={cn(RAIL, "top-0 bottom-0")} />}
      <span className="flex flex-col gap-0.5">
        <h2 className={week.isCurrent ? "text-2xl font-extrabold sm:text-3xl" : "text-xl font-extrabold"}>
          {week.isCurrent ? t("this_week") : t("week_title", week.title)}
        </h2>
        <span className="text-sm text-stone-600">{summary.join(" · ")}</span>
      </span>
      {!week.isCurrent && (
        <button
          type="button"
          onClick={onToggleAll}
          className="min-h-11 cursor-pointer px-3 text-sm font-bold text-brand-orange-text hover:underline"
        >
          {allOpen ? t("collapse_all") : t("expand_all")}
        </button>
      )}
    </div>
  );
}

/**
 * The timeline of /events: one group per Madrid week with collapsible event
 * cards. A link to `#event-<id>` anywhere on the page (special banners, the
 * calendar) opens that card and scrolls to it, and so does such a hash on load.
 */
export default function EventsTimeline({ weeks }: { weeks: WeekView[] }) {
  const t = useTranslations("events");
  const lenis = useLenis();
  /** Cards the visitor opened or closed; the rest follow `isOpenByDefault`. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [scrollTarget, setScrollTarget] = useState<{ id: string; seq: number } | null>(null);

  const orderedIds = useMemo(() => weeks.flatMap((w) => w.events.map((e) => e.id)), [weeks]);
  const eventIds = useMemo(() => new Set(orderedIds), [orderedIds]);
  const firstId = orderedIds[0];
  const lastId = orderedIds.at(-1);
  const isOpen = (event: EventView, week: WeekView) => overrides[event.id] ?? isOpenByDefault(event, week);
  const setOpen = (ids: string[], open: boolean) =>
    setOverrides((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, open])) }));

  const reveal = useCallback(
    (id: string) => {
      if (!eventIds.has(id)) return false;
      setOverrides((current) => ({ ...current, [id]: true }));
      setScrollTarget((current) => ({ id, seq: (current?.seq ?? 0) + 1 }));
      return true;
    },
    [eventIds]
  );

  // Scroll once the opened card has rendered.
  useEffect(() => {
    if (!scrollTarget) return;
    const element = document.getElementById(eventAnchor(scrollTarget.id));
    if (!element) return;
    if (lenis) lenis.scrollTo(element, { offset: SCROLL_OFFSET });
    else element.scrollIntoView({ block: "start" });
  }, [scrollTarget, lenis]);

  useEffect(() => {
    // A shared link such as /events#event-<id> opens its card after hydration.
    const initial = eventIdFromHash(window.location.hash);
    const frame = initial ? requestAnimationFrame(() => reveal(initial)) : 0;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href^='#event-']");
      const id = link ? eventIdFromHash(link.getAttribute("href") ?? "") : null;
      if (!id || !reveal(id)) return;
      e.preventDefault();
      window.history.replaceState(window.history.state, "", `#${eventAnchor(id)}`);
    };
    const onHashChange = () => {
      const id = eventIdFromHash(window.location.hash);
      if (id) reveal(id);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [reveal]);

  return (
    <section aria-label={t("timeline_label")} className="flex min-w-0 flex-col">
      {weeks.map((week, index) => {
        const allOpen = week.events.every((e) => isOpen(e, week));
        const eventsBefore = weeks.slice(0, index).some((w) => w.events.length > 0);
        const eventsFrom = weeks.slice(index).some((w) => w.events.length > 0);
        return (
          <div key={week.start} className="flex flex-col">
            <WeekHeader
              week={week}
              allOpen={allOpen}
              onToggleAll={() => setOpen(week.events.map((e) => e.id), !allOpen)}
              rail={eventsBefore && eventsFrom}
            />
            {week.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isCurrentWeek={week.isCurrent}
                isFirst={event.id === firstId}
                isLast={event.id === lastId}
                open={isOpen(event, week)}
                onToggle={() => setOpen([event.id], !isOpen(event, week))}
              />
            ))}
          </div>
        );
      })}
      <a
        href={LUDOYA_AGENDA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-[60px] inline-flex min-h-11 items-center self-start text-sm font-bold text-brand-orange-text hover:underline sm:ml-[84px]"
      >
        {t("more_on_ludoya")}&nbsp;<span aria-hidden="true">↗</span>
        <span className="sr-only"> {t("new_tab")}</span>
      </a>
    </section>
  );
}
