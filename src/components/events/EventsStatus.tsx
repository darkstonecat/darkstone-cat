import { useTranslations } from "next-intl";
import { MdOpenInNew } from "react-icons/md";
import { LUDOYA_AGENDA_URL } from "@/lib/events/links";

/** Shown instead of the timeline when Ludoya failed or there is nothing planned. */
export default function EventsStatus({ kind }: { kind: "error" | "empty" }) {
  const t = useTranslations("events");
  return (
    <div role={kind === "error" ? "alert" : undefined} className="rounded-[22px] bg-stone-custom p-8 text-center sm:p-12">
      <p aria-hidden="true" className="text-4xl">🎲</p>
      <h2 className="mt-4 text-xl font-bold text-brand-white sm:text-2xl">
        {kind === "error" ? t("error_title") : t("no_events")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-stone-white-base">{t("error_description")}</p>
      <a
        href={LUDOYA_AGENDA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-orange px-6 text-sm font-medium text-white transition-colors hover:bg-brand-orange/90"
      >
        {t("error_link")}
        <MdOpenInNew aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">{t("new_tab")}</span>
      </a>
    </div>
  );
}
