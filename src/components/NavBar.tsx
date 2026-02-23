"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useThemeStore } from "@/stores/useThemeStore";
import { useLenis } from "./SmoothScroll";
import LanguageSwitcher from "./LanguageSwitcher";

const NAV_SECTIONS = [
  { id: "about", key: "association" },
  { id: "activities", key: "activities" },
  { id: "schedule", key: "schedule" },
  { id: "join-us", key: "join" },
  { id: "location", key: "location" },
] as const;

export default function NavBar() {
  const t = useTranslations("nav");
  const lenis = useLenis();
  const textColor = useThemeStore((s) => s.textColor);
  const backgroundColor = useThemeStore((s) => s.backgroundColor);

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Track scroll position for backdrop and active section
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Determine active section
      const sections = NAV_SECTIONS.map((s) => ({
        ...s,
        el: document.getElementById(s.id),
      }));

      const viewportCenter = window.innerHeight / 2;
      let current = "";

      for (const section of sections) {
        if (!section.el) continue;
        const rect = section.el.getBoundingClientRect();
        if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
          current = section.id;
          break;
        }
      }

      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      lenis?.stop();
    } else {
      document.body.style.overflow = "";
      lenis?.start();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, lenis]);

  const scrollToSection = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;

      // Close menu first and restart Lenis before scrolling
      setMobileOpen(false);

      requestAnimationFrame(() => {
        if (lenis) {
          lenis.start();
          lenis.scrollTo(el, { offset: -80 });
        } else {
          el.scrollIntoView({ behavior: "smooth" });
        }
      });
    },
    [lenis]
  );

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 transition-[backdrop-filter,background-color] duration-500"
        style={{
          backgroundColor: scrolled
            ? `color-mix(in srgb, ${backgroundColor} 80%, transparent)`
            : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        }}
      >
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/images/darkstone_logo.png"
                alt="Darkstone Logo"
                fill
                className="object-cover"
              />
            </div>
            <motion.span
              className="text-xl font-bold tracking-tight"
              style={{ color: textColor }}
            >
              Darkstone
              <span className="font-light opacity-50">.cat</span>
            </motion.span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="relative px-3 py-2 text-sm font-medium transition-opacity duration-200"
                style={{
                  color: textColor,
                  opacity: activeSection === section.id ? 1 : 0.55,
                }}
              >
                {t(section.key)}
                {/* Active indicator line */}
                {activeSection === section.id && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                    style={{ backgroundColor: textColor }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}
              </button>
            ))}

            <div className="ml-4 pl-4 border-l border-current/15">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative z-[60] flex h-10 w-10 items-center justify-center md:hidden"
            aria-label={t("menu_button")}
          >
            <div className="flex w-6 flex-col items-end gap-[6px]">
              <motion.span
                className="block h-[2px] rounded-full"
                style={{ backgroundColor: mobileOpen ? "#FAFAF9" : textColor }}
                animate={{
                  width: mobileOpen ? 24 : 24,
                  rotate: mobileOpen ? 45 : 0,
                  y: mobileOpen ? 8 : 0,
                }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                className="block h-[2px] rounded-full"
                style={{ backgroundColor: mobileOpen ? "#FAFAF9" : textColor }}
                animate={{
                  width: mobileOpen ? 0 : 16,
                  opacity: mobileOpen ? 0 : 1,
                }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block h-[2px] rounded-full"
                style={{ backgroundColor: mobileOpen ? "#FAFAF9" : textColor }}
                animate={{
                  width: mobileOpen ? 24 : 20,
                  rotate: mobileOpen ? -45 : 0,
                  y: mobileOpen ? -8 : 0,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </button>
        </div>
      </motion.nav>

      {/* Mobile fullscreen menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[55] flex flex-col items-center justify-center bg-stone-custom"
            initial={{ clipPath: "circle(0% at calc(100% - 40px) 28px)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 40px) 28px)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 40px) 28px)" }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-6 flex h-10 w-10 items-center justify-center text-brand-white/70 hover:text-brand-white transition-colors"
              aria-label={t("menu_button")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>

            <nav className="flex flex-col items-center gap-6">
              {NAV_SECTIONS.map((section, i) => (
                <motion.button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="text-3xl font-bold tracking-tight text-brand-white/90 transition-colors hover:text-brand-white"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.4 }}
                >
                  {t(section.key)}
                </motion.button>
              ))}

              <motion.div
                className="mt-6 pt-6 border-t border-brand-white/15"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.4 }}
              >
                <LanguageSwitcher colorOverride="#FAFAF9" />
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
