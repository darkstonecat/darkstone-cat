import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { MdGridView } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { ludoyaConfig } from "@/lib/ludoya/config";
import { fetchMemberWeekSessions } from "@/lib/member-sessions";
import { toMemberSessions } from "@/lib/member-home/sessions-view";
import SessionsList from "./SessionsList";

function SessionsSkeleton() {
  const t = useTranslations("profile.home.sessions");
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t("loading")}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex min-h-[86px] animate-pulse items-center gap-4 rounded-xl border border-stone-custom/12 p-3.5"
        >
          <div className="size-12 shrink-0 rounded-xl bg-stone-custom/10 md:size-[52px]" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 rounded bg-stone-custom/10" />
            <div className="h-3.5 w-1/2 rounded bg-stone-custom/10" />
          </div>
          <div className="hidden h-11 w-[150px] rounded-xl bg-stone-custom/10 md:block" />
        </div>
      ))}
    </div>
  );
}

/** Fetches this week's sessions from Ludoya; runs inside the Suspense boundary so a slow API never blocks the page. */
async function SessionsData() {
  const { sessions, error } = await fetchMemberWeekSessions();
  return <SessionsList sessions={toMemberSessions(sessions)} error={error} ludoyaUrl={ludoyaConfig.appUrl} />;
}

/**
 * "Properes sessions" card. The header is static and the data streams in behind
 * a skeleton; a Ludoya failure only turns the list into an error card.
 */
export default function SessionsSection({ className }: { className?: string }) {
  const t = useTranslations("profile.home.sessions");

  return (
    <section aria-labelledby="sessions-title" className={className}>
      <div className="flex flex-col gap-5 rounded-2xl bg-brand-white px-4 py-5 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold tracking-[0.2em] text-brand-orange-text uppercase">{t("eyebrow")}</p>
            <h2 id="sessions-title" className="text-[26px] font-bold tracking-tight text-stone-custom md:text-3xl">
              {t("title")}
            </h2>
          </div>
          <div className="flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-custom px-3 py-1.5 text-xs font-semibold text-brand-white">
              <MdGridView aria-hidden="true" size={14} />
              {t("from_ludoya")}
            </span>
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-orange-text underline underline-offset-2"
            >
              {t("all_events")}
              <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </div>
        </div>
        <Suspense fallback={<SessionsSkeleton />}>
          <SessionsData />
        </Suspense>
      </div>
    </section>
  );
}
