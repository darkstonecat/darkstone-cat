"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import * as m from "motion/react-client";
import { useRef } from "react";
import { useScroll, useTransform } from "motion/react";



export default function Hero() {
  const t = useTranslations("hero");
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const scaleLogo = useTransform(scrollYProgress, [0, 1], [1, 1.4]);
  const scaleTitle = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
  const opacityText = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const yText = useTransform(scrollYProgress, [0, 0.5], [0, -20]);
  const opacityHero = useTransform(scrollYProgress, [0.6, 1], [1, 0]);


  return (
    <div ref={containerRef} className="relative h-[150vh] bg-brand-beige text-stone-custom">
      <m.section
        style={{ opacity: opacityHero }}
        id="hero"
        className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-4 text-center z-0"
      >
        <m.div
          style= {{ scale: scaleLogo }}
          className="relative aspect-square h-[35vh] md:h-[45vh] max-w-5xl"
        >
          <div className="w-full h-full relative animate-hero-logo-spring">
            <Image
              src="/images/darkstone_logo_768px.webp"
              alt="Darkstone Catalunya Logo"
              fill
              priority
              fetchPriority="high"
              quality={60}
              className="object-contain drop-shadow-2xl"
              sizes="(max-width: 768px) 35vh, 45vh"
            />
          </div>
        </m.div>

        <m.h1
          style={{ scale: scaleTitle }}
          className="w-full font-extrabold tracking-tight text-[clamp(2rem,6vw,8rem)] leading-none animate-hero-text-spring [animation-delay:0.2s] [--spring-y:30px] [--spring-r:0deg]"
        >
          Darkstone Catalunya
        </m.h1>

        <m.div
          style={{ opacity: opacityText, y: yText }}
          className="flex flex-col items-center"
        >
          <p
            className="mt-6 max-w-2xl text-xl font-light opacity-65 md:text-2xl origin-bottom animate-hero-text-spring [animation-delay:0.4s] [--spring-y:50px] [--spring-r:-6deg]"
          >
            {t("tagline")}
          </p>

          <p
            className="mt-4 max-w-lg opacity-65 origin-bottom animate-hero-text-spring [animation-delay:0.55s] [--spring-y:50px] [--spring-r:-3deg]"
          >
            {t("description")}
          </p>

          <div
            className="mt-10 origin-bottom animate-hero-text-spring [animation-delay:0.7s] [--spring-y:50px] [--spring-r:6deg]"
          >
            <a
              href="#join-us"
              className="animate-cta-nudge group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-brand-orange px-8 py-4 text-lg font-semibold text-white transition-transform duration-200 hover:scale-105 active:scale-[0.97]"
            >
              <span className="mr-2">{t("cta")}</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </div>
        </m.div>
      </m.section>
    </div>
  );
}
