"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
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
    ],
  },
  {
    id: "rpg",
    images: [
      "/images/photos/rol_miseries2.webp",
      "/images/photos/rol_bc.webp",
      "/images/photos/rol_carton.webp",
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

// --- Photo Collage (Desktop) ---
// Vertical column of 3 images filling the available height

function PhotoCollage({ images }: { images: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-2 relative rounded-2xl overflow-hidden shadow-lg min-h-0">
        <Image
          src={images[0]}
          alt=""
          fill
          className="object-cover"
          sizes="(min-width: 768px) 33vw"
          priority
        />
      </div>
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-1 relative rounded-2xl overflow-hidden shadow-lg">
          <Image
            src={images[1]}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 17vw"
          />
        </div>
        <div className="flex-1 relative rounded-2xl overflow-hidden shadow-lg">
          <Image
            src={images[2 % images.length]}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 768px) 17vw"
          />
        </div>
      </div>
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

          {/* 3-column grid — fills remaining height */}
          <div className="grid grid-cols-12 gap-8 items-center flex-1 min-h-0">
            {/* Left Column: Navigation titles */}
            <nav className="col-span-3 space-y-2">
              {ACTIVITY_ITEMS.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <motion.div
                    key={item.id}
                    className="relative cursor-default rounded-xl px-5 py-4 transition-colors duration-300"
                    animate={{
                      opacity: isActive ? 1 : 0.4,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <span
                      className={cn(
                        "text-lg font-semibold transition-all duration-300",
                        isActive
                          ? "text-stone-900"
                          : "text-stone-400"
                      )}
                    >
                      {t(`items.${item.id}.title`)}
                    </span>
                  </motion.div>
                );
              })}
            </nav>

            {/* Center Column: Photo Collage */}
            <div className="col-span-5 h-full">
              <div className="relative h-full">
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
                    <PhotoCollage images={activeItem.images} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Right Column: Description — masked/clipped */}
            <div className="col-span-4 h-full overflow-hidden relative">
              <div className="absolute inset-0 flex flex-col justify-center">
                <AnimatePresence mode="popLayout" custom={direction}>
                  <motion.div
                    key={activeItem.id}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={slideTransition}
                    className="space-y-5"
                  >
                    <h3 className="text-3xl lg:text-4xl font-bold text-stone-900">
                      {t(`items.${activeItem.id}.title`)}
                    </h3>
                    <div className="h-1.5 w-16 rounded-full bg-stone-300" />
                    <p className="text-lg leading-relaxed text-stone-600">
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
                <div className="row-span-2 relative rounded-xl overflow-hidden shadow-lg">
                  <Image
                    src={item.images[0]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                </div>
                <div className="relative rounded-xl overflow-hidden shadow-lg">
                  <Image
                    src={item.images[1]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="50vw"
                  />
                </div>
                <div className="relative rounded-xl overflow-hidden shadow-lg">
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
                <div className="h-1 w-12 rounded-full bg-stone-300 mx-auto" />
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
