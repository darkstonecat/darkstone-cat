"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function AboutHero() {
  const t = useTranslations("about_page");

  return (
    <section className="relative flex min-h-[60vh] items-center justify-center bg-stone-custom pt-24">
      <div className="container mx-auto px-6 text-center">
        <motion.p
          className="text-sm font-medium uppercase tracking-widest text-brand-white/40"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {t("hero_subtitle")}
        </motion.p>
        <motion.h1
          className="mt-4 text-4xl font-bold tracking-tight text-brand-white sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          {t("hero_title")}
        </motion.h1>
        <motion.p
          className="mx-auto mt-6 text-lg text-brand-white/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {t("founded")}
        </motion.p>
      </div>
    </section>
  );
}
