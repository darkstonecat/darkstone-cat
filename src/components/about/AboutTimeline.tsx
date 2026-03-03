"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { TIMELINE_EVENTS } from "@/data/timeline-events";
import { cn } from "@/lib/utils";

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

const PX_PER_DAY = 0.6;
const MIN_GAP = 24;

function getGaps() {
  return TIMELINE_EVENTS.map((event, i) => {
    if (i === 0) return 0;
    const days = daysBetween(TIMELINE_EVENTS[i - 1].date, event.date);
    return Math.max(Math.round(days * PX_PER_DAY), MIN_GAP);
  });
}

const gaps = getGaps();

export default function AboutTimeline() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-stone-custom py-20 text-stone-white-hover">
      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <motion.span
            className="mb-3 block text-xs uppercase tracking-[0.2em] text-stone-white-hover/40"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4 }}
          >
            {t("timeline_title")}
          </motion.span>
          <motion.h2
            className="text-3xl font-black tracking-tight sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            {t("timeline_subtitle")}
          </motion.h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 h-full w-px bg-stone-white-hover/15 md:left-1/2 md:-translate-x-px" />

          <div className="flex flex-col">
            {TIMELINE_EVENTS.map((event, i) => {
              const isMajor = event.type === "major";
              const isEven = i % 2 === 0;

              return (
                <motion.div
                  key={event.id}
                  className={cn(
                    "relative flex items-start gap-6",
                    "pl-12 md:pl-0",
                    isEven ? "md:flex-row" : "md:flex-row-reverse"
                  )}
                  style={{ marginTop: i === 0 ? 0 : gaps[i] }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                >
                  {/* Marker */}
                  <div
                    className={cn(
                      "absolute left-4 -translate-x-1/2 rounded-full md:left-1/2",
                      isMajor
                        ? "h-4 w-4 bg-brand-orange shadow-[0_0_8px_rgba(192,86,0,0.4)]"
                        : "mt-0.5 h-2 w-2 bg-stone-white-hover/30"
                    )}
                  />

                  {/* Card */}
                  <div
                    className={cn(
                      "w-full md:w-[calc(50%-2rem)]",
                      isEven ? "md:text-right" : "md:text-left"
                    )}
                  >
                    {isMajor ? (
                      <>
                        <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-brand-orange">
                          {t(event.dateKey)}
                        </span>
                        <h3 className="mt-1 text-lg font-bold">
                          {t(event.nameKey)}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-stone-white-hover/60">
                          {t(event.descriptionKey)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs leading-snug text-stone-white-hover/45">
                        <span className="uppercase tracking-[0.1em]">
                          {t(event.dateKey)}
                        </span>
                        {" · "}
                        <span className="font-medium text-stone-white-hover/60">
                          {t(event.nameKey)}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Spacer for the other side (desktop) */}
                  <div className="hidden w-[calc(50%-2rem)] md:block" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
