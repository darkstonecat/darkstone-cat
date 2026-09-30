import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ludoyaConfig } from "@/lib/ludoya/config";
import { buildCalendarPayload } from "@/lib/member-home/calendar-payload";
import { currentYearMonth, formatMonthKey, type YearMonth } from "@/lib/member-home/month-grid";
import CalendarSkeleton from "./CalendarSkeleton";
import MemberCalendar from "./MemberCalendar";

/** Fetches the first month inside the Suspense boundary so a slow Ludoya never blocks the page. */
async function CalendarData({ month }: { month: YearMonth }) {
  const locale = await getLocale();
  const now = new Date();
  const initial = await buildCalendarPayload(month, locale, now);
  return (
    <MemberCalendar
      initial={initial}
      currentMonthKey={formatMonthKey(currentYearMonth(now))}
      ludoyaUrl={ludoyaConfig.appUrl}
    />
  );
}

/**
 * "Calendari" card of the member home. The first month streams in behind a
 * skeleton; later months are fetched by the client (see `MemberCalendar`).
 */
export default async function CalendarSection({ month, className }: { month: YearMonth; className?: string }) {
  const t = await getTranslations("profile.home.calendar");

  return (
    <section aria-labelledby="calendar-title" className={className}>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3.5 rounded-2xl bg-brand-white px-4 py-5 md:p-7">
            <h2 id="calendar-title" className="text-[22px] font-bold tracking-tight text-stone-custom">
              {t("title")}
            </h2>
            <CalendarSkeleton label={t("loading")} />
          </div>
        }
      >
        <CalendarData month={month} />
      </Suspense>
    </section>
  );
}
