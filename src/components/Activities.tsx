"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import TextReveal from "@/components/TextReveal";

const CARDS = [
  { id: "board_games", image: "/images/photos/boardgames_finspan.webp" },
  { id: "rpg", image: "/images/photos/rol_miseries2.webp" },
  { id: "events", image: "/images/photos/events_speedpainting.webp" },
  { id: "egara", image: "/images/photos/egarajuga_sam.webp" },
] as const;

function DesktopActivities({ t }: { t: ReturnType<typeof useTranslations<"activities">> }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0vw", "-200vw"]);

  return (
    <div ref={containerRef} className="hidden md:block relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-end justify-between px-16 pt-16 pb-8">
          <motion.div
            className="flex flex-col gap-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <TextReveal
              text={t("title")}
              as="h2"
              className="text-4xl font-black leading-none md:text-5xl"
            />
            <p className="mt-1 text-sm opacity-60">{t("text")}</p>
          </motion.div>
        </div>

        {/* Horizontal strip driven by vertical scroll */}
        <motion.div
          className="flex w-max gap-8 px-16"
          style={{ x }}
        >
          {CARDS.map((card, i) => (
            <article
              key={card.id}
              className="relative w-[70vw] shrink-0 overflow-hidden rounded-3xl"
            >
              <div className="relative h-[calc(100vh-16rem)]">
                <Image
                  src={card.image}
                  alt={t(`items.${card.id}.title`)}
                  fill
                  className="object-cover"
                  sizes="70vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <span className="absolute top-5 right-5 font-mono text-xs tracking-widest text-white/40">
                  {String(i + 1).padStart(2, "0")} /{" "}
                  {String(CARDS.length).padStart(2, "0")}
                </span>

                <div className="absolute bottom-0 left-0 p-8">
                  <h3 className="mb-3 text-4xl font-black leading-tight text-white">
                    {t(`items.${card.id}.title`)}
                  </h3>
                  <p className="max-w-[380px] text-base leading-relaxed text-white/75">
                    {t(`items.${card.id}.description`)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function MobileActivities({ t }: { t: ReturnType<typeof useTranslations<"activities">> }) {
  return (
    <div className="flex flex-col gap-5 px-6 py-16 md:hidden">
      {/* Header */}
      <motion.div
        className="flex flex-col gap-1 pb-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <TextReveal
          text={t("title")}
          as="h2"
          className="text-4xl font-black leading-none"
        />
        <p className="mt-1 text-sm opacity-60">{t("text")}</p>
      </motion.div>

      {/* Vertical cards */}
      {CARDS.map((card, i) => (
        <motion.article
          key={card.id}
          className="relative overflow-hidden rounded-2xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
        >
          <div className="relative aspect-[4/5]">
            <Image
              src={card.image}
              alt={t(`items.${card.id}.title`)}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <span className="absolute top-4 right-4 font-mono text-xs tracking-widest text-white/40">
              {String(i + 1).padStart(2, "0")} /{" "}
              {String(CARDS.length).padStart(2, "0")}
            </span>

            <div className="absolute bottom-0 left-0 p-6">
              <h3 className="mb-2 text-2xl font-black leading-tight text-white">
                {t(`items.${card.id}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-white/75">
                {t(`items.${card.id}.description`)}
              </p>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  );
}

export default function Activities() {
  const t = useTranslations("activities");

  return (
    <section id="activities" className="bg-stone-custom text-stone-white-hover">
      <DesktopActivities t={t} />
      <MobileActivities t={t} />
    </section>
  );
}
