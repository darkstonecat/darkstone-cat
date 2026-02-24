"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { motion } from "motion/react";
import TextReveal from "@/components/TextReveal";
import MagneticButton from "@/components/MagneticButton";

export default function Location() {
  const t = useTranslations("location");
  const t_sched = useTranslations("schedule");
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapSrc =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d746.2896975282518!2d2.0026901364326446!3d41.56580783124514!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12a493005ac30167%3A0x86e7aad1b1aa8d36!2sDarkstone%20Catalunya!5e0!3m2!1sca!2ses!4v1765521866880!5m2!1sca!2ses";

  return (
    <section
      id="location"
      className="relative flex min-h-screen items-center bg-stone-custom py-20 text-stone-white-hover"
    >
      <div className="container mx-auto px-6">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-stretch">
          {/* Info column — 40% */}
          <motion.div
            className="flex flex-col justify-center lg:w-2/5"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <TextReveal
              text={t("title")}
              as="h2"
              className="mb-10 text-4xl font-bold tracking-tight md:text-6xl"
            />

            <div className="space-y-8">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] opacity-40">
                  {t("address_title")}
                </h3>
                <p className="text-xl font-light md:text-2xl">
                  {t("address")}
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] opacity-40">
                  {t("hours_title")}
                </h3>
                <div className="space-y-1 text-lg font-light md:text-xl">
                  <p>
                    {t_sched("friday")}: {t_sched("friday_start")} —{" "}
                    {t_sched("friday_end")}
                  </p>
                  <p>
                    {t_sched("saturday")}: {t_sched("saturday_start")} —{" "}
                    {t_sched("saturday_end")}
                  </p>
                </div>
              </div>

              <MagneticButton
                as="a"
                href="https://maps.google.com/?q=Darkstone+Catalunya"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-stone-50/10 px-6 py-3 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-stone-50/20"
              >
                {t("cta")}
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                  &rarr;
                </span>
              </MagneticButton>
            </div>
          </motion.div>

          {/* Map column — 60% */}
          <motion.div
            className="relative h-[60vh] overflow-hidden rounded-2xl lg:h-auto lg:min-h-125 lg:w-3/5"
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            {/* Skeleton loader */}
            {!mapLoaded && (
              <div className="absolute inset-0 animate-pulse rounded-2xl bg-stone-800" />
            )}

            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              src={mapSrc}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setMapLoaded(true)}
              className={`rounded-2xl transition-opacity duration-500 ${mapLoaded ? "opacity-100" : "opacity-0"}`}
              title={t("map")}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
