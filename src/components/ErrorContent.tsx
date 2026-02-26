"use client";

import { motion } from "motion/react";

interface ErrorContentProps {
  code: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function ErrorContent({ code, title, description, children }: ErrorContentProps) {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <motion.p
        className="text-[8rem] font-bold leading-none tracking-tighter text-brand-white/10 sm:text-[12rem]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {code}
      </motion.p>

      <motion.h1
        className="-mt-6 text-3xl font-bold tracking-tight text-brand-white sm:text-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        {title}
      </motion.h1>

      <motion.p
        className="mt-4 max-w-md text-base text-brand-white/50"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        {description}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="mt-8"
      >
        {children}
      </motion.div>
    </section>
  );
}
