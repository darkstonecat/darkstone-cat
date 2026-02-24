"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";

export default function ContactForm() {
  const t = useTranslations("contact_page");

  return (
    <motion.form
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium text-stone-custom/70">
          {t("name_label")}
        </label>
        <input
          type="text"
          id="name"
          name="name"
          placeholder={t("name_placeholder")}
          className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-stone-custom/70">
          {t("email_label")}
        </label>
        <input
          type="email"
          id="email"
          name="email"
          placeholder={t("email_placeholder")}
          className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange"
        />
      </div>

      <div>
        <label htmlFor="subject" className="mb-2 block text-sm font-medium text-stone-custom/70">
          {t("subject_label")}
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          placeholder={t("subject_placeholder")}
          className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-medium text-stone-custom/70">
          {t("message_label")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder={t("message_placeholder")}
          className="w-full resize-none rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-stone-custom px-6 py-3.5 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 active:scale-[0.98]"
      >
        {t("submit")}
      </button>
    </motion.form>
  );
}
