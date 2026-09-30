"use client";

import type { ReactNode, Ref } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";

type AuthHeroProps = {
  titleKey: string;
  subtitleKey: string;
  namespace?: string;
  /** Rendered under the subtitle (e.g. the sign-up step overview). */
  children?: ReactNode;
  /** Makes the h1 focusable (`tabIndex=-1`) so a screen swap can move focus to it. */
  headingRef?: Ref<HTMLHeadingElement>;
};

export default function AuthHero({
  titleKey,
  subtitleKey,
  namespace = "auth",
  children,
  headingRef,
}: AuthHeroProps) {
  const t = useTranslations(namespace);

  return (
    <section className="bg-stone-custom pt-32 pb-8 md:pt-[150px] md:pb-9">
      <div className="container mx-auto px-6 text-center">
        <motion.h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-4xl font-bold tracking-tight text-brand-white outline-none sm:text-5xl md:text-6xl"
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
        {children}
      </div>
    </section>
  );
}
