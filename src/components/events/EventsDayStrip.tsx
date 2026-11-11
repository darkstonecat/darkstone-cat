"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { StripDay, StripWeek } from "@/lib/events/agenda-format";
import type { EventsCalendarMonth } from "@/lib/events/calendar-view";
import { eventAnchor } from "@/lib/events/links";
import { cn } from "@/lib/utils";
import EventsCalendar from "./EventsCalendar";

/** At most this many position dots, however long the strip is. */
const MAX_DOTS = 5;

type Position = { dots: number; index: number; atEnd: boolean };

function DayTile({ day, current }: { day: StripDay; current: boolean }) {
  const t = useTranslations("events.calendar");
  return (
    // The name comes from the content: the visible "DV 13" first (WCAG 2.5.3,
    // label in name, so voice control can say what it sees), then the full
    // date and the titles for screen readers. The spaces keep the words apart.
    <a
      href={`#${eventAnchor(day.eventId)}`}
      className={cn(
        "flex h-[72px] w-[58px] flex-col items-center justify-center gap-0.5 rounded-[14px] leading-none shadow-[0_1px_2px_rgba(28,25,23,0.12)]",
        day.special
          ? "bg-brand-orange text-brand-white"
          : current
            ? "bg-stone-custom text-stone-white-hover"
            : "border border-stone-white-base bg-brand-white text-stone-custom"
      )}
    >
      <span className="text-[11px] font-bold">{day.weekday}</span>{" "}
      <span className="text-[22px] font-extrabold">{day.day}</span>{" "}
      <span className="sr-only">{t("day_link", { date: day.label, titles: day.titles.join(", ") })}</span>
      <span aria-hidden="true" className="h-2.5 text-[10px] font-bold">
        {day.special ? "★" : ""}
      </span>
    </a>
  );
}

/**
 * Mobile "Properes dates": a swipeable strip of the upcoming days with events
 * (no visible scrollbar, snap per day, an edge fade while more days follow,
 * position dots) and a toggle that shows the full month grid. A tap on a day
 * opens its card through the `#event-` link handling of EventsTimeline.
 */
export default function EventsDayStrip({
  strip,
  calendar,
  loadedIds,
  className,
}: {
  strip: StripWeek[];
  calendar: EventsCalendarMonth;
  loadedIds: string[];
  className?: string;
}) {
  const t = useTranslations("events.strip");
  const tEvents = useTranslations("events");
  const titleId = useId();
  const panelId = useId();
  const trackRef = useRef<HTMLUListElement>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ dots: 0, index: 0, atEnd: false });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 1) {
      setPosition({ dots: 0, index: 0, atEnd: true });
      return;
    }
    const dots = Math.min(MAX_DOTS, Math.ceil(track.scrollWidth / track.clientWidth));
    setPosition({
      dots,
      index: Math.round((track.scrollLeft / max) * (dots - 1)),
      atEnd: track.scrollLeft >= max - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between px-1">
        <h2 id={titleId} className="text-[13px] font-bold text-stone-600">
          {t("title")}
        </h2>
        <button
          type="button"
          aria-expanded={monthOpen}
          aria-controls={panelId}
          onClick={() => setMonthOpen((open) => !open)}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1 px-1 text-sm font-bold text-brand-orange-text"
        >
          {monthOpen ? t("hide_month") : t("show_month")}
          <span aria-hidden="true">{monthOpen ? "▴" : "▾"}</span>
        </button>
      </div>

      {strip.length > 0 && (
        <div className="relative -mx-4 sm:-mx-6">
          <ul
            ref={trackRef}
            aria-labelledby={titleId}
            onScroll={measure}
            className="no-scrollbar flex snap-x snap-mandatory scroll-pl-4 gap-2 overflow-x-auto overscroll-x-contain py-0.5 pr-11 pl-4 sm:scroll-pl-6 sm:pl-6"
          >
            {strip.map((week) => (
              <li key={week.start} className="flex shrink-0 flex-col gap-1">
                {/* As wide as the week's days: a long label ends in an ellipsis instead of overlapping the next week. */}
                <span className="h-3.5 w-0 min-w-full truncate text-[10px] font-extrabold tracking-[0.06em] text-stone-600 uppercase">
                  {week.current ? tEvents("this_week") : week.label}
                </span>
                <ol className="flex gap-2">
                  {week.days.map((day) => (
                    <li key={day.date} className="snap-start">
                      <DayTile day={day} current={week.current} />
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-end bg-gradient-to-r from-brand-beige/0 to-brand-beige to-70% pr-1.5 text-lg font-extrabold text-brand-orange-text transition-opacity",
              position.atEnd && "opacity-0"
            )}
          >
            ›
          </span>
        </div>
      )}
      {position.dots > 1 && (
        <div aria-hidden="true" className="flex justify-center gap-1.5 pt-0.5">
          {Array.from({ length: position.dots }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-[width] duration-200",
                i === position.index ? "w-[18px] bg-brand-orange" : "w-1.5 bg-stone-400"
              )}
            />
          ))}
        </div>
      )}

      <div id={panelId} hidden={!monthOpen}>
        <EventsCalendar variant="inline" className="flex" initial={calendar} loadedIds={loadedIds} />
      </div>
    </section>
  );
}
