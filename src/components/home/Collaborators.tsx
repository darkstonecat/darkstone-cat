"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import TextReveal from "@/components/TextReveal";
import { collaborators, type Collaborator } from "@/data/collaborators";

const ROWS: { items: Collaborator[]; direction: "left" | "right"; duration: number }[] = [
  { items: collaborators.slice(0, 9), direction: "left", duration: 40 },
  { items: collaborators.slice(9, 18), direction: "right", duration: 35 },
  { items: collaborators.slice(18), direction: "left", duration: 45 },
];

function LogoCard({
  collaborator,
  t,
}: {
  collaborator: Collaborator;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <a
      href={collaborator.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/card flex aspect-square w-50 shrink-0 items-center justify-center rounded-xl p-3 opacity-70 transition-[opacity,box-shadow] duration-300 hover:opacity-100 hover:shadow-lg hover:shadow-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
      style={{
        backgroundColor: collaborator.brandColor ?? "rgba(255,255,255,0.08)",
      }}
      aria-label={collaborator.name}
    >
      <div className="relative h-full w-full transition-transform duration-300 group-hover/card:scale-110">
        <Image
          src={collaborator.logo}
          alt={t("logo_alt", { name: collaborator.name })}
          fill
          className={cn("object-contain", collaborator.invertLogo && "brightness-0 invert")}
          sizes="200px"
          quality={60}
        />
      </div>
    </a>
  );
}

function MarqueeRow({
  items,
  direction,
  duration,
  t,
}: {
  items: Collaborator[];
  direction: "left" | "right";
  duration: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const animationClass =
    direction === "left"
      ? "animate-[marquee-left_var(--duration)_linear_infinite]"
      : "animate-[marquee-right_var(--duration)_linear_infinite]";

  return (
    <div className="group flex gap-4 overflow-hidden" style={{ "--duration": `${duration}s` } as React.CSSProperties}>
      {[0, 1].map((copy) => (
        <div
          key={copy}
          className={cn(
            "flex shrink-0 gap-4",
            animationClass,
            "group-hover:paused"
          )}
          aria-hidden={copy === 1}
        >
          {items.map((collaborator) => (
            <LogoCard
              key={collaborator.id}
              collaborator={collaborator}
              t={t}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Collaborators() {
  const t = useTranslations("collaborators");

  return (
    <section
      id="collaborators"
      className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-stone-custom py-20 text-stone-white-hover"
    >
      <div className="container mx-auto px-6">
        {/* Title */}
        <div className="mb-14 text-center">
          <TextReveal
            text={t("title")}
            as="h2"
            className="text-4xl font-black tracking-tight md:text-6xl"
          />
          <motion.p
            className="mx-auto mt-4 max-w-xl text-base text-stone-white-hover/50 md:text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t("subtitle")}
          </motion.p>
        </div>
      </div>

      {/* Marquee rows — full width, no container constraint */}
      <div className="space-y-4">
        {ROWS.map((row, idx) => (
          <MarqueeRow
            key={idx}
            items={row.items}
            direction={row.direction}
            duration={row.duration}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}
