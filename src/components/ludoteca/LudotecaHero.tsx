"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

interface LudotecaHeroProps {
  totalGames: number;
  totalWithExpansions: number;
}

export default function LudotecaHero({
  totalGames,
  totalWithExpansions,
}: LudotecaHeroProps) {
  const t = useTranslations("ludoteca");

  return (
    <section className="bg-stone-custom pt-24 pb-6">
      <div className="container mx-auto px-6 text-center">
        <motion.h1
          className="text-3xl font-bold tracking-tight text-brand-white sm:text-4xl md:text-5xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {t("hero_title")}
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-lg text-lg text-brand-white/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {t("hero_subtitle")}
        </motion.p>
        <motion.p
          className="mt-3 text-sm text-brand-white/35"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {t("hero_count", { base: totalGames, total: totalWithExpansions })}
        </motion.p>
      </div>
    </section>
  );
}
