"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function AboutMissionValues() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-stone-custom py-20 text-brand-white">
      <div className="mx-auto grid max-w-4xl gap-12 px-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("mission_title")}
          </h2>
          <p className="text-base leading-relaxed text-brand-white/70">
            {t("mission_text")}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("vision_title")}
          </h2>
          <p className="text-base leading-relaxed text-brand-white/70">
            {t("vision_text")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
