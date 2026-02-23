"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { motion } from "motion/react";
import { useThemeSection } from "@/hooks/useThemeSection";
import TextReveal from "@/components/TextReveal";

const CARDS = [
  { id: "board_games", image: "/images/photos/boardgames_finspan.webp" },
  { id: "rpg", image: "/images/photos/rol_miseries2.webp" },
  { id: "events", image: "/images/photos/events_speedpainting.webp" },
  { id: "egara", image: "/images/photos/egarajuga_sam.webp" },
] as const;

export default function Activities() {
  const t = useTranslations("activities");
  const sectionRef = useThemeSection("#EEE8DC", "#1c1917");
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    const cardWidth = carouselRef.current.firstElementChild?.clientWidth ?? 400;
    carouselRef.current.scrollBy({
      left: dir === "right" ? cardWidth + 16 : -(cardWidth + 16),
      behavior: "smooth",
    });
  };

  return (
    <section
      ref={sectionRef}
      id="activities"
      className="flex min-h-screen flex-col py-16 md:py-24"
    >
      {/* Header */}
      <div className="container mx-auto flex items-end justify-between px-8 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.3em] opacity-40">
            {t("section_label")}
          </span>
          <TextReveal
            text={t("title")}
            as="h2"
            className="mt-1 text-4xl font-black tracking-tight md:text-5xl"
          />
          <p className="mt-2 max-w-md text-sm opacity-50">
            {t("text")}
          </p>
        </motion.div>

        {/* Navigation arrows */}
        <motion.div
          className="hidden gap-2 md:flex"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <button
            onClick={() => scroll("left")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 transition-colors hover:bg-current/5"
            aria-label="Previous"
          >
            &larr;
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 transition-colors hover:bg-current/5"
            aria-label="Next"
          >
            &rarr;
          </button>
        </motion.div>
      </div>

      {/* Carousel */}
      <div
        ref={carouselRef}
        className="no-scrollbar flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-8"
      >
        {CARDS.map((card, i) => (
          <motion.div
            key={card.id}
            className="relative shrink-0 snap-start overflow-hidden rounded-2xl w-[85vw] md:w-[55vw] lg:w-[45vw]"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            {/* Image */}
            <div className="relative h-full min-h-[55vh] md:min-h-[60vh]">
              <Image
                src={card.image}
                alt={t(`items.${card.id}.title`)}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 85vw, (max-width: 1024px) 55vw, 45vw"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Number */}
              <span className="absolute right-4 top-4 font-mono text-xs text-white/40">
                {String(i + 1).padStart(2, "0")} / {String(CARDS.length).padStart(2, "0")}
              </span>

              {/* Text */}
              <div className="absolute bottom-0 left-0 p-6 md:p-8">
                <h3 className="text-2xl font-black leading-tight text-white md:text-3xl">
                  {t(`items.${card.id}.title`)}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
                  {t(`items.${card.id}.description`)}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
