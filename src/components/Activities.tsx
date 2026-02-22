"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { useThemeSection } from "@/hooks/useThemeSection";

const ACTIVITY_ITEMS = [
  {
    id: "board_games",
    images: [
      "/images/photos/boardgames_finspan.webp",
      "/images/photos/boardgames_darws.webp",
      "/images/photos/boardgames_magicboardgame.webp",
      "/images/photos/boardgames_witchstone.webp",
    ],
  },
  {
    id: "rpg",
    images: [
      "/images/photos/rol_miseries2.webp",
      "/images/photos/rol_bc.webp",
      "/images/photos/rol_carton.webp",
      "/images/photos/rol_miseries.webp",
    ],
  },
  {
    id: "events",
    images: [
      "/images/photos/events_blood.webp",
      "/images/photos/events_speedpainting.webp",
      "/images/photos/events_uglyswater.webp",
    ],
  },
  {
    id: "egara",
    images: [
      "/images/photos/egarajuga_sam.webp",
      "/images/photos/egarajuga_alcalde.webp",
      "/images/photos/egarajuga_taula.webp",
    ],
  },
] as const;

const ITEM_COUNT = ACTIVITY_ITEMS.length;

// --- Organic Parallax Gallery (Desktop) ---
// Photos scattered like prints on a table, with scroll-driven parallax depth

function OrganicParallaxGallery({
  images,
  scrollYProgress,
}: {
  images: readonly string[];
  scrollYProgress: MotionValue<number>;
}) {
  // Parallax: each layer moves at a different rate for 3D depth
  const bgY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const fgY = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background photo — top-left, behind everything */}
      <motion.div
        style={{ x: bgY }}
        className="absolute w-[45%] aspect-[4/3] -top-[2%] -left-[3%] z-0 -rotate-6"
      >
        <div className="relative w-full h-full rounded-lg border-4 border-white shadow-2xl overflow-hidden">
          <Image
            src={images[1]}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 25vw"
          />
        </div>
      </motion.div>

      {/* Central photo — largest, centered */}
      <div className="relative w-[65%] aspect-[4/3] z-10 rotate-2">
        <div className="relative w-full h-full rounded-lg border-4 border-white shadow-2xl overflow-hidden">
          <Image
            src={images[0]}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 40vw"
            priority
          />
        </div>
      </div>

      {/* Foreground photo — bottom-right, on top */}
      <motion.div
        style={{ x: fgY }}
        className="absolute w-[42%] aspect-[4/3] -bottom-[2%] -right-[3%] z-20 rotate-4"
      >
        <div className="relative w-full h-full rounded-lg border-4 border-white shadow-2xl overflow-hidden">
          <Image
            src={images[2 % images.length]}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 22vw"
          />
        </div>
      </motion.div>

      {/* Optional 4th photo — small accent, tucked behind top-right */}
      {images.length > 3 && (
        <motion.div
          style={{ x: bgY }}
          className="absolute w-[30%] aspect-[4/3] -top-[5%] right-[8%] -z-10 rotate-8"
        >
          <div className="relative w-full h-full rounded-lg border-4 border-white shadow-2xl overflow-hidden">
            <Image
              src={images[3]}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 768px) 15vw"
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// --- Desktop Pinned Gallery ---

// Slide offset in pixels — how far off-screen images start/end
const SLIDE_OFFSET = 600;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? SLIDE_OFFSET : -SLIDE_OFFSET,
    opacity: 0,
    scale: 0.92,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -SLIDE_OFFSET : SLIDE_OFFSET,
    opacity: 0,
    scale: 0.92,
  }),
};

const slideTransition = {
  x: { type: "spring" as const, stiffness: 200, damping: 30, mass: 1.2 },
  opacity: { duration: 0.4, ease: "easeInOut" as const },
  scale: { type: "spring" as const, stiffness: 300, damping: 30 },
};

