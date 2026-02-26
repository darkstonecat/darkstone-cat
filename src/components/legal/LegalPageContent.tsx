"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

interface LegalSection {
  titleKey: string;
  paragraphs: readonly string[];
}

interface LegalPageContentProps {
  namespace: string;
  titleKey: string;
  introKey?: string;
  sections: readonly LegalSection[];
}

export default function LegalPageContent({ namespace, titleKey, introKey, sections }: LegalPageContentProps) {
  const t = useTranslations(namespace);

  return (
    <>
      {/* Hero */}
      <section className="relative flex items-center justify-center bg-stone-custom pt-32 pb-16">
        <div className="container mx-auto px-6 text-center">
          <motion.h1
            className="text-4xl font-bold tracking-tight text-brand-white sm:text-5xl md:text-6xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {t(titleKey)}
          </motion.h1>
          {introKey && (
            <motion.p
              className="mx-auto mt-6 max-w-2xl text-lg text-brand-white/60"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              {t(introKey)}
            </motion.p>
          )}
        </div>
      </section>

      {/* Sections */}
      {sections.map((section, i) => {
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
                    {t(pKey)}
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
