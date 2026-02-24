"use client";

import { motion, useScroll } from "motion/react";

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-60 h-0.5 origin-left"
      style={{
        scaleX: scrollYProgress,
        background: "linear-gradient(90deg, #E6600A, #A61A1A)",
      }}
    />
  );
}
