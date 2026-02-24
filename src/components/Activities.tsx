"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
  const innerRef = useRef<HTMLDivElement>(null);
  const [scrollRange, setScrollRange] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (innerRef.current) {
        setScrollRange(innerRef.current.scrollWidth - window.innerWidth);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -scrollRange]);

  return (
    <div ref={containerRef} className="hidden md:block relative h-[400vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          ref={innerRef}
          className="flex w-max items-center"
          style={{ x }}
        >
          {/* Title slide */}
          <div className="flex w-screen shrink-0 flex-col items-center justify-center text-center px-16">
            <TextReveal
              text={t("title")}
              as="h2"
              className="text-5xl font-black tracking-tight md:text-7xl"
              delay={0.05}
            />
            <motion.p
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed opacity-60"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 0.6 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {t("text")}
            </motion.p>
          </div>

          {/* Cards */}
          {CARDS.map((card, i) => (
            <motion.article
              key={card.id}
              className="relative w-[70vh] shrink-0 overflow-hidden rounded-3xl ml-[49vh] first:ml-[8vw]"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="relative aspect-square max-h-[70vh]">
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
            </motion.article>
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
        className="flex flex-col items-center gap-1 pb-4 text-center"
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
