"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function EventsHero() {
  const t = useTranslations("events");

  return (
    <section className="bg-stone-custom pt-24 pb-6">
      <div className="container mx-auto px-6 text-center">
        <motion.h1
          className="text-3xl font-bold tracking-tight text-brand-white sm:text-4xl md:text-5xl"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {t("title")}
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-lg text-lg text-brand-white/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {t("subtitle")}
        </motion.p>
      </div>
    </section>
  );
}
