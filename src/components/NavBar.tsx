"use client";

import Image from "next/image";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
  const [menuClosing, setMenuClosing] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Determine theme based on page context
  const theme = useMemo(() => {
    if (isHomePage) {
      return SECTION_THEMES[homeActiveSection] ?? SECTION_THEMES[""];
    }
    return SUBPAGE_THEMES[pathname] ?? SECTION_THEMES[""];
  }, [isHomePage, homeActiveSection, pathname]);

  // Track scroll for backdrop blur
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Detect active home section via IntersectionObserver (no layout thrashing)
  useEffect(() => {
    if (!isHomePage) return;

    const visibleSections = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        }

        // Pick the section with the highest intersection ratio
        let best = "";
        let bestRatio = 0;
        for (const [id, ratio] of visibleSections) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        setHomeActiveSection(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75] }
    );

    for (const id of HOME_SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [isHomePage]);

  const mobileMenuRef = useRef<HTMLDivElement>(null);

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

  // Focus trap + Escape handler for mobile menu
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobileMenu();
        return;
      }

      if (e.key === "Tab") {
        const menu = mobileMenuRef.current;
        if (!menu) return;
        const focusable = menu.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus the close button after animation starts
    const timer = setTimeout(() => {
      const menu = mobileMenuRef.current;
      if (menu) {
        const firstFocusable = menu.querySelector<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        firstFocusable?.focus();
      }
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOpen]);

  const closeMobileMenu = useCallback(() => {
    setMenuClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setMenuClosing(false);
      requestAnimationFrame(() => hamburgerRef.current?.focus());
    }, 500);
  }, []);

  const isActive = useCallback((href: string) => pathname === href, [pathname]);

  const hamburgerColor = mobileOpen ? "#FAFAF9" : theme.text;

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed left-0 right-0 z-50"
        style={{
          top: "-60px",
          paddingTop: "60px",
          backgroundColor: scrolled ? hexToRgba(theme.bg, 0.8) : "rgba(0, 0, 0, 0)",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          transition: "background-color 0.4s, backdrop-filter 0.5s",
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
                quality={60}
              />
            </div>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: theme.text, transition: "color 0.4s" }}
            >
              Darkstone
              <span className="font-light opacity-65">.cat</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-2 text-sm font-medium"
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                <span
                  style={{
                    color: theme.text,
                    opacity: isActive(link.href) ? 1 : 0.55,
                    transition: "color 0.4s, opacity 0.2s",
                  }}
                >
                  {t(link.key)}
                </span>
                {/* Active indicator line */}
                {isActive(link.href) && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ backgroundColor: theme.text, transition: "background-color 0.4s" }}
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
            ref={hamburgerRef}
            onClick={() => mobileOpen ? closeMobileMenu() : setMobileOpen(true)}
            className="relative z-60 flex h-10 w-10 items-center justify-center md:hidden"
            aria-label={t("menu_button")}
          >
            <div className="flex w-6 flex-col items-end gap-1.5">
              <span
                className="block h-0.5 rounded-full"
                style={{
                  backgroundColor: hamburgerColor,
                  width: 24,
                  transform: mobileOpen ? "rotate(45deg) translateY(8px)" : "none",
                  transition: "transform 0.3s, background-color 0.3s",
                }}
              />
              <span
                className="block h-0.5 rounded-full"
                style={{
                  backgroundColor: hamburgerColor,
                  width: mobileOpen ? 0 : 16,
                  opacity: mobileOpen ? 0 : 1,
                  transition: "width 0.2s, opacity 0.2s, background-color 0.3s",
                }}
              />
              <span
                className="block h-0.5 rounded-full"
                style={{
                  backgroundColor: hamburgerColor,
                  width: mobileOpen ? 24 : 20,
                  transform: mobileOpen ? "rotate(-45deg) translateY(-8px)" : "none",
                  transition: "transform 0.3s, width 0.3s, background-color 0.3s",
                }}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile fullscreen menu */}
      {(mobileOpen || menuClosing) && (
        <div
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("menu_button")}
          className="fixed inset-0 z-55 flex flex-col items-center justify-center bg-stone-custom"
          style={{
            animation: menuClosing
              ? "nav-menu-close 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards"
              : "nav-menu-open 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          {/* Close button */}
          <button
            onClick={closeMobileMenu}
            className="absolute top-4 right-6 flex h-10 w-10 items-center justify-center text-brand-white/70 hover:text-brand-white transition-colors"
            aria-label={t("menu_button")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>

          <nav aria-label="Mobile navigation" className="flex flex-col items-center gap-6">
            {NAV_LINKS.map((link, i) => (
              <div
                key={link.href}
                style={{
                  animation: menuClosing
                    ? "none"
                    : `nav-link-enter 0.4s ease-out ${0.15 + i * 0.05}s both`,
                }}
              >
                <Link
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="text-3xl font-bold tracking-tight text-brand-white/90 transition-colors hover:text-brand-white"
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {t(link.key)}
                </Link>
              </div>
            ))}

            <div
              className="mt-6 pt-6 border-t border-brand-white/15"
              style={{
                animation: menuClosing
                  ? "none"
                  : "nav-link-enter 0.4s ease-out 0.45s both",
              }}
            >
              <LanguageSwitcher colorOverride="#FAFAF9" />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
