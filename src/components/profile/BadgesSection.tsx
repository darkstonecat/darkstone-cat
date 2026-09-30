"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  MdChevronLeft,
  MdChevronRight,
  MdOutlineCardGiftcard,
  MdOutlineHowToReg,
  MdOutlineStarBorder,
} from "react-icons/md";
import type { IconType } from "react-icons";
import { formatCalendarDate } from "@/lib/format-date";
import type { BadgeItem, BadgeKey } from "@/lib/member-home/badge-items";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const ICONS: Record<BadgeKey, IconType> = {
  member_year: MdOutlineStarBorder,
  volunteer_egara_joga: MdOutlineHowToReg,
  ludoteca_donor: MdOutlineCardGiftcard,
};

function useBadgeText() {
  const t = useTranslations("profile.home");
  const locale = useLocale();
  return (item: BadgeItem) => {
    const title =
      item.key === "member_year"
        ? item.year
          ? t("badge_member_year", { year: item.year })
          : t("badge_member_year_no_year")
        : t(`badge_${item.key}`);
    let description: string;
    if (item.key === "member_year" && item.earned && item.since) {
      description = t("badge_member_year_earned", { date: formatCalendarDate(item.since, locale) });
    } else {
      description = t(`badge_${item.key}_${item.earned ? "earned" : "locked"}`);
    }
    return { title, description };
  };
}

function BadgeCircle({ item, className }: { item: BadgeItem; className?: string }) {
  const Icon = ICONS[item.key];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[72px] shrink-0 items-center justify-center rounded-full",
        item.earned
          ? "bg-stone-custom text-brand-orange-light shadow-[0_0_0_4px_#fff,0_0_0_6px_#B54F00]"
          : "border-2 border-dashed border-stone-custom/30 text-stone-custom/45",
        className
      )}
    >
      <Icon size={32} />
    </span>
  );
}

function BadgeBody({ item, title, description }: { item: BadgeItem; title: string; description: string }) {
  const t = useTranslations("profile.home");
  return (
    <>
      <BadgeCircle item={item} />
      <span className={cn("text-base font-bold", !item.earned && "text-stone-custom/65")}>{title}</span>
      <span className="text-[13px] leading-snug text-stone-custom/65">{description}</span>
      {!item.earned && <span className="sr-only">{t("badge_locked")}</span>}
    </>
  );
}

/** "Les teves insígnies": 3-column grid on desktop, scroll-snap carousel on mobile. */
export default function BadgesSection({ items, className }: { items: BadgeItem[]; className?: string }) {
  const t = useTranslations("profile.home");
  const text = useBadgeText();
  const reduced = usePrefersReducedMotion();
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const earnedCount = items.filter((i) => i.earned).length;

  const syncIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    setIndex(best);
  }, []);

  const goTo = (target: number) => {
    const track = trackRef.current;
    const slide = track?.children[target] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2,
      behavior: reduced ? "auto" : "smooth",
    });
    setIndex(target);
  };

  return (
    <section
      aria-labelledby="badges-title"
      className={cn("flex min-w-0 flex-col gap-4 rounded-2xl bg-brand-white p-5 md:gap-5 md:p-7", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges-title" className="text-xl font-bold text-stone-custom">
          {t("badges_title")}
        </h2>
        <p className="text-sm font-bold text-brand-orange-text">
          {t("badges_count", { earned: earnedCount, total: items.length })}
        </p>
      </div>

      {/* Desktop: grid */}
      <ul className="hidden grid-cols-3 gap-4 md:grid">
        {items.map((item) => {
          const { title, description } = text(item);
          return (
            <li
              key={item.key}
              className={cn(
                "relative flex flex-col items-center gap-3 rounded-xl px-5 py-6 text-center",
                item.earned ? "bg-brand-beige" : "border-2 border-dashed border-stone-custom/20"
              )}
            >
              <BadgeBody item={item} title={title} description={description} />
            </li>
          );
        })}
      </ul>

      {/* Mobile: carousel */}
      <div
        role="region"
        aria-roledescription={t("carousel")}
        aria-label={t("badges_carousel_label")}
        className="flex flex-col gap-3 md:hidden"
      >
        <div className="-mx-5 overflow-hidden">
          <ul
            ref={trackRef}
            onScroll={syncIndex}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, i) => {
              const { title, description } = text(item);
              return (
                <li
                  key={item.key}
                  role="group"
                  aria-roledescription={t("slide")}
                  aria-label={t("slide_label", { current: i + 1, total: items.length })}
                  className={cn(
                    "relative flex min-h-[232px] shrink-0 basis-[286px] snap-center flex-col items-center justify-center gap-3 rounded-2xl p-5 text-center",
                    item.earned ? "bg-brand-beige" : "border-2 border-dashed border-stone-custom/20"
                  )}
                >
                  <BadgeBody item={item} title={title} description={description} />
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label={t("prev_badge")}
            className="flex size-11 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom disabled:opacity-40"
          >
            <MdChevronLeft aria-hidden="true" size={24} />
          </button>
          <div className="flex items-center">
            {items.map((item, i) => (
              <button
                key={item.key}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t("dot_label", { number: i + 1, title: text(item).title })}
                aria-current={i === index ? "true" : undefined}
                className="flex h-11 w-8 items-center justify-center"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === index ? "w-5 bg-brand-orange" : "w-2 bg-stone-custom/30"
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === items.length - 1}
            aria-label={t("next_badge")}
            className="flex size-11 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom disabled:opacity-40"
          >
            <MdChevronRight aria-hidden="true" size={24} />
          </button>
        </div>
      </div>
    </section>
  );
}
