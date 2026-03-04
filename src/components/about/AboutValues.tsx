"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { MdFavorite, MdTranslate, MdGroup, MdSentimentSatisfied, MdExtension } from "react-icons/md";

const VALUES = [
  { labelKey: "value_inclusivity_label", textKey: "value_inclusivity", icon: MdFavorite },
  { labelKey: "value_catalan_label", textKey: "value_catalan", icon: MdTranslate },
  { labelKey: "value_community_label", textKey: "value_community", icon: MdGroup },
  { labelKey: "value_fun_label", textKey: "value_fun", icon: MdSentimentSatisfied },
  { labelKey: "value_alternative_label", textKey: "value_alternative", icon: MdExtension },
] as const;

function ValueCard({
  value,
  index,
  t,
}: {
  value: (typeof VALUES)[number];
  index: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <motion.div
      className="rounded-2xl bg-white p-8 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.07 }}
    >
      <value.icon className="mb-4 h-10 w-10 text-brand-orange" />
      <h3 className="mb-2 text-xl font-bold text-stone-custom">
        {t(value.labelKey)}
      </h3>
      <p className="text-sm leading-relaxed text-stone-custom/65">
        {t(value.textKey)}
      </p>
    </motion.div>
  );
}

export default function AboutValues() {
  const t = useTranslations("about_page");

  const firstRow = VALUES.slice(0, 3);
  const secondRow = VALUES.slice(3);

  return (
    <section className="bg-stone-custom px-6 py-20 text-stone-white-hover">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <motion.span
            className="mb-3 block text-xs uppercase tracking-[0.2em] text-stone-white-hover/50"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4 }}
          >
            {t("values_title")}
          </motion.span>
          <motion.h2
            className="text-4xl font-black text-stone-white-hover"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            {t("values_heading")}
          </motion.h2>
        </div>

        {/* First row — 3 cards */}
        <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {firstRow.map((value, i) => (
            <ValueCard key={value.labelKey} value={value} index={i} t={t} />
          ))}
        </div>

        {/* Second row — 2 cards centered */}
        <div className="flex flex-col justify-center gap-6 sm:flex-row">
          {secondRow.map((value, i) => (
            <div key={value.labelKey} className="sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-0.5rem)]">
              <ValueCard value={value} index={i + 3} t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
