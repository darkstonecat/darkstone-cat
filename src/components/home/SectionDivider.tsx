"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

interface SectionDividerProps {
  topColor: string;
  bottomColor: string;
  variant?: "wave" | "curve" | "tilt" | "flat";
  flip?: boolean;
  /** Pull the divider up so it overlaps the previous section */
  overlap?: boolean;
  /** Shift the wave horizontally as the user scrolls */
  animated?: boolean;
}

const PATHS = {
  wave: "M0,50 C360,0 360,0 720,50 C1080,100 1080,100 1440,50 L1440,160 L0,160 Z",
  curve: "M0,120 Q720,-10 1440,120 L1440,160 L0,160 Z",
  tilt: "M0,100 L1440,20 L1440,160 L0,160 Z",
  flat: "M0,0 L1440,0 L1440,160 L0,160 Z",
};

// Five full waves for seamless tiling over long scroll travel
const WAVE_TILED =
  "M0,50 C360,0 360,0 720,50 C1080,100 1080,100 1440,50 C1800,0 1800,0 2160,50 C2520,100 2520,100 2880,50 C3240,0 3240,0 3600,50 C3960,100 3960,100 4320,50 C4680,0 4680,0 5040,50 C5400,100 5400,100 5760,50 L5760,160 L0,160 Z";

export default function SectionDivider({
  topColor,
  bottomColor,
  variant = "wave",
  flip = false,
  animated = false,
}: SectionDividerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);

  const isAnimatedWave = animated && variant === "wave";

  return (
    <div
      ref={ref}
      className={`relative w-full overflow-hidden z-20`}
      style={{ lineHeight: 0 }}
      aria-hidden="true"
    >
      {isAnimatedWave ? (
        <motion.svg
          viewBox="0 0 5760 160"
          preserveAspectRatio="none"
          className={`block h-16 w-[400%] md:h-24 lg:h-32 ${flip ? "-scale-x-100" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ x }}
        >
          <rect x="0" y="0" width="5760" height="160" fill={topColor} />
          <path d={WAVE_TILED} fill={bottomColor} />
        </motion.svg>
      ) : (
        <svg
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          className={`block h-16 w-full md:h-24 lg:h-32 ${flip ? "-scale-x-100" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="0" width="1440" height="160" fill={topColor} />
          <path d={PATHS[variant]} fill={bottomColor} />
        </svg>
      )}
    </div>
  );
}
