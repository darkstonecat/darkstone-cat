"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function ContactHero() {
  const t = useTranslations("contact_page");

  return (
    <section className="bg-brand-beige pt-28 pb-16">
      <div className="container mx-auto px-6 text-center">
        <motion.h1
          className="text-4xl font-bold tracking-tight text-stone-custom sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {t("title")}
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-lg text-lg text-stone-custom/60"
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
