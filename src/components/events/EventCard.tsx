import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/events/agenda-format";
import { summarizeEvent, type AgendaPlace } from "@/lib/events/agenda-view";
import { countdownText, directionsUrl, eventAnchor } from "@/lib/events/links";
import PlayCard from "./PlayCard";

/** Covers in the collapsed session summary. */
const STACK_COVERS = 4;

interface EventCardProps {
  event: EventView;
  /** Events of this week get a dark date tile, later ones a white one. */
  isCurrentWeek: boolean;
  open: boolean;
  onToggle: () => void;
}

function NewTab() {
  const t = useTranslations("events");
  return (
    <>
      &nbsp;<span aria-hidden="true">↗</span>
      <span className="sr-only"> {t("new_tab")}</span>
    </>
  );
}

function AwayPlace({ place, dark }: { place: AgendaPlace; dark?: boolean }) {
  const t = useTranslations("events");
  const accent = dark ? "text-brand-orange-light" : "text-brand-orange-text";
  return (
    <span className="text-[15px]">
      <strong>{place.name}</strong> · <span className={accent}>{t("away")}</span> ·{" "}
      <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className={cn("underline underline-offset-2", accent)}>
        {t("directions")}
        <NewTab />
      </a>
    </span>
  );
}

function ToggleButton({ open, special, panelId, onToggle }: { open: boolean; special: boolean; panelId: string; onToggle: () => void }) {
  const t = useTranslations("events");
  const Icon = open ? MdExpandLess : MdExpandMore;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        "inline-flex min-h-11 w-[150px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-colors",
        special
          ? "border-stone-600 text-stone-white-hover hover:bg-white/10"
          : "border-stone-300 bg-white text-stone-custom hover:bg-stone-100"
      )}
    >
      {open ? t("hide") : special ? t("show_details") : t("show_plays")}
      <Icon aria-hidden="true" size={18} />
    </button>
  );
}

function PlaysGrid({ event, dark = false }: { event: EventView; dark?: boolean }) {
  const t = useTranslations("events");
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
      {event.plays.map((play) => (
        <PlayCard key={play.id} play={play} time={play.time} dark={dark} />
      ))}
      <li className="flex flex-col gap-2">
        <a
          href={event.ludoyaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed p-3 text-center transition-colors",
            dark
              ? "border-stone-600 text-brand-orange-light hover:bg-white/5"
              : "border-[#E9B98F] text-brand-orange-text hover:bg-white/60"
          )}
        >
          <span aria-hidden="true" className="text-[32px] font-light">+</span>
          <strong className={cn("text-sm", dark ? "text-stone-white-hover" : "text-stone-custom")}>{t("propose_title")}</strong>
          <span className={cn("text-xs", dark ? "text-stone-white-base" : "text-stone-600")}>{event.plays.length === 0 ? t("propose_hint_first") : t("propose_hint")}</span>
          <span className="sr-only">{t("new_tab")}</span>
        </a>
      </li>
    </ul>
  );
}

function SessionSummary({ event, open }: { event: EventView; open: boolean }) {
  const t = useTranslations("events");
  const { playCount, availability } = summarizeEvent(event);
  const covers = event.plays.filter((p) => p.coverUrl).slice(0, STACK_COVERS);
  const freeText =
    availability.kind === "none"
      ? t("propose_short")
      : availability.kind === "seats"
        ? t("summary_free", { count: availability.free })
        : availability.kind === "unlimited"
          ? t("unlimited")
          : t("all_full");
  return (
    <>
      {!open && covers.length > 0 && (
        <span aria-hidden="true" className="flex pl-2.5">
          {covers.map((play) => (
            <span key={play.id} className="relative -ml-2.5 size-9 overflow-hidden rounded-lg border-2 border-white bg-stone-custom">
              <Image src={play.coverUrl!} alt="" fill quality={60} sizes="36px" className="object-cover" />
            </span>
          ))}
        </span>
      )}
      <span className="flex min-w-[120px] flex-col text-sm">
        <strong>{playCount === 0 ? t("plays_none") : t("summary_plays", { count: playCount })}</strong>
        <span className={cn("font-bold", availability.kind === "none" || availability.kind === "all_full" ? "text-stone-600" : "text-brand-orange-text")}>
          {freeText}
        </span>
      </span>
    </>
  );
}

