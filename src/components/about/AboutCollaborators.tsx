"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import TextReveal from "@/components/TextReveal";
import { Link } from "@/i18n/routing";

const CollaboratorModal = dynamic(() => import("@/components/CollaboratorModal"), { ssr: false });
import {
  getCollaboratorsGrouped,
  type Collaborator,
} from "@/data/collaborators";

const groups = getCollaboratorsGrouped();

export default function AboutCollaborators() {
  const t = useTranslations("collaborators");
  const [selected, setSelected] = useState<Collaborator | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  return (
    <section className="relative bg-brand-beige py-20 text-stone-custom">
      <div className="container mx-auto px-6">
        {/* Title */}
        <div className="text-center">
          <TextReveal
            text={t("title")}
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
            {t("subtitle")}
          </motion.p>
        </div>

        {/* Category groups */}
        <div className="mt-16 space-y-14">
          {groups.map((group, groupIdx) => (
            <motion.div
              key={group.category}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: groupIdx * 0.05 }}
            >
              {/* Category heading */}
              <h3 className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-stone-custom/65">
                {t(`categories.${group.category}`)}
              </h3>

              {/* Logo grid */}
              <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-4">
                {group.items.map((collaborator, i) => (
                  <motion.button
                    key={collaborator.id}
                    onClick={() => {
                      modalTriggerRef.current = document.activeElement as HTMLElement;
                      setSelected(collaborator);
                    }}
                    className="group flex aspect-3/2 w-[calc(50%-0.5rem)] items-center justify-center rounded-xl p-4 transition-[filter,box-shadow] duration-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:w-[calc(33.333%-0.75rem)] md:w-[calc(25%-0.75rem)] lg:w-[calc(16.666%-0.875rem)]"
                    style={{
                      backgroundColor: collaborator.brandColor ?? "rgba(255,255,255,0.6)",
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{
                      duration: 0.4,
                      delay: 0.05 + i * 0.04,
                    }}
                    whileHover={{ y: -4, transition: { duration: 0.2, delay: 0 } }}
                    whileTap={{ scale: 0.97, transition: { duration: 0.1, delay: 0 } }}
                    aria-label={collaborator.name}
                  >
                    <div className="relative h-full w-full">
                      <Image
                        src={collaborator.logo}
                        alt={t("logo_alt", { name: collaborator.name })}
                        fill
                        className={cn("object-contain", collaborator.invertLogo && "brightness-0 invert")}
                        sizes="(max-width: 640px) 40vw, (max-width: 1024px) 25vw, 160px"
                        quality={60}
                      />
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Editorial invite */}
        <motion.p
          className="mx-auto mt-16 max-w-2xl text-center text-sm leading-relaxed text-stone-custom/65"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t.rich("editorial_invite", {
            contactLink: (chunks) => (
              <Link
                href="/contact"
                className="font-medium text-brand-orange underline underline-offset-2 transition-colors hover:text-brand-orange/80"
              >
                {chunks}
              </Link>
            ),
            emailLink: (chunks) => (
              <a
                href="mailto:darkstone.cat@gmail.com"
                className="font-medium text-brand-orange underline underline-offset-2 transition-colors hover:text-brand-orange/80"
              >
                {chunks}
              </a>
            ),
          })}
        </motion.p>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <CollaboratorModal
            collaborator={selected}
            onClose={() => {
              setSelected(null);
              requestAnimationFrame(() => modalTriggerRef.current?.focus());
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
