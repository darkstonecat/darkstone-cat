import Image from "next/image";
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import { cn } from "@/lib/utils";
import type { EventView } from "@/lib/events/agenda-format";
import { programItems, summarizeEvent, type AgendaPlace } from "@/lib/events/agenda-view";
import { countdownText, directionsUrl, eventAnchor } from "@/lib/events/links";
import EventProgram from "./program/EventProgram";
import { ArrowOutwardIcon, LudoyaIcon } from "./icons";
import ProposeTile from "./program/ProposeTile";
import { useCountsSummary } from "./program/useCountsSummary";

/** Covers in the collapsed session summary. */
const STACK_COVERS = 4;

interface EventCardProps {
  event: EventView;
  /** Events of this week get a dark date tile, later ones a white one. */
  isCurrentWeek: boolean;
  open: boolean;
  onToggle: () => void;
  /** First event of the timeline: the line starts behind its date tile (at the centre of a one-day tile). */
  isFirst?: boolean;
  /** Last event of the timeline: the line ends behind its date tile (at the centre of a one-day tile). */
  isLast?: boolean;
}

/**
 * One segment of the timeline line, centred on the date tile column (48 px, 64 px from sm).
 * Every row and week header draws its own segment edge to edge, so they join into one line;
 * the tile sits on top of it.
 */
export const RAIL = "pointer-events-none absolute left-[23px] w-0.5 bg-stone-300 sm:left-[31px]";

/** Trailing icon and screen-reader note of a link that opens in a new tab; `ludoya` shows the Ludoya mark. */
function NewTab({ ludoya = false }: { ludoya?: boolean }) {
  const t = useTranslations("events");
  return (
    <>
      &nbsp;{ludoya ? <LudoyaIcon /> : <ArrowOutwardIcon />}
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

function SessionSummary({ event, open }: { event: EventView; open: boolean }) {
  const t = useTranslations("events");
  const { playCount, availability } = summarizeEvent(event);
  const covers = programItems(event.program)
    .filter((item) => item.coverUrl)
    .slice(0, STACK_COVERS);
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
          {covers.map((item) => (
            <span key={item.id} className="relative -ml-2.5 size-9 overflow-hidden rounded-lg border-2 border-white bg-stone-custom">
              <Image src={item.coverUrl!} alt="" fill quality={60} sizes="36px" className="object-cover" />
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
        <EventProgram program={event.program} trailing={<ProposeTile href={event.ludoyaUrl} first={summarizeEvent(event).playCount === 0} />} />
      </div>
    </article>
  );
}

function SpecialCard({ event, open, onToggle, panelId }: EventCardProps & { panelId: string }) {
  const t = useTranslations("events");
  const countsSummary = useCountsSummary();
  const hasItems = programItems(event.program).length > 0;
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
            {hasItems && (
              <ul data-program-counts className="flex flex-wrap gap-2">
                {countsSummary(event.program.counts).map((part) => (
                  <li key={part} className="rounded-full bg-stone-800 px-3 py-1.5 text-[13px]">
                    {part}
                  </li>
                ))}
              </ul>
            )}
            {event.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line text-stone-white-base">{event.description}</p>
            )}
            {!hasItems && (
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
                <NewTab ludoya />
              </a>
            </div>
          </div>
        </div>
        {hasItems && (
          // Same insets as the session panel, so the play cards get the same size.
          <div className="px-5 py-5 pb-[22px] sm:px-[22px] sm:pt-[22px]">
            <EventProgram
              program={event.program}
              dark
              trailing={<ProposeTile href={event.ludoyaUrl} first={summarizeEvent(event).playCount === 0} dark />}
            />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * One event of the timeline: the date tile on the left and a collapsible card.
 * Sessions are white with their program; special events are dark with their
 * image, description and the Ludoya sign-up.
 */
export default function EventCard(props: EventCardProps) {
  const { event, isCurrentWeek, isFirst = false, isLast = false } = props;
  const anchor = eventAnchor(event.id);
  const panelId = `${anchor}-panel`;
  const special = event.type === "special";
  return (
    <div id={anchor} className="relative flex scroll-mt-24 gap-3 sm:gap-5">
      {!(isFirst && isLast) && (
        <span
          aria-hidden="true"
          data-timeline-rail
          className={cn(
            RAIL,
            isFirst ? "top-6 bottom-0 sm:top-8" : isLast ? "top-0 h-6 sm:h-8" : "top-0 bottom-0"
          )}
        />
      )}
      <div className="w-12 shrink-0 sm:w-16">
        <span
          aria-hidden="true"
          data-timeline-tile
          className={cn(
            // One day fills a square; a multi-day tile stacks its first and last day and grows taller.
            "relative flex min-h-12 w-12 flex-col items-center justify-center gap-1.5 rounded-2xl py-2 leading-none sm:min-h-16 sm:w-16",
            special
              ? "bg-brand-orange text-white"
              : isCurrentWeek
                ? "bg-stone-custom text-stone-white-hover"
                : "border border-stone-300 bg-white text-stone-custom"
          )}
        >
          {event.tile.days.map((day, index) => (
            <Fragment key={index}>
              {index > 0 &&
                (event.tile.gap ? (
                  <span className="text-sm leading-none font-extrabold opacity-70">⋮</span>
                ) : (
                  <span className="h-px w-5 bg-current opacity-40" />
                ))}
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-bold sm:text-[11px]">{day.weekday}</span>
                <span className="text-xl font-extrabold sm:text-2xl">{day.day}</span>
              </span>
            </Fragment>
          ))}
        </span>
      </div>
      {special ? <SpecialCard {...props} panelId={panelId} /> : <SessionCard {...props} panelId={panelId} />}
    </div>
  );
}
