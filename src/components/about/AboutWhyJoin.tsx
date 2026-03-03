"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

const POINTS = [
  "why_join_point_1",
  "why_join_point_2",
  "why_join_point_3",
  "why_join_point_4",
] as const;

export default function AboutWhyJoin() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-stone-custom py-20 text-stone-white-hover">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <motion.h2
          className="mb-6 text-3xl font-black tracking-tight sm:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          {t("why_join_title")}
        </motion.h2>

        {/* Main text */}
        <motion.p
          className="mb-10 text-base leading-relaxed text-stone-white-hover/70"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("why_join_text")}
        </motion.p>

        {/* Points */}
        <div className="space-y-4">
          {POINTS.map((key, i) => (
            <motion.div
              key={key}
              className="flex gap-4 border-l-2 border-brand-orange/40 pl-5"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }}
            >
              <p className="text-sm leading-relaxed text-stone-white-hover/80">
                {t(key)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <a
            href="https://docs.google.com/forms/d/1OBM0vAOs0vvBioSeop4T0aYh__ysuNEOy36kprTJo7Q/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-orange px-8 py-4 text-lg font-semibold text-white transition-transform duration-200 hover:scale-105 active:scale-[0.97]"
          >
            {t("why_join_cta")}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
              &rarr;
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
