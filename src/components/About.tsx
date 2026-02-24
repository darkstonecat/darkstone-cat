"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import TextReveal from "@/components/TextReveal";

const ABOUT_CARDS = [
  { key: "card1", image: "/images/photos/egarajuga_sam.webp" },
  { key: "card2", image: "/images/photos/egarajuga_alcalde.webp" },
  { key: "card3", image: "/images/photos/events_speedpainting.webp" },
];

// Layout constants (in vh)
const TITLE_H = 70;
const CARD_H = 100;
const NUM = ABOUT_CARDS.length;
const TOTAL_H = TITLE_H + NUM * CARD_H; // 370vh
const SCROLL_RANGE = TOTAL_H - 100; // 270vh

/** Progress (0-1) at which card i sticks to the top */
function sticksAt(i: number) {
  return (TITLE_H + i * CARD_H) / SCROLL_RANGE;
}

/** Progress at which card i first enters the viewport bottom */
function entersAt(i: number) {
  return Math.max(0, (TITLE_H + i * CARD_H - 100) / SCROLL_RANGE);
}

function AboutCard({
  index,
  image,
  text,
  enterAt,
  stickAt,
  nextStickAt,
  isLast,
  progress,
}: {
  index: number;
  image: string;
  text: string;
  enterAt: number;
  stickAt: number;
  nextStickAt: number;
  isLast: boolean;
  progress: MotionValue<number>;
}) {
  // Enter: 0.8 → 1.0 as card scrolls up to stick point
  // Push:  1.0 → 0.6 as next card covers this one
  const scale = useTransform(
    progress,
    isLast
      ? [enterAt, stickAt]
      : [enterAt, stickAt, nextStickAt],
    isLast
      ? [0.8, 1]
      : [0.8, 1, 0.6]
  );

  return (
    <div
      className="sticky top-16 h-screen w-full p-3 md:p-5"
      style={{ zIndex: 10 + index }}
    >
      <motion.div
        className="relative h-full w-full origin-center overflow-hidden rounded-3xl will-change-transform"
        style={{ scale }}
      >
        <Image src={image} alt="" fill className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="absolute inset-0 flex items-center justify-center px-8 md:px-16">
          <p className="max-w-4xl text-center text-3xl font-black leading-tight text-white md:text-5xl lg:text-7xl">
            {text}
          </p>
        </div>
        <span className="absolute bottom-8 right-8 font-mono text-sm tracking-widest text-white/30">
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(NUM).padStart(2, "0")}
        </span>
      </motion.div>
    </div>
  );
}

export default function About() {
  const t = useTranslations("about");
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const firstCardProgress = sticksAt(0);
  const titleOpacity = useTransform(
    scrollYProgress,
    [0, firstCardProgress * 0.8],
    [1, 0]
  );
  const titleScale = useTransform(
    scrollYProgress,
    [0, firstCardProgress * 0.8],
    [1, 0.95]
  );

  return (
    <section
      id="about"
      ref={containerRef}
      className="relative bg-stone-custom text-stone-white-hover"
      style={{ height: `${TOTAL_H}vh` }}
    >
      {/* Title */}
      <motion.div
        className="sticky top-16 z-0 flex flex-col items-center justify-center px-6"
        style={{
          height: `${TITLE_H}vh`,
          opacity: titleOpacity,
          scale: titleScale,
        }}
      >
        <TextReveal
          text={t("title")}
          as="h2"
          className="text-5xl font-black tracking-tight md:text-7xl"
          delay={0.05}
        />
        <motion.p
          className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed opacity-60"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 0.6 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("text")}
        </motion.p>
      </motion.div>

      {/* Stacked cards */}
      {ABOUT_CARDS.map((card, i) => (
        <AboutCard
          key={card.key}
          index={i}
          image={card.image}
          text={t(`${card.key}_text`)}
          enterAt={entersAt(i)}
          stickAt={sticksAt(i)}
          nextStickAt={i < NUM - 1 ? sticksAt(i + 1) : 2}
          isLast={i === NUM - 1}
          progress={scrollYProgress}
        />
      ))}
    </section>
  );
}
