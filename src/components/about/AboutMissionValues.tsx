"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Heart, Languages, Users, Smile, Gamepad2 } from "lucide-react";

const VALUES = [
  { labelKey: "value_inclusivity_label", textKey: "value_inclusivity", icon: Heart },
  { labelKey: "value_catalan_label", textKey: "value_catalan", icon: Languages },
  { labelKey: "value_community_label", textKey: "value_community", icon: Users },
  { labelKey: "value_fun_label", textKey: "value_fun", icon: Smile },
  { labelKey: "value_alternative_label", textKey: "value_alternative", icon: Gamepad2 },
] as const;

export default function AboutMissionValues() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-stone-custom py-20 text-brand-white">
      <div className="container mx-auto max-w-5xl px-6">
        {/* Mission & Vision */}
        <div className="mx-auto mb-20 grid max-w-4xl gap-12 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("mission_title")}
            </h2>
            <p className="text-base leading-relaxed text-brand-white/70">
              {t("mission_text")}
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("vision_title")}
            </h2>
            <p className="text-base leading-relaxed text-brand-white/70">
              {t("vision_text")}
            </p>
          </motion.div>
        </div>

        {/* Values */}
        <motion.h2
          className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          {t("values_title")}
        </motion.h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value, i) => (
            <motion.div
              key={value.labelKey}
              className="rounded-2xl border border-brand-white/10 bg-brand-white/5 p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
            >
              <value.icon className="mb-3 h-6 w-6 text-brand-orange" />
              <h3 className="mb-2 text-lg font-semibold">{t(value.labelKey)}</h3>
              <p className="text-sm leading-relaxed text-brand-white/60">{t(value.textKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
