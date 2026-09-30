import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { MdChevronLeft, MdChevronRight, MdOutlineErrorOutline, MdStar } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { ludoyaConfig } from "@/lib/ludoya/config";
import { fetchMonthEvents } from "@/lib/member-sessions";
import { toMemberSessions } from "@/lib/member-home/sessions-view";
import {
  buildCalendarView,
  currentYearMonth,
  formatMonthKey,
  formatMonthTitle,
  isInRange,
  madridDayKey,
  shiftMonth,
  type CalendarEvent,
  type YearMonth,
} from "@/lib/member-home/month-grid";
import { cn } from "@/lib/utils";
import MonthCalendar from "./MonthCalendar";

const navButton =
  "inline-flex size-11 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom";

function CalendarSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-1.5">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid animate-pulse grid-cols-7 gap-1 md:gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-11 rounded-[10px] bg-stone-custom/8 md:h-28" />
        ))}
      </div>
    </div>
  );
}

/** Fetches the month from Ludoya inside the Suspense boundary, so navigating months streams in. */
async function CalendarData({ month }: { month: YearMonth }) {
  const t = await getTranslations("profile.home.calendar");
  const locale = await getLocale();
  const { events, error } = await fetchMonthEvents(month.year, month.month);

  if (error) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-stone-custom/12 bg-brand-beige p-5">
        <div className="flex items-center gap-2 text-stone-custom">
          <MdOutlineErrorOutline aria-hidden="true" size={22} className="text-brand-orange-text" />
          <p className="text-base font-bold">{t("error_title")}</p>
        </div>
        <p className="text-sm leading-normal text-stone-custom/70">{t("error_text")}</p>
        <a
          href={ludoyaConfig.appUrl}
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

  const items: CalendarEvent[] = toMemberSessions(events).map((s) => ({
    id: s.id,
    title: s.title,
    startsAt: s.startsAt,
    special: s.type === "special",
    placeName: s.place?.name ?? null,
    ludoyaUrl: s.ludoyaUrl,
  }));

  return <MonthCalendar view={buildCalendarView(month, items, madridDayKey(new Date()), locale)} />;
}

/** "Calendari" card of the member home: month header with navigation, legend and the streamed grid. */
export default async function CalendarSection({ month, className }: { month: YearMonth; className?: string }) {
  const t = await getTranslations("profile.home.calendar");
  const locale = await getLocale();
  const now = new Date();
  const current = currentYearMonth(now);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const hrefFor = (target: YearMonth) => ({
    pathname: "/profile" as const,
    query: formatMonthKey(target) === formatMonthKey(current) ? {} : { month: formatMonthKey(target) },
  });

  const renderNav = (target: YearMonth, direction: "prev" | "next") => {
    const label = t(direction, { month: formatMonthTitle(target, locale) });
    const Icon = direction === "prev" ? MdChevronLeft : MdChevronRight;
    if (!isInRange(target, now)) {
      return (
        <button type="button" disabled aria-label={label} className={cn(navButton, "opacity-40")}>
          <Icon aria-hidden="true" size={24} />
        </button>
      );
    }
    return (
      <Link href={hrefFor(target)} scroll={false} prefetch={false} aria-label={label} className={navButton}>
        <Icon aria-hidden="true" size={24} />
      </Link>
    );
  };

  return (
    <section aria-labelledby="calendar-title" className={className}>
      <div className="flex flex-col gap-3.5 rounded-2xl bg-brand-white px-4 py-5 md:p-7">
        <div className="flex items-center justify-between gap-x-4 md:justify-start">
          <h2 id="calendar-title" className="text-[22px] font-bold tracking-tight text-stone-custom">
            <span className="sr-only">{t("title")}: </span>
            {formatMonthTitle(month, locale)}
          </h2>
          <nav aria-label={t("month_nav")} className="flex items-center gap-2">
            {renderNav(prev, "prev")}
            {renderNav(next, "next")}
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
        <Suspense key={formatMonthKey(month)} fallback={<CalendarSkeleton label={t("loading")} />}>
          <CalendarData month={month} />
        </Suspense>
      </div>
    </section>
  );
}
