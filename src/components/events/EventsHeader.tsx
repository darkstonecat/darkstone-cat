import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdOutlineLocationOn, MdOutlineSchedule, MdStar } from "react-icons/md";
import type { EventView } from "@/lib/events/agenda-format";
import { eventAnchor } from "@/lib/events/links";
import { SESSION_TIME_VALUES, VENUE } from "@/lib/venue";

function BannerCountdown({ event }: { event: EventView }) {
  const t = useTranslations("events");
  const countdown = event.countdown;
  if (!countdown) return null;
  if (countdown.kind !== "days") {
    return <strong className="text-xl font-black text-brand-orange-text sm:text-2xl">{t(`countdown_${countdown.kind}`)}</strong>;
  }
  const count = countdown.days;
  return (
    <span className="flex flex-col items-center leading-none" aria-label={t("countdown_days", { count })}>
      <span aria-hidden="true" className="text-xs font-bold text-stone-600">{t("banner_days_before", { count })}</span>
      <strong aria-hidden="true" className="text-3xl font-black text-brand-orange-text sm:text-[40px]">{count}</strong>
      <span aria-hidden="true" className="text-xs font-bold text-stone-600">{t("banner_days_after", { count })}</span>
    </span>
  );
}

function SpecialBanner({ event }: { event: EventView }) {
  const t = useTranslations("events");
  return (
    <a
      href={`#${eventAnchor(event.id)}`}
      className="group flex min-h-24 items-stretch overflow-hidden rounded-[18px] bg-stone-white-hover text-stone-custom sm:min-h-28"
    >
      <span className="relative w-24 shrink-0 bg-brand-orange/80 sm:w-[180px]">
        {event.imageUrl && (
          <Image src={event.imageUrl} alt="" fill quality={60} sizes="(min-width: 640px) 180px, 96px" className="object-cover" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3 sm:px-6 sm:py-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.1em] text-brand-orange-text uppercase sm:text-xs">
          <MdStar aria-hidden="true" />
          {t("special_label")}
        </span>
        <span className="text-lg leading-tight font-extrabold group-hover:underline sm:text-2xl">{event.title}</span>
        <span className="text-sm text-stone-600 sm:text-[15px]">
          {event.dates}
          {event.place && ` · ${event.place.name}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-4 border-l border-stone-200 px-3 py-3 sm:px-6">
        <BannerCountdown event={event} />
        <span className="hidden min-h-11 items-center rounded-xl bg-stone-custom px-4 text-sm font-bold text-white md:inline-flex">
          {t("banner_more")}&nbsp;<span aria-hidden="true">↓</span>
        </span>
      </span>
    </a>
  );
}

/**
 * Short dark header of /events: title, one line of text, the session hours,
 * the venue and "free", then one compact banner per upcoming special event.
 */
export default function EventsHeader({ specials }: { specials: EventView[] }) {
  const t = useTranslations("events");
  return (
    <section className="bg-stone-custom px-4 pt-24 pb-8 text-stone-white-hover sm:px-6">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl leading-none font-extrabold tracking-tight sm:text-[44px]">{t("title")}</h1>
            <p className="text-base text-stone-white-base sm:text-[17px]">{t("intro")}</p>
          </div>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-3.5 py-2">
              <MdOutlineSchedule aria-hidden="true" className="text-brand-orange-light" />
              {t("hours_chip", SESSION_TIME_VALUES)}
            </li>
            <li className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-3.5 py-2">
              <MdOutlineLocationOn aria-hidden="true" className="text-brand-orange-light" />
              <a href={VENUE.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {VENUE.name}&nbsp;<span aria-hidden="true">↗</span>
                <span className="sr-only"> {t("maps_new_tab")}</span>
              </a>
            </li>
            <li className="inline-flex items-center rounded-full bg-stone-800 px-3.5 py-2">{t("free_chip")}</li>
          </ul>
        </div>
        {specials.length > 0 && (
          <ul aria-label={t("banners_label")} className="flex flex-col gap-2.5">
            {specials.map((event) => (
              <li key={event.id}>
                <SpecialBanner event={event} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
