"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";

const SESSION_KEY = "darkstone-intro-seen";

const subscribe = () => () => {};
const getAlreadySeen = () => !!sessionStorage.getItem(SESSION_KEY);
const getServerSnapshot = () => false;

export default function PageIntro() {
  const alreadySeen = useSyncExternalStore(subscribe, getAlreadySeen, getServerSnapshot);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 1800);

    return () => clearTimeout(timer);
  }, [alreadySeen]);

  if (alreadySeen) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-100 flex items-center justify-center bg-stone-custom"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
        >
          {/* Logo */}
          <motion.div
            className="relative h-[30vh] w-[30vh] max-h-64 max-w-64"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <Image
              src="/images/darkstone_logo.png"
              alt="Darkstone Catalunya"
              fill
              priority
              className="object-contain"
            />
          </motion.div>

          {/* Subtle text */}
          <motion.span
            className="absolute bottom-12 text-xs font-light tracking-[0.3em] text-white/30 uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Darkstone Catalunya
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
