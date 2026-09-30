"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  MdAdd,
  MdExpandLess,
  MdExpandMore,
  MdOutlineCasino,
  MdOutlineErrorOutline,
  MdOutlinePlace,
} from "react-icons/md";
import type { MemberSession, MemberSessionPlay } from "@/lib/member-sessions";
import {
  formatSessionWhen,
  formatTile,
  MAX_PLAYS_SHOWN,
  MAX_STACK_COVERS,
  playSeats,
  SEAT_DOTS_MAX,
  summarizeSession,
} from "@/lib/member-home/sessions-view";
import { cn } from "@/lib/utils";

type SessionsListProps = {
  sessions: MemberSession[];
  /** Set when Ludoya could not be reached and there is no cached data. */
  error?: "api_error" | "timeout";
  /** Ludoya home, used by the empty and error states. */
  ludoyaUrl: string;
};

const externalLink = { target: "_blank", rel: "noopener noreferrer" } as const;

function Cover({ url, className }: { url: string | null; className: string }) {
  if (!url) {
    return (
      <span aria-hidden="true" className={cn("flex items-center justify-center bg-brand-beige text-stone-custom/55", className)}>
        <MdOutlineCasino size={20} />
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt=""
      width={96}
      height={96}
      quality={60}
      sizes="48px"
      className={cn("bg-brand-beige object-cover", className)}
    />
  );
}

function SeatDots({ taken, capacity }: { taken: number; capacity: number }) {
  return (
    <span aria-hidden="true" className="hidden w-[136px] flex-wrap justify-end gap-1 md:flex">
      {Array.from({ length: capacity }, (_, i) => (
        <span
          key={i}
          className={cn("size-3 rounded-full", i < taken ? "bg-brand-orange" : "border-2 border-stone-custom/50")}
        />
      ))}
    </span>
  );
}

function PlayRow({ play }: { play: MemberSessionPlay }) {
  const t = useTranslations("profile.home.sessions");
  const seats = playSeats(play);
  const full = seats.kind === "full";

  const count = seats.capacity === null ? t("taken_unlimited", { count: seats.taken }) : t("taken", { taken: seats.taken, capacity: seats.capacity });
  const status =
    seats.kind === "unlimited"
      ? t("status_unlimited")
      : seats.kind === "full"
        ? t("status_full")
        : seats.kind === "last"
          ? t("status_last")
          : t("status_free", { count: seats.free ?? 0 });

  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-stone-custom/12 p-3 md:flex-row md:items-center md:gap-4 md:rounded-none md:border-0 md:border-b md:border-stone-custom/10 md:px-0 md:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
        <Cover url={play.coverUrl} className="size-12 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-col">
          <span className="text-base font-bold text-stone-custom">{play.gameName}</span>
          {play.organizerName && (
            <span className="text-[13px] text-stone-custom/65">{t("organizer", { name: play.organizerName })}</span>
          )}
        </div>
      </div>
      {seats.capacity !== null && seats.capacity <= SEAT_DOTS_MAX && <SeatDots taken={seats.taken} capacity={seats.capacity} />}
      <div className="flex items-baseline gap-2 md:contents">
        <span className="text-[15px] font-bold text-stone-custom md:w-14 md:text-right">{count}</span>
        <span
          className={cn(
            "text-[13px] font-semibold md:w-40",
            seats.kind === "last" || seats.kind === "free" ? "text-brand-orange-text" : "text-stone-custom/65"
          )}
        >
          {status}
        </span>
      </div>
      <a
        href={play.ludoyaUrl}
        {...externalLink}
        aria-label={`${t(full ? "queue_label" : "join_label", { game: play.gameName })} ${t("new_tab")}`}
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl px-4 text-sm font-semibold md:w-32",
          full ? "border border-stone-custom/25 text-stone-custom" : "bg-stone-custom text-brand-white"
        )}
      >
        {t(full ? "join_queue" : "join")}
        <span aria-hidden="true">↗</span>
      </a>
    </li>
  );
}

