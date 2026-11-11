"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import type { EventsCalendarDay, EventsCalendarMonth } from "@/lib/events/calendar-view";
import type { CalendarNeighbour } from "@/lib/events/month-grid";
import { LUDOYA_AGENDA_URL, eventAnchor } from "@/lib/events/links";
import { cn } from "@/lib/utils";
import { ArrowOutwardIcon } from "./icons";

const navButton =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-stone-white-base bg-brand-white text-stone-custom aria-disabled:cursor-default aria-disabled:opacity-40";
const cellBase = "flex w-full items-center justify-center rounded-[10px]";
/** Sidebar cells are 40 px; the inline (mobile) grid keeps 44 px touch targets. */
const cellSize = { sidebar: "h-10 text-[13px]", inline: "h-11 text-sm" } as const;

type Variant = keyof typeof cellSize;

function DayCell({ day, loaded, variant }: { day: EventsCalendarDay; loaded: Set<string>; variant: Variant }) {
  const t = useTranslations("events.calendar");
  const base = cn(cellBase, cellSize[variant]);

  if (!day.inMonth) {
    return (
      <span aria-hidden="true" className={cn(base, "text-stone-500")}>
        {day.day}
      </span>
    );
  }

  const todayRing = day.isToday && "ring-2 ring-stone-custom ring-inset font-extrabold";
  if (day.eventId === null) {
    return (
      <span className={cn(base, "text-stone-custom", day.isPast && "text-stone-500", todayRing)}>
        {day.day}
        {day.isToday && <span className="sr-only"> ({t("today")})</span>}
      </span>
    );
  }

  // A loaded event opens its card (EventsTimeline handles `#event-` links); any other opens Ludoya.
  const inAgenda = loaded.has(day.eventId);
  const label = [
    t("day_link", { date: day.label, titles: day.titles.join(", ") }),
    day.isToday ? `, ${t("today")}` : "",
    inAgenda ? "" : ` ${t("external")}`,
  ].join("");
  return (
    <a
      href={inAgenda ? `#${eventAnchor(day.eventId)}` : (day.ludoyaUrl ?? LUDOYA_AGENDA_URL)}
      {...(inAgenda ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      aria-label={label}
      className={cn(
        base,
        "text-brand-white no-underline hover:brightness-125",
        day.kind === "special" ? "bg-brand-orange font-extrabold" : "bg-stone-custom font-bold",
        day.isPast && "opacity-35",
        day.isToday && "outline-2 outline-offset-2 outline-stone-custom"
      )}
    >
      {day.day}
    </a>
  );
}

/**
 * Month calendar of the /events sidebar. The first month arrives with the page;
 * the others come from `/api/events/calendar`, so switching months never moves
 * the timeline. Days with a loaded event jump to its card; the rest open Ludoya.
 * `inline` is the mobile grid under the day strip (bigger cells, touch hint).
 */
export default function EventsCalendar({
  initial,
  loadedIds,
  className,
  variant = "sidebar",
}: {
  initial: EventsCalendarMonth;
  /** Events present in the timeline. */
  loadedIds: string[];
  className?: string;
  variant?: Variant;
}) {
  const t = useTranslations("events.calendar");
  const titleId = useId();
  const locale = useLocale();
  const [month, setMonth] = useState(initial);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const controller = useRef<AbortController | null>(null);
  const loaded = new Set(loadedIds);

  useEffect(() => () => controller.current?.abort(), []);

  async function go(target: CalendarNeighbour | null) {
    if (!target || target.key === loadingKey) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoadingKey(target.key);
    setFailed(false);
    try {
      const response = await fetch(`/api/events/calendar?month=${target.key}&locale=${locale}`, { signal: request.signal });
      if (!response.ok) throw new Error(`calendar ${response.status}`);
      const next = (await response.json()) as EventsCalendarMonth;
      setMonth(next);
      setAnnouncement(next.title);
    } catch (error) {
      if (request.signal.aborted) return;
      console.warn("[EventsCalendar] Month unavailable", error);
      setFailed(true);
    }
    setLoadingKey(null);
  }

  const renderNav = (target: CalendarNeighbour | null, direction: "prev" | "next") => {
    const Icon = direction === "prev" ? MdChevronLeft : MdChevronRight;
    return (
      <button
        type="button"
        aria-disabled={target === null}
        aria-label={target ? t(direction, { month: target.title }) : t(`${direction}_limit`)}
        onClick={() => go(target)}
        className={navButton}
      >
        <Icon aria-hidden="true" size={22} />
      </button>
    );
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex-col gap-2.5 rounded-[20px] bg-brand-white text-stone-custom",
        variant === "inline" ? "px-2 py-3" : "p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {renderNav(month.prev, "prev")}
        <h2 id={titleId} className="text-base font-bold">
          <span className="sr-only">{t("title")}: </span>
          {month.title}
        </h2>
        {renderNav(month.next, "next")}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <table
        aria-busy={loadingKey !== null}
        className={cn(
          "w-full table-fixed border-separate transition-opacity",
          variant === "inline" ? "border-spacing-0.5" : "border-spacing-[3px]",
          loadingKey !== null && "pointer-events-none opacity-50"
        )}
      >
        <caption className="sr-only">{t("grid_label", { month: month.title })}</caption>
        <thead>
          <tr>
            {month.weekdays.map((w) => (
              <th key={w.long} scope="col" abbr={w.long} className="h-[26px] text-[11px] font-bold text-stone-600">
                {w.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {month.weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => (
                <td key={day.date} aria-current={day.isToday ? "date" : undefined} className="p-0">
                  <DayCell day={day} loaded={loaded} variant={variant} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(failed || month.error) && (
        <p className="text-sm text-stone-700">
          {t("error")}{" "}
          <a
            href={LUDOYA_AGENDA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-orange-text hover:underline"
          >
            {t("error_link")}&nbsp;<ArrowOutwardIcon />
            <span className="sr-only"> {t("external")}</span>
          </a>
        </p>
      )}
      <ul className="flex flex-wrap gap-3 pt-1 text-xs text-stone-600">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-stone-custom" />
          {t("legend_session")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-brand-orange" />
          {t("legend_special")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] ring-2 ring-stone-custom ring-inset" />
          {t("legend_today")}
        </li>
      </ul>
      <p className="text-xs text-stone-600">{t(variant === "inline" ? "hint_touch" : "hint")}</p>
    </section>
  );
}
