"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import TextReveal from "@/components/TextReveal";
import MagneticButton from "@/components/MagneticButton";

const FGC_COLOR = "#009A44";
const RODALIES_COLOR = "#E3000F";
const BUS_COLOR = "#003DA5";

function TransportItem({
  badges,
  color,
  station,
  walkTime,
  note,
}: {
  badges: string[];
  color: string;
  station: string;
  walkTime: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex gap-1">
        {badges.map((badge) => (
          <span
            key={badge}
            className="rounded-full px-2 py-0.5 text-xs font-mono font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {badge}
          </span>
        ))}
      </div>
      <div className="flex flex-col">
        <span className="text-sm text-zinc-200">{station}</span>
        {note && <span className="text-xs text-zinc-500">{note}</span>}
      </div>
      <span className="ml-auto whitespace-nowrap font-mono text-sm text-zinc-500">
        🚶 {walkTime}
      </span>
    </div>
  );
}

export default function Location() {
  const t = useTranslations("location");
  const t_sched = useTranslations("schedule");
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapSrc =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d746.2896975282518!2d2.0026901364326446!3d41.56580783124514!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12a493005ac30167%3A0x86e7aad1b1aa8d36!2sDarkstone%20Catalunya!5e0!3m2!1sca!2ses!4v1765521866880!5m2!1sca!2ses";

  return (
    <section
      id="location"
      className="relative flex min-h-screen flex-col bg-stone-custom text-stone-white-hover lg:flex-row"
    >
      {/* Info column — 42% */}
      <motion.div
        className="flex flex-col justify-center px-8 py-16 md:px-10 lg:w-[42%]"
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
      >
        {/* Header: title + centre name + address */}
        <div>
          <TextReveal
            text={t("title")}
            as="h2"
            className="mb-2 text-4xl font-black leading-none tracking-tight md:text-6xl"
          />
          <p className="text-base font-semibold text-orange-400">
            {t("centre_name")}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{t("address")}</p>
        </div>

        {/* Schedule */}
        <div className="mt-5 border-t border-zinc-800 pt-5">
          <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
            {t("hours_title")}
          </h3>
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-zinc-400">
                {t_sched("friday")}
              </span>
              <span className="font-mono text-sm text-white">
                {t_sched("friday_start")} — {t_sched("friday_end")}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-zinc-400">
                {t_sched("saturday")}
              </span>
              <span className="font-mono text-sm text-white">
                {t_sched("saturday_start")} — {t_sched("saturday_end")}
              </span>
            </div>
          </div>
        </div>

        {/* Transport */}
        <div className="mt-5 border-t border-zinc-800 pt-5">
          <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
            {t("transport_title")}
          </h3>

          {/* FGC */}
          <div className="mb-2">
            <TransportItem
              badges={["S1"]}
              color={FGC_COLOR}
              station="Terrassa Rambla"
              walkTime={t("walk_time", { min: String(7).padStart(2, '\u2007') })}
            />
            <TransportItem
              badges={["S1"]}
              color={FGC_COLOR}
              station="Estació del Nord"
              walkTime={t("walk_time", { min: String(10).padStart(2, '\u2007') })}
              note={t("rodalies_connection")}
            />
          </div>

          <div className="my-1 border-t border-zinc-800" />

          {/* Rodalies Renfe */}
          <div className="mb-2">
            <TransportItem
              badges={["R4"]}
              color={RODALIES_COLOR}
              station="Terrassa"
              walkTime={t("walk_time", { min: String(10).padStart(2, '\u2007') })}
            />
          </div>

          <div className="my-1 border-t border-zinc-800" />

          {/* Bus TMESA */}
          <div>
            <TransportItem
              badges={["Bus"]}
              color={BUS_COLOR}
              station={`${t("bus_nearest_stop")}: Ricard Camí`}
              walkTime={t("walk_time", { min: String(3).padStart(2, '\u2007') })}
              note={t("bus_multiple_lines")}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-2 border-t border-zinc-800 pt-5 text-center">
          <MagneticButton
            as="a"
            href="https://maps.google.com/?q=Plaça+del+Tint,4,Terrassa"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center mt-5 gap-2 rounded-full border border-zinc-600 px-5 py-2.5 text-sm text-white transition-colors hover:bg-zinc-800"
          >
            {t("cta")}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
              &rarr;
            </span>
          </MagneticButton>
        </div>
      </motion.div>

      {/* Visual column — 58%: photo (65%) + map (35%) */}
      <motion.div
        className="flex flex-col lg:w-[58%]"
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        {/* Photos side by side */}
        <div className="flex h-56 lg:h-auto lg:flex-65">
          {/* Interior */}
          <div className="relative w-1/2 overflow-hidden">
            <Image
              src="/images/house/casa_civic_interior.webp"
              alt={t("photo_alt")}
              fill
              sizes="(min-width: 1024px) 29vw, 50vw"
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="mt-0.5 text-xs text-white/60">
                {t("centre_name")}
              </p>
            </div>
          </div>
          {/* Exterior */}
          <div className="relative w-1/2 overflow-hidden">
            <Image
              src="/images/house/casal_civic_exterior.webp"
              alt="Casal Cívic Ca N'Aurell — Plaça del Tint, Terrassa"
              fill
              sizes="(min-width: 1024px) 29vw, 50vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="mt-0.5 text-xs text-white/60">
                Plaça del Tint, 4
              </p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="relative h-40 lg:h-auto lg:flex-35">
          {!mapLoaded && (
            <div className="absolute inset-0 animate-pulse bg-stone-800" />
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
            className={`transition-opacity duration-500 ${mapLoaded ? "opacity-100" : "opacity-0"}`}
            title={t("map")}
          />
        </div>
      </motion.div>
    </section>
  );
}
