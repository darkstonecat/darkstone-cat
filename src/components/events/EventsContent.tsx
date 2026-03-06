"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { useState, useCallback } from "react";
import { MdChevronLeft, MdChevronRight, MdOpenInNew } from "react-icons/md";
import type { LudoyaEvent } from "@/lib/ludoya";

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

function formatDateBadge(startsAt: string, timeZone: string, locale: string): {
  dayAbbr: string;
  date: string;
  time: string;
} {
  const d = new Date(startsAt);
  const dayAbbr = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone,
  }).format(d);
  const day = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    timeZone,
  }).format(d);
  const month = new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    timeZone,
  }).format(d);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);

  return {
    dayAbbr: dayAbbr.replace(".", ""),
    date: `${day}.${month}`,
    time,
  };
}

function formatTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("ca", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(iso));
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

function formatFullDate(startsAt: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(startsAt));
}

// ---------------------------------------------------------------------------
// Carousel hook
// ---------------------------------------------------------------------------

function useCarousel(total: number, perPage: number) {
  const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
  const [page, setPage] = useState(0);

  const prev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const next = useCallback(
    () => setPage((p) => Math.min(maxPage, p + 1)),
    [maxPage]
  );
  const goTo = useCallback(
    (p: number) => setPage(Math.min(maxPage, Math.max(0, p))),
    [maxPage]
  );

  return {
    page,
    maxPage,
    prev,
    next,
    goTo,
    hasPrev: page > 0,
    hasNext: page < maxPage,
    showControls: total > perPage,
  };
}

// ---------------------------------------------------------------------------
// ProgressiveEventImage
// ---------------------------------------------------------------------------

const EVENT_IMAGE_SIZES = "(max-width: 768px) 80vw, 40vw";

