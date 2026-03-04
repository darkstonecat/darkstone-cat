"use client";

import Image from "next/image";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLenis } from "./SmoothScroll";
import LanguageSwitcher from "./LanguageSwitcher";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/ludoteca", key: "ludoteca" },
  { href: "/conduct", key: "conduct" },
  { href: "/contact", key: "contact" },
] as const;

// Theme for the home page scroll sections (backdrop adaptation)
const HOME_SECTION_IDS = ["about", "activities", "schedule", "join-us", "location", "collaborators"] as const;
const SECTION_THEMES: Record<string, { text: string; bg: string }> = {
  "": { text: "#1c1917", bg: "#EEE8DC" },
  about: { text: "#FAFAF9", bg: "#1C1917" },
  activities: { text: "#1c1917", bg: "#EEE8DC" },
  schedule: { text: "#FAFAF9", bg: "#1C1917" },
  "join-us": { text: "#1c1917", bg: "#EEE8DC" },
  location: { text: "#FAFAF9", bg: "#1C1917" },
  collaborators: { text: "#FAFAF9", bg: "#1C1917" },
};

// Fixed themes for subpages
const SUBPAGE_THEMES: Record<string, { text: string; bg: string }> = {
  "/about": { text: "#FAFAF9", bg: "#1C1917" },
  "/ludoteca": { text: "#FAFAF9", bg: "#1C1917" },
  "/conduct": { text: "#FAFAF9", bg: "#1C1917" },
  "/contact": { text: "#FAFAF9", bg: "#1C1917" },
  "/legal": { text: "#FAFAF9", bg: "#1C1917" },
  "/privacy": { text: "#FAFAF9", bg: "#1C1917" },
  "/cookies": { text: "#FAFAF9", bg: "#1C1917" },
};

export default function NavBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const lenis = useLenis();
  const isHomePage = pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [homeActiveSection, setHomeActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Determine theme based on page context
  const theme = useMemo(() => {
    if (isHomePage) {
      return SECTION_THEMES[homeActiveSection] ?? SECTION_THEMES[""];
    }
    return SUBPAGE_THEMES[pathname] ?? SECTION_THEMES[""];
  }, [isHomePage, homeActiveSection, pathname]);

  // Track scroll for backdrop blur + home page section detection
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      if (!isHomePage) return;

      const viewportCenter = window.innerHeight / 2;
      let current = "";

      for (const id of HOME_SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
          current = id;
          break;
        }
      }

      setHomeActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

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

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <motion.nav
        className="fixed left-0 right-0 z-50 transition-[backdrop-filter] duration-500"
        animate={{
          backgroundColor: scrolled
            ? hexToRgba(theme.bg, 0.8)
            : "rgba(0, 0, 0, 0)",
        }}
        transition={{ duration: 0.4 }}
        style={{
          top: "-60px",
          paddingTop: "60px",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        }}
      >
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/images/darkstone_logo_128px_bg.webp"
                alt="Darkstone Logo"
                fill
                className="object-cover"
                sizes="40px"
              />
            </div>
            <motion.span
              className="text-xl font-bold tracking-tight"
              animate={{ color: theme.text }}
              transition={{ duration: 0.4 }}
            >
              Darkstone
              <span className="font-light opacity-65">.cat</span>
            </motion.span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-2 text-sm font-medium transition-opacity duration-200"
              >
                <motion.span
                  animate={{ color: theme.text }}
                  transition={{ duration: 0.4 }}
                  style={{
                    opacity: isActive(link.href) ? 1 : 0.55,
                  }}
                >
                  {t(link.key)}
                </motion.span>
                {/* Active indicator line */}
                {isActive(link.href) && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    initial={{ backgroundColor: theme.text }}
                    animate={{ backgroundColor: theme.text }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}
              </Link>
            ))}

            <div className="ml-4 pl-4 border-l border-current/15">
              <LanguageSwitcher colorOverride={theme.text} />
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative z-60 flex h-10 w-10 items-center justify-center md:hidden"
            aria-label={t("menu_button")}
          >
            <div className="flex w-6 flex-col items-end gap-1.5">
              <motion.span
                className="block h-0.5 rounded-full"
                style={{ backgroundColor: mobileOpen ? "#FAFAF9" : theme.text }}
                animate={{
                  width: mobileOpen ? 24 : 24,
                  rotate: mobileOpen ? 45 : 0,
                  y: mobileOpen ? 8 : 0,
                }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                className="block h-0.5 rounded-full"
                style={{ backgroundColor: mobileOpen ? "#FAFAF9" : theme.text }}
                animate={{
                  width: mobileOpen ? 0 : 16,
                  opacity: mobileOpen ? 0 : 1,
                }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="block h-0.5 rounded-full"
                style={{ backgroundColor: mobileOpen ? "#FAFAF9" : theme.text }}
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
            className="fixed inset-0 z-55 flex flex-col items-center justify-center bg-stone-custom"
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
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.4 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-3xl font-bold tracking-tight text-brand-white/90 transition-colors hover:text-brand-white"
                  >
                    {t(link.key)}
                  </Link>
                </motion.div>
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
