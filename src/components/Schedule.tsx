"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { useThemeSection } from "@/hooks/useThemeSection";
import TextReveal from "@/components/TextReveal";

export default function Schedule() {
  const t = useTranslations("schedule");
  const sectionRef = useThemeSection("#1C1917", "#FAFAF9", {
    invertTexture: true,
  });

  return (
    <section
      ref={sectionRef}
      id="schedule"
      className="relative flex min-h-screen items-center justify-center overflow-hidden py-24"
    >
      <div className="container mx-auto px-6">
        {/* Title */}
        <TextReveal
          text={t("title")}
          as="h2"
          className="mb-20 text-center text-4xl font-bold tracking-tight md:mb-28 md:text-6xl"
        />

        {/* Schedule grid */}
        <div className="mx-auto flex max-w-5xl flex-col items-center md:flex-row">
          {/* Friday */}
          <motion.div
            className="flex flex-1 flex-col items-center gap-4 py-8"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.3em] opacity-50">
              {t("friday")}
            </span>
            <p className="text-center font-black leading-none text-[clamp(3rem,12vw,8rem)]">
              {t("friday_start")}
            </p>
            <div className="my-1 h-px w-12 opacity-20 bg-current" />
            <p className="text-center font-black leading-none text-[clamp(3rem,12vw,8rem)]">
              {t("friday_end")}
            </p>
          </motion.div>

          {/* Divider */}
          <motion.div
            className="my-8 h-px w-24 bg-current opacity-15 md:my-0 md:mx-8 md:h-48 md:w-px"
            initial={{ scaleY: 0, scaleX: 0 }}
            whileInView={{ scaleY: 1, scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* Saturday */}
          <motion.div
            className="flex flex-1 flex-col items-center gap-4 py-8"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.3em] opacity-50">
              {t("saturday")}
            </span>
            <p className="text-center font-black leading-none text-[clamp(3rem,12vw,8rem)]">
              {t("saturday_start")}
            </p>
            <div className="my-1 h-px w-12 opacity-20 bg-current" />
            <p className="text-center font-black leading-none text-[clamp(3rem,12vw,8rem)]">
              {t("saturday_end")}
            </p>
          </motion.div>
        </div>

        {/* Subtitle */}
        <motion.p
          className="mt-16 text-center text-lg opacity-40 md:mt-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {t("general_info")}
        </motion.p>
      </div>
    </section>
  );
}