function SessionItem({ session }: { session: MemberSession }) {
  const t = useTranslations("profile.home.sessions");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = `plays-${session.id}`;
  const special = session.type === "special";
  const tile = formatTile(session.startsAt, locale);
  const summary = summarizeSession(session);
  const shown = session.plannedPlays.slice(0, MAX_PLAYS_SHOWN);
  const hidden = session.plannedPlays.length - shown.length;
  const covers = session.plannedPlays.filter((p) => p.coverUrl).slice(0, MAX_STACK_COVERS);

  return (
    <li>
      <section aria-label={session.title} className="rounded-xl border border-stone-custom/12">
        <div className="flex flex-col gap-3 p-3.5 md:flex-row md:items-center md:gap-4 md:py-3.5 md:pr-4 md:pl-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none text-brand-white md:size-[52px]",
                special ? "bg-brand-orange" : "bg-stone-custom"
              )}
            >
              <span className={cn("text-[11px] font-bold", special ? "text-brand-white" : "text-brand-orange-light")}>
                {tile.weekday}
              </span>
              <span className="text-xl font-extrabold md:text-[22px]">{tile.day}</span>
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="text-base font-bold text-stone-custom md:text-lg">{session.title}</h3>
                {special && (
                  <span className="rounded-full bg-brand-orange/12 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-brand-orange-text uppercase">
                    {t("special")}
                  </span>
                )}
              </div>
              <p className="text-sm text-stone-custom/65">{formatSessionWhen(session, locale)}</p>
              {session.place && (
                <p
                  className={cn(
                    "flex items-center gap-1 text-[13px]",
                    session.place.isUsual ? "text-stone-custom/65" : "font-semibold text-brand-orange-text"
                  )}
                >
                  <MdOutlinePlace aria-hidden="true" size={14} className="shrink-0" />
                  {session.place.name}
                </p>
              )}
            </div>
          </div>

          {covers.length > 0 && (
            <div aria-hidden="true" className="hidden items-center pl-2.5 md:flex">
              {covers.map((play) => (
                <Cover
                  key={play.id}
                  url={play.coverUrl}
                  className="-ml-2.5 size-9 rounded-lg border-2 border-brand-white"
                />
              ))}
            </div>
          )}

          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm md:w-[170px] md:flex-col md:gap-0">
            <span className="font-bold text-stone-custom">
              {summary.playCount === 0 ? t("no_plays") : t("plays", { count: summary.playCount })}
            </span>
            {summary.availability.kind === "seats" && (
              <span className="font-semibold text-brand-orange-text">{t("seats_free", { count: summary.availability.free })}</span>
            )}
            {summary.availability.kind === "all_full" && (
              <span className="font-semibold text-stone-custom/65">{t("all_full")}</span>
            )}
            {summary.availability.kind === "unlimited" && (
              <span className="font-semibold text-stone-custom/65">{t("unlimited")}</span>
            )}
          </p>

          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-stone-custom/20 bg-brand-white px-4 text-sm font-semibold text-stone-custom md:w-[150px]"
          >
            {open ? t("hide_plays") : t("show_plays")}
            <span className="sr-only">{t("toggle_for", { title: session.title })}</span>
            {open ? <MdExpandLess aria-hidden="true" size={20} /> : <MdExpandMore aria-hidden="true" size={20} />}
          </button>
        </div>

        <div id={panelId} hidden={!open} className="px-3 pb-3.5 md:px-5 md:pb-4">
          <ul aria-label={t("plays_list", { title: session.title })} className="flex flex-col gap-2.5 md:gap-0">
            {shown.map((play) => (
              <PlayRow key={play.id} play={play} />
            ))}
            <li className="flex flex-col gap-2.5 rounded-xl border border-dashed border-brand-orange/50 p-3 md:flex-row md:items-center md:gap-4 md:rounded-none md:border-0 md:px-0 md:py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-brand-orange/50 text-brand-orange-text"
                >
                  <MdAdd size={22} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-base font-bold text-stone-custom">{t("propose_title")}</span>
                  <span className="text-[13px] text-stone-custom/65">{t("propose_text")}</span>
                </div>
              </div>
              <a
                href={session.ludoyaUrl}
                {...externalLink}
                aria-label={`${t("propose_label", { title: session.title })} ${t("new_tab")}`}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-brand-orange px-4 text-sm font-semibold text-brand-orange-text md:w-32"
              >
                {t("propose")}
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
          {hidden > 0 && (
            <a
              href={session.ludoyaUrl}
              {...externalLink}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-orange-text underline underline-offset-2"
            >
              {t("more", { count: hidden })}
              <span className="sr-only"> {t("new_tab")}</span>
              <span aria-hidden="true">&nbsp;→</span>
            </a>
          )}
        </div>
      </section>
    </li>
  );
}

/** Body of "Properes sessions": the session accordion, or the empty / error state. */
export default function SessionsList({ sessions, error, ludoyaUrl }: SessionsListProps) {
  const t = useTranslations("profile.home.sessions");

  if (error) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-stone-custom/12 bg-brand-beige p-5">
        <div className="flex items-center gap-2 text-stone-custom">
          <MdOutlineErrorOutline aria-hidden="true" size={22} className="text-brand-orange-text" />
          <p className="text-base font-bold">{t("error_title")}</p>
        </div>
        <p className="text-sm leading-normal text-stone-custom/70">{t("error_text")}</p>
        <a
          href={ludoyaUrl}
          {...externalLink}
          className="inline-flex min-h-11 items-center rounded-xl bg-stone-custom px-5 text-sm font-semibold text-brand-white"
        >
          {t("open_ludoya")}
          <span className="sr-only"> {t("new_tab")}</span>
          <span aria-hidden="true">&nbsp;↗</span>
        </a>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-stone-custom/12 bg-brand-beige p-5">
        <p className="text-base font-bold text-stone-custom">{t("empty_title")}</p>
        <p className="text-sm leading-normal text-stone-custom/70">{t("empty_text")}</p>
        <a
          href={ludoyaUrl}
          {...externalLink}
          className="inline-flex min-h-11 items-center rounded-xl border border-stone-custom/20 bg-brand-white px-5 text-sm font-semibold text-stone-custom"
        >
          {t("open_ludoya")}
          <span className="sr-only"> {t("new_tab")}</span>
          <span aria-hidden="true">&nbsp;↗</span>
        </a>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {sessions.map((session) => (
        <SessionItem key={session.id} session={session} />
      ))}
    </ul>
  );
}
