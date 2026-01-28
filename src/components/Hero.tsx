"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import * as m from "motion/react-client";
import { useRef } from "react";
import { useScroll, useTransform, Transition } from "motion/react";


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

  const textBounceTransition: Transition = {
    type: "spring",
    stiffness: 260,
    damping: 15,
  };

  const logoBounceTransition: Transition = {
    type: "spring",
    stiffness: 200, 
    damping: 10,
    mass: 1.6,
  };


  return (
    <div ref={containerRef} className="h-[150vh] relative">
      <m.section
        style={{ opacity: opacityHero }}
        id="hero"
        className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-4 text-center z-0"
      >
        <m.div
          style= {{ scale: scaleLogo }}
          className="relative aspect-square h-[45vh] max-w-5xl min-w-50"
        >
          <m.div 
            initial={{ opacity: 0, y: 50, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={ logoBounceTransition }
            className="w-full h-full relative"
          >
            <Image
              src="/images/darkstone_logo.png"
              alt="Darkstone Catalunya Logo"
              fill
              priority
              className="object-contain drop-shadow-2xl"
              sizes="(max-width: 768px) 100vw, 1024px"
            />
          </m.div>
        </m.div>

        <m.h1 
          style={{ scale: scaleTitle }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            ...textBounceTransition,
            delay: 0.2,
          }}
          className="w-full font-extrabold tracking-tight text-stone-900 text-[clamp(2rem,6vw,8rem)] leading-none"
        >
          Darkstone Catalunya
        </m.h1>
        
        <m.div
          style={{ opacity: opacityText, y: yText }}
          className="flex flex-col items-center"
        >
          <m.p 
            initial={{ opacity: 0, y: 50, rotate: -6 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{
              ...textBounceTransition,
              delay: 0.4,
            }}
            className="mt-6 max-w-2xl text-xl font-light text-stone-600 md:text-2xl origin-bottom"
          >
            {t("tagline")}
          </m.p>

          <m.p 
            initial={{ opacity: 0, y: 50, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ 
              ...textBounceTransition, 
              delay: 0.55 
            }}
            className="mt-4 max-w-lg text-stone-500 origin-bottom"
          >
            {t("description")}
          </m.p>

          <m.div 
            initial={{ opacity: 0, y: 50, rotate: 6 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ 
              ...textBounceTransition, 
              delay: 0.7
            }}
            className="mt-10 origin-bottom"
          >
            <a
              href="#activities"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-stone-900 px-8 py-3 font-medium text-stone-50 transition-all duration-300 hover:bg-stone-800 hover:shadow-lg hover:shadow-stone-500/30"
            >
              <span className="mr-2">{t("cta")}</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </m.div>
        </m.div>
      </m.section>
    </div>
  );
}
