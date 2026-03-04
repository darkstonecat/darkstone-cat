"use client";

import { useEffect, useState } from "react";
import { useLenis } from "./SmoothScroll";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    const toggleVisibility = ({ scroll }: { scroll: number }) => {
      setIsVisible(scroll > 300);
    };

    lenis.on("scroll", toggleVisibility);

    return () => {
      lenis.off("scroll", toggleVisibility);
    };
  }, [lenis]);

  const scrollToTop = () => {
    lenis?.scrollTo(0);
    document.getElementById("main-content")?.focus();
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8">
      <button
        type="button"
        onClick={scrollToTop}
        className={`group flex items-center justify-center rounded-full bg-stone-900/80 p-3 text-stone-50 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-stone-900 hover:shadow-stone-900/30 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll to top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 transition-transform duration-300 group-hover:-translate-y-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </div>
  );
}
