"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { useThemeSection } from "@/hooks/useThemeSection";
import TextReveal from "@/components/TextReveal";

export default function About() {
  const t = useTranslations("about");
  const sectionRef = useThemeSection("#EEE8DC", "#1c1917");

  const pills = [
    t("pill_founded"),
    t("pill_location"),
    t("pill_free"),
  ];

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative z-10 flex min-h-screen flex-col lg:flex-row"
    >
      {/* Photo — top on mobile, right on desktop */}
      <motion.div
        className="relative h-[40vh] w-full lg:order-2 lg:h-auto lg:w-[55%]"
        initial={{ opacity: 0, scale: 1.03 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
      >
        <Image
          src="/images/photos/egarajuga_taula.webp"
          alt="Socis jugant a jocs de taula"
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 55vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-beige via-transparent to-transparent lg:bg-gradient-to-l lg:from-brand-beige/30 lg:via-transparent lg:to-transparent" />
      </motion.div>

      {/* Content */}
      <div className="flex w-full flex-col justify-center px-8 py-16 md:px-16 lg:order-1 lg:w-[45%] lg:py-24">
        <motion.span
          className="text-xs font-semibold uppercase tracking-[0.3em] opacity-40"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          {t("section_label")}
        </motion.span>

        <TextReveal
          text={t("title")}
          as="h2"
          className="mt-4 text-5xl font-black leading-none tracking-tight md:text-6xl lg:text-7xl"
          delay={0.05}
        />

        <motion.p
          className="mt-6 max-w-sm text-lg leading-relaxed opacity-60"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 0.6 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("text")}
        </motion.p>

        {/* Pills */}
        <motion.div
          className="mt-8 flex flex-wrap gap-2"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full border border-current/20 px-4 py-1 text-sm"
            >
              {pill}
            </span>
          ))}
        </motion.div>

        {/* Divider */}
        <motion.div
          className="mt-10 h-px w-full bg-current opacity-10"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ transformOrigin: "left" }}
        />

        {/* Highlights */}
        <div className="mt-8 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <h3 className="text-sm font-semibold">
              {t("highlight1")}
            </h3>
            <p className="mt-1 text-sm opacity-50">
              {t("highlight1_desc")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="text-sm font-semibold">
              {t("highlight2")}
            </h3>
            <p className="mt-1 text-sm opacity-50">
              {t("highlight2_desc")}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
