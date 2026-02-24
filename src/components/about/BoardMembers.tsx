"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { User } from "lucide-react";

const BOARD_MEMBERS = [
  { name: "Nom Cognom", roleKey: "member_role_president" as const },
  { name: "Nom Cognom", roleKey: "member_role_secretary" as const },
  { name: "Nom Cognom", roleKey: "member_role_treasurer" as const },
  { name: "Nom Cognom", roleKey: "member_role_vocal" as const },
];

export default function BoardMembers() {
  const t = useTranslations("about_page");

  return (
    <section className="bg-brand-beige py-20 text-stone-custom">
      <div className="container mx-auto max-w-4xl px-6">
        <motion.h2
          className="mb-4 text-center text-3xl font-bold tracking-tight sm:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          {t("board_title")}
        </motion.h2>
        <motion.p
          className="mx-auto mb-12 max-w-xl text-center text-base text-stone-custom/60"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {t("board_description")}
        </motion.p>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {BOARD_MEMBERS.map((member, i) => (
            <motion.div
              key={i}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-custom/10">
                <User className="h-8 w-8 text-stone-custom/40" />
              </div>
              <h3 className="text-lg font-semibold">{member.name}</h3>
              <p className="text-sm text-stone-custom/50">{t(member.roleKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
