"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function AboutOrigin() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-brand-beige py-20 text-stone-custom">
      <div className="container mx-auto max-w-3xl px-6">
        <motion.h2
          className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          {t("origin_title")}
        </motion.h2>
        <motion.p
          className="text-lg leading-relaxed text-stone-custom/75"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("origin_text")}
        </motion.p>
      </div>
    </section>
  );
}
