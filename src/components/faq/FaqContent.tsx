"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const FAQ_KEYS = [
  "what_is",
  "cost",
  "bring_games",
  "age",
  "location",
  "schedule",
  "non_member",
  "game_types",
  "rpg",
  "join",
] as const;

function AccordionItem({
  questionKey,
  isOpen,
  onToggle,
}: {
  questionKey: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("faq");

  return (
    <div className="border-b border-stone-custom/15">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="text-lg sm:text-xl font-medium text-stone-custom">
          {t(`${questionKey}_q`)}
        </span>
        <span
          className="flex-shrink-0 text-2xl text-stone-custom/50 transition-transform duration-300 select-none"
          aria-hidden="true"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-base text-stone-custom/70 leading-relaxed">
              {t(`${questionKey}_a`)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FaqContent() {
  const t = useTranslations("faq");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      {/* Hero */}
      <section className="bg-stone-custom pt-36 pb-16 sm:pt-44 sm:pb-20">
        <div className="container mx-auto max-w-3xl px-6">
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-brand-beige text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {t("title")}
          </motion.h1>
          <motion.p
            className="mt-4 text-center text-brand-beige/60 text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
          >
            {t("subtitle")}
          </motion.p>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="bg-brand-beige py-16 sm:py-24">
        <div className="container mx-auto max-w-3xl px-6">
          <div className="border-t border-stone-custom/15">
            {FAQ_KEYS.map((key, i) => (
              <AccordionItem
                key={key}
                questionKey={key}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
