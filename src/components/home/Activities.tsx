"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import TextReveal from "@/components/TextReveal";

const CARDS = [
  { id: "board_games", image: "/images/photos/activities_boardgames.webp" },
  { id: "rpg", image: "/images/photos/activities_rpg.webp" },
  { id: "events", image: "/images/photos/activities_events.webp" },
  { id: "egara", image: "/images/photos/activities_egara.webp" },
] as const;

function DesktopActivities({ t }: { t: ReturnType<typeof useTranslations<"activities">> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scrollRange, setScrollRange] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let rafId: number;
    const measure = () => {
      rafId = requestAnimationFrame(() => {
        setViewportWidth(window.innerWidth);
        if (innerRef.current) {
          setScrollRange(innerRef.current.scrollWidth - window.innerWidth);
        }
      });
    };
    measure();
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { scrollYProgress: meepleProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -scrollRange]);
  const meepleX = useTransform(meepleProgress, [0, 1], [0, viewportWidth * 1.2]);
  const meepleRotate = useTransform(meepleProgress, [0, 1], [-45, 360]);
  const meepleScale = useTransform(meepleProgress, [0, 1], [1, 0.2]);

  return (
    <div ref={containerRef} className="hidden md:block relative h-[400vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          className="pointer-events-none absolute left-[-25vw] bottom-[15%] z-0 h-[65vh]"
          aria-hidden="true"
          style={{ x: meepleX }}
        >
          <motion.div className="h-full origin-bottom" style={{ scale: meepleScale }}>
            <motion.img
              src="/images/icons/meeple.svg"
              alt=""
              width={512}
              height={512}
              className="h-full w-auto opacity-[0.07]"
              style={{ rotate: meepleRotate }}
            />
          </motion.div>
        </motion.div>
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
              className={`relative w-[70vh] shrink-0 overflow-hidden rounded-3xl ${i === 0 ? "-ml-[21vh]" : "ml-[8vh]"}`}
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
                  quality={60}
                  {...(i === 0 ? { priority: true } : {})}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute bottom-0 left-0 p-8">
                  <h3 className="mb-3 text-4xl font-black leading-tight text-white">
                    {t(`items.${card.id}.title`)}
                  </h3>
                  <p className="max-w-95 text-base leading-relaxed text-white/75">
                    {t(`items.${card.id}.description`)}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}

          {/* Trailing spacer so the last card ends up ~centered */}
          <div className="shrink-0" style={{ width: '20vw' }} />
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
          <div className="relative aspect-4/5">
            <Image
              src={card.image}
              alt={t(`items.${card.id}.title`)}
              fill
              className="object-cover"
              sizes="calc(100vw - 3rem)"
              quality={60}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

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
    <section id="activities" aria-label={t("title")} className="bg-brand-beige text-stone-custom">
      <DesktopActivities t={t} />
      <MobileActivities t={t} />
    </section>
  );
}
