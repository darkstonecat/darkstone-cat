"use client";

import { useTranslations } from "next-intl";
import { FaTelegram } from "react-icons/fa";
import Image from "next/image";
import { motion } from "motion/react";
import TextReveal from "@/components/TextReveal";

import SocialLinks from "@/components/home/SocialLinks";

export default function JoinUs() {
  const t = useTranslations("join_us");

  return (
    <section
      id="join-us"
      aria-label={t("cta_title")}
      className="flex min-h-screen flex-col items-center justify-center bg-brand-beige py-24 text-stone-custom"
    >
      {/* CTA Zone */}
      <div className="container mx-auto px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <TextReveal
            text={t("cta_title")}
            as="h2"
            className="text-5xl font-black tracking-tight md:text-7xl"
          />

          <motion.p
            className="mt-6 text-lg opacity-50 md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 0.5 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t("cta_subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10"
          >
            <a
              href="https://docs.google.com/forms/d/1OBM0vAOs0vvBioSeop4T0aYh__ysuNEOy36kprTJo7Q/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="animate-cta-nudge group inline-flex items-center gap-2 rounded-full bg-brand-orange px-8 py-4 text-lg font-semibold text-white transition-transform duration-200 hover:scale-105 active:scale-[0.97]"
            >
              {t("cta_button")}
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                &rarr;
              </span>
            </a>
          </motion.div>
        </div>

        {/* Divider */}
        <motion.div
          className="mx-auto my-16 h-px w-24 bg-current opacity-15 md:my-20"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* Channel Cards */}
        <motion.p
          className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.3em] opacity-40"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("subtitle")}
        </motion.p>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* Telegram Card */}
          <motion.a
            href="https://t.me/darkstonecat"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-5 rounded-2xl bg-[#229ED9] p-8 text-center text-white transition-shadow duration-300 hover:shadow-xl hover:shadow-[#229ED9]/20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <FaTelegram size={40} className="opacity-90" />
            <h3 className="text-xl font-bold">{t("telegram_title")}</h3>
            <p className="text-sm leading-relaxed text-white/75">
              {t("telegram_description")}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold opacity-80 transition-opacity group-hover:opacity-100">
              {t("join_telegram")}
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                &rarr;
              </span>
            </span>
          </motion.a>

          {/* Ludoya Card */}
          <motion.a
            href="https://app.ludoya.com/darkstonecat?inviteCode=link&lang=ca"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-5 rounded-2xl bg-stone-800 p-8 text-center text-stone-100 transition-shadow duration-300 hover:shadow-xl hover:shadow-stone-800/20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <Image
                src="/images/logos/logo_ludoya.svg"
                alt="Ludoya Logo"
                width={28}
                height={28}
              />
            </div>
            <h3 className="text-xl font-bold">{t("ludoya_title")}</h3>
            <p className="text-sm leading-relaxed text-stone-400">
              {t("ludoya_description")}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-beige opacity-80 transition-opacity group-hover:opacity-100">
              {t("check_ludoya")}
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                &rarr;
              </span>
            </span>
          </motion.a>
        </div>

        <SocialLinks />
      </div>
    </section>
  );
}
