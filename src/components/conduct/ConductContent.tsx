"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

const PROTOCOL_URL =
  "https://drive.google.com/file/d/1U2EmCWP29o__MMTpdcJb7e2OaEqzVCc2/view?usp=sharing";

const SECTIONS = [
  {
    titleKey: "safe_space_title",
    paragraphs: ["safe_space_text", "safe_space_harassment", "safe_space_safety", "safe_space_protocol"],
  },
  {
    titleKey: "catalan_title",
    paragraphs: ["catalan_text"],
  },
  {
    titleKey: "communication_title",
    paragraphs: [
      "communication_respectful",
      "communication_patient",
      "communication_understand",
      "communication_concise",
      "communication_topics",
    ],
  },
  {
    titleKey: "collaboration_title",
    paragraphs: ["collaboration_text"],
  },
  {
    titleKey: "open_tables_title",
    paragraphs: ["open_tables_text"],
  },
] as const;

export default function ConductContent() {
  const t = useTranslations("conduct");

  return (
    <>
      {/* Hero */}
      <section className="relative flex items-center justify-center bg-stone-custom pt-32 pb-16">
        <div className="container mx-auto px-6 text-center">
          <motion.h1
            className="text-4xl font-bold tracking-tight text-brand-white sm:text-5xl md:text-6xl"
            initial={{ y: 30 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {t("title")}
          </motion.h1>
          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-brand-white/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          >
            {t("intro")}
          </motion.p>
        </div>
      </section>

      {/* Sections */}
      {SECTIONS.map((section, i) => {
        const isDark = i % 2 === 0;
        return (
          <section
            key={section.titleKey}
            className={`py-20 ${isDark ? "bg-brand-beige text-stone-custom" : "bg-stone-custom text-brand-white"}`}
          >
            <div className="container mx-auto max-w-3xl px-6">
              <motion.h2
                className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
              >
                {t(section.titleKey)}
              </motion.h2>
              <div className="space-y-5">
                {section.paragraphs.map((pKey, j) => (
                  <motion.p
                    key={pKey}
                    className={`text-base leading-relaxed ${isDark ? "text-stone-custom/80" : "text-brand-white/70"}`}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.4, delay: j * 0.05 }}
                  >
                    {pKey === "safe_space_protocol"
                      ? t.rich(pKey, {
                          link: (chunks) => (
                            <a
                              href={PROTOCOL_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline font-semibold hover:opacity-80 transition-opacity"
                            >
                              {chunks}
                            </a>
                          ),
                        })
                      : t(pKey)}
                  </motion.p>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
