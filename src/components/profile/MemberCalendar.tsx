"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdChevronLeft, MdChevronRight, MdOutlineErrorOutline, MdStar } from "react-icons/md";
import type { CalendarNeighbour, CalendarPayload } from "@/lib/member-home/month-grid";
import { cn } from "@/lib/utils";
import CalendarSkeleton from "./CalendarSkeleton";
import MonthCalendar from "./MonthCalendar";

const navButton =
  "inline-flex size-11 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom aria-disabled:opacity-40";

function CalendarError({ ludoyaUrl }: { ludoyaUrl: string }) {
  const t = useTranslations("profile.home.calendar");
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-stone-custom/12 bg-brand-beige p-5">
      <div className="flex items-center gap-2 text-stone-custom">
        <MdOutlineErrorOutline aria-hidden="true" size={22} className="text-brand-orange-text" />
        <p className="text-base font-bold">{t("error_title")}</p>
      </div>
      <p className="text-sm leading-normal text-stone-custom/70">{t("error_text")}</p>
      <a
        href={ludoyaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded-xl bg-stone-custom px-5 text-sm font-semibold text-brand-white"
      >
        {t("open_ludoya_home")}
        <span className="sr-only"> {t("new_tab")}</span>
        <span aria-hidden="true">&nbsp;↗</span>
      </a>
    </div>
  );
}

/** Keeps `?month` in the address bar without a navigation; the current month is the bare `/profile`. */
function syncUrl(monthKey: string, isCurrent: boolean) {
  const url = new URL(window.location.href);
  if (isCurrent) url.searchParams.delete("month");
  else url.searchParams.set("month", monthKey);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * "Calendari" card of the member home. The first month arrives with the page; the
 * others are fetched from `/api/profile/calendar`, so switching months never waits
 * on (or re-renders) the rest of the page. The arrows are always focusable buttons
 * (`aria-disabled` at the range limits) and the new month is announced politely.
 */
export default function MemberCalendar({
  initial,
  currentMonthKey,
  ludoyaUrl,
}: {
  initial: CalendarPayload;
  currentMonthKey: string;
  ludoyaUrl: string;
}) {
  const t = useTranslations("profile.home.calendar");
  const locale = useLocale();
  const [payload, setPayload] = useState(initial);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function go(target: CalendarNeighbour | null) {
    if (!target || target.key === loadingKey) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoadingKey(target.key);
    setFailed(false);
    try {
      const response = await fetch(`/api/profile/calendar?month=${target.key}&locale=${locale}`, {
        signal: request.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`calendar ${response.status}`);
      const next = (await response.json()) as CalendarPayload;
      setPayload(next);
      setAnnouncement(next.title);
      syncUrl(next.monthKey, next.monthKey === currentMonthKey);
      setLoadingKey(null);
    } catch (error) {
      if (request.signal.aborted) return;
      console.warn("[Calendar] Month unavailable", error);
      setFailed(true);
      setLoadingKey(null);
    }
  }

  const renderNav = (target: CalendarNeighbour | null, direction: "prev" | "next") => {
    const Icon = direction === "prev" ? MdChevronLeft : MdChevronRight;
    return (
      <button
        type="button"
        aria-disabled={target === null}
        aria-label={target ? t(direction, { month: target.title }) : t(direction === "prev" ? "prev_limit" : "next_limit")}
        onClick={() => go(target)}
        className={navButton}
      >
        <Icon aria-hidden="true" size={24} />
      </button>
    );
  };

  const showError = failed || payload.error !== undefined || payload.view === null;

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl bg-brand-white px-4 py-5 md:p-7">
      <div className="flex items-center justify-between gap-x-4 md:justify-start">
        <h2 id="calendar-title" className="text-[22px] font-bold tracking-tight text-stone-custom">
          <span className="sr-only">{t("title")}: </span>
          {payload.title}
        </h2>
        <nav aria-label={t("month_nav")} className="flex items-center gap-2">
          {renderNav(payload.prev, "prev")}
          {renderNav(payload.next, "next")}
        </nav>
        <ul className="ml-auto hidden flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-stone-custom/65 md:flex">
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
          <li>{t("hint_desktop")}</li>
        </ul>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div aria-busy={loadingKey !== null} className={cn(loadingKey !== null && "pointer-events-none")}>
        {loadingKey !== null ? (
          <CalendarSkeleton />
        ) : showError ? (
          <CalendarError ludoyaUrl={ludoyaUrl} />
        ) : (
          // Keyed by month so the selected-day state resets with the grid.
          <MonthCalendar key={payload.monthKey} view={payload.view!} />
        )}
      </div>
    </div>
  );
}
