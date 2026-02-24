"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function AboutOrigin() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-brand-beige py-20 text-stone-custom">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 md:grid-cols-[1fr_auto] md:gap-16">
        {/* Left column — text */}
        <div>
          <motion.h2
            className="mb-6 text-3xl font-black tracking-tight text-stone-custom"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            {t("origin_title")}
          </motion.h2>
          <motion.p
            className="text-base leading-relaxed text-stone-custom/75"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {t("origin_text")}
          </motion.p>
        </div>

        {/* Right column — founding date highlight */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <span className="block text-8xl font-black leading-none text-brand-orange">
            {t("founding_day")}
          </span>
          <span className="mt-1 block text-2xl font-bold text-stone-custom/70">
            {t("founding_month_year")}
          </span>
          <span className="mt-3 block text-xs uppercase tracking-[0.2em] text-stone-custom/40">
            {t("founding_label")}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
