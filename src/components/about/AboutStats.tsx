"use client";

import { useRef, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useInView } from "motion/react";
import { MdGroup, MdCasino } from "react-icons/md";
import type { IconType } from "react-icons";

interface StatItem {
  icon: IconType;
  label: string;
  animatedValue?: number;
  fallback?: string;
}

function AnimatedNumber({ value, inView }: { value: number; inView: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const start = performance.now();

    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, [inView, value]);

  return <>{display}</>;
}

export default function AboutStats({ gameCount }: { gameCount: number }) {
  const t = useTranslations("about_page");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const stats: StatItem[] = [
    {
      icon: MdGroup,
      animatedValue: 150,
      label: t("stat_members_label"),
    },
    {
      icon: MdCasino,
      animatedValue: gameCount > 0 ? gameCount : undefined,
      fallback: t("stat_games_fallback"),
      label: t("stat_games_label"),
    },
  ];

  return (
    <section className="bg-stone-custom py-20 text-stone-white-hover">
      <div className="mx-auto max-w-4xl px-6" ref={ref}>
        <motion.span
          className="mb-12 block text-center text-xs uppercase tracking-[0.2em] text-stone-white-hover/50"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4 }}
        >
          {t("stats_title")}
        </motion.span>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:max-w-lg sm:mx-auto">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <stat.icon className="mb-4 h-8 w-8 text-brand-orange" />
              <span className="text-5xl font-black tabular-nums text-brand-orange md:text-6xl">
                {stat.animatedValue ? (
                  <AnimatedNumber value={stat.animatedValue} inView={inView} />
                ) : (
                  stat.fallback
                )}
              </span>
              <span className="mt-3 text-sm uppercase tracking-[0.15em] text-stone-white-hover/60">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