function DesktopGallery({ t }: { t: ReturnType<typeof useTranslations> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // +1 = scrolling down (next item), -1 = scrolling up (prev item)
  const [direction, setDirection] = useState(1);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const index = Math.min(
      ITEM_COUNT - 1,
      Math.floor(progress * ITEM_COUNT)
    );
    setActiveIndex((prev) => {
      if (index !== prev) {
        setDirection(index > prev ? 1 : -1);
      }
      return index;
    });
  });

  const activeItem = ACTIVITY_ITEMS[activeIndex];

  return (
    <div
      ref={containerRef}
      style={{ height: `${(ITEM_COUNT + 1) * 100}vh` }}
      className="relative hidden md:block"
    >
      <div className="sticky top-0 h-screen flex flex-col overflow-hidden py-10">
        <div className="container mx-auto px-6 flex flex-col h-full">
          {/* Section header */}
          <div className="text-center mb-8 shrink-0">
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
              {t("title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed opacity-60">
              {t("text")}
            </p>
          </div>

          {/* 2-column layout — fills remaining height */}
          <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
            {/* Left Column: Navigation titles */}
            <nav className="col-span-3 flex flex-col justify-center space-y-2">
              {ACTIVITY_ITEMS.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <motion.div
                    key={item.id}
                    className="relative cursor-default px-5 py-4 transition-colors duration-300"
                    animate={{
                      opacity: isActive ? 1 : 0.4,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <span
                      className="text-4xl font-semibold transition-all duration-300">
                      {t(`items.${item.id}.title`)}
                    </span>
                  </motion.div>
                );
              })}
            </nav>

            {/* Right Column: Images on top, text below */}
            <div className="col-span-9 flex flex-col h-full min-h-0">
              {/* Images area — takes most of the space, unclipped */}
              <div className="relative flex-3 min-h-0">
                <AnimatePresence mode="popLayout" custom={direction}>
                  <motion.div
                    key={activeItem.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={slideTransition}
                    className="absolute inset-0"
                  >
                    <OrganicParallaxGallery
                      images={activeItem.images}
                      scrollYProgress={scrollYProgress}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Text area — masked/clipped */}
              <div className="relative shrink-0 min-h-0">
                <AnimatePresence mode="popLayout" custom={direction}>
                  <motion.div
                    key={activeItem.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={slideTransition}
                    className="space-y-3 py-2"
                  >
                    <h3 className="text-2xl lg:text-3xl font-bold text-stone-900">
                      {t(`items.${activeItem.id}.title`)}
                    </h3>
                    <p className="text-base lg:text-lg leading-relaxed text-stone-600 max-w-2xl">
                      {t(`items.${activeItem.id}.description`)}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Mobile Fallback ---

function MobileGallery({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="block md:hidden py-24">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed opacity-60">
            {t("text")}
          </p>
        </div>

        {/* Stacked items */}
        <div className="space-y-16">
          {ACTIVITY_ITEMS.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-5"
            >
              {/* Photo grid: hero + 2 thumbnails */}
              <div className="grid grid-cols-2 grid-rows-2 gap-2 aspect-[4/3]">
                <div className="row-span-2 relative overflow-hidden shadow-lg">
                  <Image
                    src={item.images[0]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                </div>
                <div className="relative overflow-hidden shadow-lg">
                  <Image
                    src={item.images[1]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                </div>
                <div className="relative overflow-hidden shadow-lg">
                  <Image
                    src={item.images[2 % item.images.length]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                </div>
              </div>

              {/* Title + Description */}
              <div className="space-y-3 text-center">
                <h3 className="text-2xl font-bold text-stone-900">
                  {t(`items.${item.id}.title`)}
                </h3>
                <p className="text-base leading-relaxed text-stone-600 max-w-md mx-auto">
                  {t(`items.${item.id}.description`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function Activities() {
  const t = useTranslations("activities");
  const sectionRef = useThemeSection("#EEE8DC", "#1c1917");

  return (
    <section ref={sectionRef} id="activities" className="pt-[30vh]">
      <DesktopGallery t={t} />
      <MobileGallery t={t} />
    </section>
  );
}
