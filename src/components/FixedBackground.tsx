"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useThemeStore } from "@/stores/useThemeStore";

export default function FixedBackground() {
  const backgroundColor = useThemeStore((s) => s.backgroundColor);
  const invertTexture = useThemeStore((s) => s.invertTexture);

  const { scrollY } = useScroll();
  const textureY = useTransform(scrollY, [0, 3000], [0, -300]);

  return (
    <div className="fixed inset-0 -z-50 overflow-hidden">
      {/* Animated background color layer */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ backgroundColor }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />

      {/* Parallax texture layer */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 -top-[150px] bottom-0 h-[calc(200%)] opacity-[0.07]"
        initial={false}
        animate={{ filter: invertTexture ? "invert(1)" : "invert(0)" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{
          y: textureY,
          backgroundImage: "url('/images/background_icons.svg')",
          backgroundRepeat: "repeat",
          backgroundSize: "30vw auto",
        }}
      />
    </div>
  );
}
