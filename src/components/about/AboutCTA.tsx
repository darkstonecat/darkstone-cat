"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Link } from "@/i18n/routing";
import TextReveal from "@/components/TextReveal";

export default function AboutCTA() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-brand-beige py-24 text-stone-custom">
      <div className="container mx-auto px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <TextReveal
            text={t("cta_title")}
            as="h2"
            className="text-4xl font-black tracking-tight md:text-6xl"
          />

          <motion.p
            className="mt-6 text-lg text-stone-custom/60 md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 0.6, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t("cta_subtitle")}
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <a
              href="https://docs.google.com/forms/d/1OBM0vAOs0vvBioSeop4T0aYh__ysuNEOy36kprTJo7Q/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-orange px-8 py-4 text-lg font-semibold text-white transition-transform duration-200 hover:scale-105 active:scale-[0.97]"
            >
              {t("cta_primary_button")}
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                &rarr;
              </span>
            </a>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border-2 border-stone-custom/20 px-8 py-4 text-lg font-semibold text-stone-custom transition-colors duration-200 hover:border-stone-custom/40 hover:bg-stone-custom/5"
            >
              {t("cta_secondary_button")}
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
