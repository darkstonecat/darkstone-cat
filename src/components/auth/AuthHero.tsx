"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

type AuthHeroProps = {
  titleKey: string;
  subtitleKey: string;
  namespace?: string;
};

export default function AuthHero({ titleKey, subtitleKey, namespace = "auth" }: AuthHeroProps) {
  const t = useTranslations(namespace);

  return (
    <section className="bg-stone-custom pt-32 pb-8 md:pt-[150px] md:pb-9">
      <div className="container mx-auto px-6 text-center">
        <motion.h1
          className="text-4xl font-bold tracking-tight text-brand-white sm:text-5xl md:text-6xl"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {t(titleKey)}
        </motion.h1>
        <motion.p
          className="mx-auto mt-6 max-w-lg text-lg text-brand-white/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {t(subtitleKey)}
        </motion.p>
      </div>
    </section>
  );
}
