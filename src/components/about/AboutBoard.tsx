"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BOARD_MEMBERS } from "@/data/board-members";
import TextReveal from "@/components/TextReveal";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AboutBoard() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-brand-beige px-6 py-20 text-stone-custom">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <TextReveal
            text={t("board_title")}
            as="h2"
            className="text-3xl font-black tracking-tight sm:text-4xl"
          />
          <motion.p
            className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-stone-custom/75"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t("board_description")}
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {BOARD_MEMBERS.map((member, i) => (
            <motion.div
              key={member.name}
              className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm md:p-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              whileHover={{ y: -4, transition: { duration: 0.2, delay: 0 } }}
            >
              {/* Avatar */}
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-custom text-lg font-bold text-stone-white-hover">
                {getInitials(member.name)}
              </div>

              <h3 className="text-center text-base font-bold text-stone-custom md:text-lg">
                {member.name}
              </h3>
              <p className="mt-1 text-center text-sm text-stone-custom/60">
                {t(member.roleKey)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
