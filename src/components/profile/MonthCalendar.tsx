"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdOutlinePlace, MdStar } from "react-icons/md";
import type { CalendarDayView, CalendarView } from "@/lib/member-home/month-grid";
import { cn } from "@/lib/utils";

type MonthCalendarProps = {
  /** Grid with every date already formatted on the server (see `buildCalendarView`). */
  view: CalendarView;
};

const externalLink = { target: "_blank", rel: "noopener noreferrer" } as const;

function WeekdayHeader({ weekdays, compact }: { weekdays: CalendarView["weekdays"]; compact: boolean }) {
  return (
    <thead>
      <tr>
        {weekdays.map((label) => (
          <th
            key={label.long}
            scope="col"
            abbr={label.long}
            className={cn(
              "text-xs font-bold text-stone-custom/65",
              compact ? "h-8 text-center" : "px-2 pb-1 text-left"
            )}
          >
            {label.short}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Desktop cell: day number plus one pill per event, each opening Ludoya. */
function SheetCell({ day }: { day: CalendarDayView }) {
  const t = useTranslations("profile.home.calendar");

  if (!day.inMonth) {
    return (
      <td className="h-28 align-top">
        <span aria-hidden="true" className="block p-2 text-[13px] font-bold text-stone-custom/30">
          {day.day}
        </span>
      </td>
    );
  }

  return (
    <td
      aria-current={day.isToday ? "date" : undefined}
      className={cn("h-28 rounded-[10px] bg-brand-beige p-2 align-top", day.isToday && "ring-2 ring-stone-custom ring-inset")}
    >
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-stone-custom">
          {day.day}
          {day.isToday && (
            <span className="rounded-full bg-stone-custom px-1.5 py-px text-[10px] font-bold tracking-wide text-brand-white uppercase">
              {t("today")}
            </span>
          )}
        </span>
        {day.events.map((event) => {
          const { time } = event;
          const date = day.label;
          return (
            <a
              key={event.id}
              href={event.ludoyaUrl}
              {...externalLink}
              aria-label={`${t(event.special ? "event_link_special" : "event_link", { date, time, title: event.title })} ${t("new_tab")}`}
              className={cn(
                "flex min-h-11 items-center gap-1 rounded-md px-2 py-1.5 text-xs leading-tight font-semibold text-brand-white",
                event.special ? "bg-brand-orange" : "bg-stone-custom"
              )}
            >
              {event.special ? (
                <>
                  <MdStar aria-hidden="true" size={12} className="shrink-0" />
                  <span className="line-clamp-2">{event.title}</span>
                </>
              ) : (
                <span>
                  {time} {t("session")}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </td>
  );
}

/** Mobile cell: a 44 px day; days with events are buttons that select the day. */
function GridCell({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDayView;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const t = useTranslations("profile.home.calendar");

  if (!day.inMonth) {
    return (
      <td className="p-0.5 text-center">
        <span aria-hidden="true" className="flex h-11 items-center justify-center text-sm text-stone-custom/30">
          {day.day}
        </span>
      </td>
    );
  }

  const hasEvents = day.events.length > 0;
  const special = day.events.some((e) => e.special);
  const numberClass = cn(day.isToday && "underline decoration-2 underline-offset-4");

  return (
    <td aria-current={day.isToday ? "date" : undefined} className="p-0.5 text-center">
      {hasEvents ? (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t(special ? "day_events_special" : "day_events", {
            date: day.label,
            count: day.events.length,
          })}
          onClick={() => onSelect(day.date)}
          className={cn(
            "relative flex h-11 w-full items-center justify-center rounded-[10px] text-sm font-bold text-brand-white",
            special ? "bg-brand-orange" : "bg-stone-custom",
            selected && "outline-2 outline-offset-2 outline-stone-custom"
          )}
        >
          <span className={numberClass}>{day.day}</span>
          {special && <MdStar aria-hidden="true" size={10} className="absolute top-1 right-1" />}
        </button>
      ) : (
        <span className="flex h-11 items-center justify-center text-sm text-stone-custom">
          <span className={numberClass}>{day.day}</span>
          {day.isToday && <span className="sr-only"> ({t("today")})</span>}
        </span>
      )}
    </td>
  );
}

function DayPanel({ day }: { day: CalendarDayView | undefined }) {
  const t = useTranslations("profile.home.calendar");

  return (
    <div
      role="status"
      aria-label={t("panel_label")}
      className="flex flex-col gap-3 rounded-xl bg-brand-beige p-4 md:hidden"
    >
      {!day || day.events.length === 0 ? (
        <p className="text-sm text-stone-custom/65">{t("panel_empty")}</p>
      ) : (
        day.events.map((event) => (
          <div key={event.id} className="flex flex-col gap-2.5">
            <p className="text-[13px] font-semibold text-stone-custom/65">{day.label}</p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="text-[17px] font-bold text-stone-custom">{event.title}</p>
              {event.special && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/12 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-brand-orange-text uppercase">
                  <MdStar aria-hidden="true" size={11} />
                  {t("special")}
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-1 text-sm text-stone-custom/65">
              {event.time}
              {event.placeName && (
                <>
                  <span aria-hidden="true">·</span>
                  <MdOutlinePlace aria-hidden="true" size={14} className="shrink-0" />
                  {event.placeName}
                </>
              )}
            </p>
            <a
              href={event.ludoyaUrl}
              {...externalLink}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-stone-custom px-4 text-sm font-semibold text-brand-white"
            >
              {t("open_ludoya")}
              <span className="sr-only"> {event.title} {t("new_tab")}</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Month grid of the member home. Desktop shows a full-width sheet with event
 * pills that open Ludoya; mobile a compact grid of 44 px days plus a panel for
 * the selected day. Both are real tables; the one that does not fit the
 * viewport is `display: none`, so assistive technology sees one grid only.
 */
export default function MonthCalendar({ view }: MonthCalendarProps) {
  const t = useTranslations("profile.home.calendar");
  const { weeks, weekdays, title } = view;
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen ?? view.defaultSelected;
  const selectedDay = weeks.flat().find((d) => d.date === selected);
  const hasEvents = weeks.some((week) => week.some((d) => d.events.length > 0));

  return (
    <div className="flex flex-col gap-3.5">
      <table className="hidden w-full table-fixed border-separate border-spacing-1.5 md:table">
        <caption className="sr-only">{t("grid_label", { month: title })}</caption>
        <WeekdayHeader weekdays={weekdays} compact={false} />
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => (
                <SheetCell key={day.date} day={day} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full table-fixed border-separate border-spacing-0 md:hidden">
        <caption className="sr-only">{t("grid_label", { month: title })}</caption>
        <WeekdayHeader weekdays={weekdays} compact />
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => (
                <GridCell key={day.date} day={day} selected={day.date === selected} onSelect={setChosen} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {!hasEvents && <p className="text-sm text-stone-custom/65">{t("empty_month")}</p>}
      <ul className="flex items-center gap-x-4 text-[13px] text-stone-custom/65 md:hidden">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3.5 rounded-[4px] bg-stone-custom" />
          {t("legend_session")}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-[4px] bg-brand-orange text-brand-white">
            <MdStar size={10} />
          </span>
          {t("legend_special")}
        </li>
        <li className="ml-auto">{t("hint_mobile")}</li>
      </ul>
      <DayPanel day={selectedDay} />
    </div>
  );
}