function ProgressiveEventImage({ event }: { event: LudoyaEvent }) {
  const [hiLoaded, setHiLoaded] = useState(false);
  const [hiVisible, setHiVisible] = useState(false);
  const hasHiRes = !!event.imageUrl && event.imageUrl !== event.thumbnailUrl;
  const thumbnail = event.thumbnailUrl ?? event.imageUrl!;

  return (
    <>
      {/* Low-res thumbnail — visible until high-res fade-in completes */}
      {!hiVisible && (
        <Image
          src={thumbnail}
          alt={event.title}
          fill
          quality={60}
          className="object-cover"
          sizes={EVENT_IMAGE_SIZES}
        />
      )}
      {/* High-res image — fades in over the thumbnail, then hides it */}
      {hasHiRes && (
        <Image
          src={event.imageUrl!}
          alt={event.title}
          fill
          quality={60}
          className={`object-cover transition-opacity duration-300 ${
            hiLoaded ? "opacity-100" : "opacity-0"
          }`}
          sizes={EVENT_IMAGE_SIZES}
          onLoad={() => setHiLoaded(true)}
          onTransitionEnd={() => { if (hiLoaded) setHiVisible(true); }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// EventCard
// ---------------------------------------------------------------------------

function EventCard({
  event,
  locale,
}: {
  event: LudoyaEvent;
  locale: string;
}) {
  const t = useTranslations("events");
  const tz = event.timeZone;
  const badge = formatDateBadge(event.startsAt, tz, locale);
  const timeRange = formatTimeRange(event.startsAt, event.endsAt, tz);
  const fullDate = formatFullDate(event.startsAt, tz, locale);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl bg-brand-white shadow-md">
      {/* Image section */}
      <a
        href={event.ludoyaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-square w-full bg-stone-200">
        {event.thumbnailUrl || event.imageUrl ? (
          <ProgressiveEventImage event={event} />
        ) : (
          <div className="flex h-full items-center justify-center bg-stone-300">
            <span className="text-4xl opacity-30">🎲</span>
          </div>
        )}

        {/* Date badge overlay */}
        <div className="absolute top-3 left-3 rounded-lg bg-brand-orange px-3 py-1.5 text-center leading-tight text-white shadow-lg">
          <span className="block text-xs font-semibold uppercase">
            {badge.dayAbbr}. {badge.date}
          </span>
          <span className="block text-sm font-bold">{badge.time}</span>
        </div>

      </a>

      {/* Text section */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-bold text-stone-custom line-clamp-2">
          {event.title}
        </h3>
        <p className="text-sm text-stone-custom/60">
          <span className="capitalize">{fullDate}</span> | {timeRange}
        </p>

        {/* Game pills */}
        {event.plannedPlays.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.plannedPlays.slice(0, 12).map((pp, i) => (
              <span
                key={i}
                className="rounded-full bg-stone-custom/10 px-2.5 py-0.5 text-xs font-medium text-stone-custom/70"
              >
                {pp.gameName}
              </span>
            ))}
            {event.plannedPlays.length > 12 && (
              <span className="rounded-full bg-stone-custom/10 px-2.5 py-0.5 text-xs font-medium text-stone-custom/70">
                +{event.plannedPlays.length - 12}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2">
          <a
            href={event.ludoyaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange-text transition-colors hover:text-brand-orange"
          >
            {t("view_event")}
            <MdOpenInNew className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// EventSection — dark card containing carousel of mini-cards
// ---------------------------------------------------------------------------

function EventSection({
  title,
  events,
  locale,
}: {
  title: string;
  events: LudoyaEvent[];
  locale: string;
}) {
  const carousel = useCarousel(events.length, 2);
  const mobileCarousel = useCarousel(events.length, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
    >
      <div className="rounded-2xl bg-stone-custom p-4 sm:p-6 md:p-8">
        <h2 className="mb-6 text-2xl font-bold text-brand-white sm:text-3xl">
          {title}
        </h2>

        {/* Desktop carousel (md+) — all cards in DOM for consistent height */}
        <div className="hidden md:block">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${carousel.page * 100}%)` }}
            >
              {/* Render cards in pairs, each pair takes full width */}
              {Array.from({ length: carousel.maxPage + 1 }, (_, pageIdx) => (
                <div
                  key={pageIdx}
                  className="grid w-full flex-shrink-0 grid-cols-2 gap-6"
                >
                  {events.slice(pageIdx * 2, pageIdx * 2 + 2).map((event) => (
                    <EventCard key={event.id} event={event} locale={locale} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {carousel.showControls && (
            <CarouselControls
              page={carousel.page}
              maxPage={carousel.maxPage}
              hasPrev={carousel.hasPrev}
              hasNext={carousel.hasNext}
              onPrev={carousel.prev}
              onNext={carousel.next}
              onGoTo={carousel.goTo}
            />
          )}
        </div>

        {/* Mobile carousel — all cards in DOM for consistent height */}
        <div className="md:hidden">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${mobileCarousel.page * 100}%)` }}
            >
              {events.map((event) => (
                <div key={event.id} className="w-full flex-shrink-0">
                  <EventCard event={event} locale={locale} />
                </div>
              ))}
            </div>
          </div>

          {mobileCarousel.showControls && (
            <CarouselControls
              page={mobileCarousel.page}
              maxPage={mobileCarousel.maxPage}
              hasPrev={mobileCarousel.hasPrev}
              hasNext={mobileCarousel.hasNext}
              onPrev={mobileCarousel.prev}
              onNext={mobileCarousel.next}
              onGoTo={mobileCarousel.goTo}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CarouselControls
// ---------------------------------------------------------------------------

function CarouselControls({
  page,
  maxPage,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onGoTo,
}: {
  page: number;
  maxPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (p: number) => void;
}) {
  const t = useTranslations("events");

  return (
    <div className="mt-6 flex items-center justify-between">
      {/* Dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: maxPage + 1 }, (_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === page
                ? "w-6 bg-brand-orange"
                : "w-2 bg-brand-white/30 hover:bg-brand-white/50"
            }`}
            aria-label={`${t("carousel_page")} ${i + 1}`}
          />
        ))}
      </div>

      {/* Prev / Next */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-white/20 text-brand-white/70 transition-colors hover:bg-brand-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("carousel_prev")}
        >
          <MdChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-white/20 text-brand-white/70 transition-colors hover:bg-brand-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t("carousel_next")}
        >
          <MdChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

function ErrorState() {
  const t = useTranslations("events");

  return (
    <motion.div
      className="rounded-2xl bg-stone-custom p-8 text-center sm:p-12"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <p className="text-4xl">🎲</p>
      <h2 className="mt-4 text-xl font-bold text-brand-white sm:text-2xl">
        {t("error_title")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-brand-white/60">
        {t("error_description")}
      </p>
      <a
        href="https://app.ludoya.com/groups/darkstonecat/events?view=LIST&tab=future"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-orange/90"
      >
        {t("error_link")}
        <MdOpenInNew className="h-4 w-4" />
      </a>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  const t = useTranslations("events");

  return (
    <motion.div
      className="rounded-2xl bg-stone-custom p-8 text-center sm:p-12"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <p className="text-4xl">🎲</p>
      <h2 className="mt-4 text-xl font-bold text-brand-white sm:text-2xl">
        {t("no_events")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-brand-white/60">
        {t("error_description")}
      </p>
      <a
        href="https://app.ludoya.com/groups/darkstonecat/events?view=LIST&tab=future"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-orange/90"
      >
        {t("error_link")}
        <MdOpenInNew className="h-4 w-4" />
      </a>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main EventsContent
// ---------------------------------------------------------------------------

interface EventsContentProps {
  regularEvents: LudoyaEvent[];
  specialEvents: LudoyaEvent[];
  error?: "api_error" | "timeout";
  locale: string;
}

export default function EventsContent({
  regularEvents,
  specialEvents,
  error,
  locale,
}: EventsContentProps) {
  const t = useTranslations("events");
  const hasAnyEvents = regularEvents.length > 0 || specialEvents.length > 0;

  if (error && !hasAnyEvents) {
    return (
      <section className="bg-brand-beige px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <ErrorState />
        </div>
      </section>
    );
  }

  if (!hasAnyEvents) {
    return (
      <section className="bg-brand-beige px-6 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          <EmptyState />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-brand-beige px-6 py-12 md:py-20">
      <div className="mx-auto flex max-w-5xl flex-col gap-12 md:gap-16">
        {regularEvents.length > 0 && (
          <EventSection
            title={t("regular_title")}
            events={regularEvents}
            locale={locale}
          />
        )}

        {specialEvents.length > 0 && (
          <EventSection
            title={t("special_title")}
            events={specialEvents}
            locale={locale}
          />
        )}
      </div>
    </section>
  );
}
