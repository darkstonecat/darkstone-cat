"use client";

import { motion } from "motion/react";
import { useThemeStore } from "@/stores/useThemeStore";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const textColor = useThemeStore((s) => s.textColor);

  return (
    <motion.div
      initial={false}
      animate={{ color: textColor }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
