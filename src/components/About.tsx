"use client";

import { useTranslations } from "next-intl";
import { useThemeSection } from "@/hooks/useThemeSection";
import { motion, type Variants } from "framer-motion";

const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export default function About() {
  const t = useTranslations("about");
  const sectionRef = useThemeSection("#EEE8DC", "#1c1917");

  return (
    <section ref={sectionRef} id="about" className="relative z-10 -mt-[30vh]">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-[20]">
          {/* Left Column — sticky title on desktop */}
          <div className="lg:w-2/5 px-5">
            <div className="lg:sticky lg:top-1/2 lg:-translate-y-1/2">
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                {t("title")}
              </h2>
            </div>
          </div>

          {/* Right Column — scrollable content blocks */}
          <div className="flex flex-col gap-16 lg:w-3/5">
            <motion.p
              className="mb-[50vh] px-5"
              variants={fadeSlideUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
            >
              <p className="text-xl leading-relaxed">
                {t("text")}
              </p>
            </motion.p>

            <motion.div
              className="mb-[50vh] px-5"
              variants={fadeSlideUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
            >
              <h3 className="mb-3 text-2xl font-semibold">
                {t("highlight1")}
              </h3>
              <p className="text-xl leading-relaxed">
                {t("highlight1_desc")}
              </p>
            </motion.div>

            <motion.div
              className="px-5"
              variants={fadeSlideUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
            >
              <h3 className="mb-3 text-2xl font-semibold">
                {t("highlight2")}
              </h3>
              <p className="text-xl leading-relaxed">
                {t("highlight2_desc")}
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