function SessionCard({ event, open, onToggle, panelId }: EventCardProps & { panelId: string }) {
  return (
    <article className="mb-5 min-w-0 flex-1 overflow-hidden rounded-[22px] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-5 sm:px-[22px]">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-xl font-extrabold sm:text-[22px]">{event.title}</h3>
          <span className="text-[15px] text-stone-600">{event.when}</span>
          {event.place && <AwayPlace place={event.place} />}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SessionSummary event={event} open={open} />
          <ToggleButton open={open} special={false} panelId={panelId} onToggle={onToggle} />
        </div>
      </div>
      <div id={panelId} hidden={!open} className="border-t border-stone-200 px-5 pt-[18px] pb-[22px] sm:px-[22px]">
        <PlaysGrid event={event} />
      </div>
    </article>
  );
}

function SpecialCard({ event, open, onToggle, panelId }: EventCardProps & { panelId: string }) {
  const t = useTranslations("events");
  return (
    <article className="mb-5 min-w-0 flex-1 overflow-hidden rounded-[22px] bg-stone-custom text-stone-white-hover">
      <div className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-5 sm:px-[22px]">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-extrabold text-brand-orange-light uppercase">
            <span aria-hidden="true">★ </span>
            {t("special_badge")}
            {event.countdown && ` · ${countdownText(t, event.countdown)}`}
          </span>
          <h3 className="text-xl font-extrabold sm:text-2xl">{event.title}</h3>
          <span className="text-[15px] text-stone-white-base">
            {event.dates}
            {event.place && ` · ${event.place.name}`}
          </span>
        </div>
        <ToggleButton open={open} special panelId={panelId} onToggle={onToggle} />
      </div>
      <div id={panelId} hidden={!open} className="border-t border-stone-700">
        <div className="flex flex-wrap">
          {event.imageUrl && (
            <div className="relative min-h-[220px] flex-[1_1_260px] bg-brand-orange/40 sm:min-h-[260px]">
              <Image src={event.imageUrl} alt="" fill quality={60} sizes="(min-width: 1024px) 400px, 100vw" className="object-cover" />
            </div>
          )}
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5 p-5 sm:p-[22px]">
            <span className="text-[15px]">
              <strong>{event.dates}</strong>
              <span className="text-stone-white-base"> · {event.time}</span>
            </span>
            {event.place && <AwayPlace place={event.place} dark />}
            <span className="text-[15px] text-stone-white-base">
              {t("signups", { count: event.participantCount })} ·{" "}
              {event.capacity === null
                ? t("capacity_unlimited")
                : t("capacity_left", { count: Math.max(event.capacity - event.participantCount, 0) })}
            </span>
            {event.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line text-stone-white-base">{event.description}</p>
            )}
            {event.plays.length === 0 && (
              <p className="text-[13px] text-stone-400">
                {t("special_plays_none")}{" "}
                <a href={event.ludoyaUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-orange-light underline underline-offset-2">
                  {t("propose_short")}
                  <NewTab />
                </a>
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-2.5">
              <a
                href={event.ludoyaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center rounded-[14px] bg-brand-orange px-5 text-[15px] font-bold text-white transition-colors hover:bg-brand-orange/90"
              >
                {t("special_join")}
                <NewTab />
              </a>
            </div>
          </div>
        </div>
        {event.plays.length > 0 && (
          // Same insets as the session panel, so the play cards get the same size.
          <div className="px-5 py-5 pb-[22px] sm:px-[22px] sm:pt-[22px]">
            <PlaysGrid event={event} dark />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * One event of the timeline: the date tile on the left and a collapsible card.
 * Sessions are white with the plays grid; special events are dark with their
 * image, description and the Ludoya sign-up.
 */
export default function EventCard(props: EventCardProps) {
  const { event, isCurrentWeek } = props;
  const anchor = eventAnchor(event.id);
  const panelId = `${anchor}-panel`;
  const special = event.type === "special";
  return (
    <div id={anchor} className="flex scroll-mt-24 gap-3 sm:gap-5">
      <div className="flex w-12 shrink-0 flex-col items-center sm:w-16">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-12 flex-col items-center justify-center rounded-2xl leading-none sm:size-16",
            special
              ? "bg-brand-orange text-white"
              : isCurrentWeek
                ? "bg-stone-custom text-stone-white-hover"
                : "border border-stone-300 bg-white text-stone-custom"
          )}
        >
          <span className="text-[10px] font-bold sm:text-[11px]">{event.tile.weekday}</span>
          <span className="text-xl font-extrabold sm:text-2xl">{event.tile.day}</span>
        </span>
        <span aria-hidden="true" className="mt-2 w-0.5 flex-1 bg-stone-300" />
      </div>
      {special ? <SpecialCard {...props} panelId={panelId} /> : <SessionCard {...props} panelId={panelId} />}
    </div>
  );
}
