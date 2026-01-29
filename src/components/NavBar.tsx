"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useState } from "react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

export default function NavBar() {
  const t = useTranslations("nav");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: t("home"), href: "#hero" },
    { name: t("association"), href: "#about" },
    { name: t("activities"), href: "#activities" },
    { name: t("schedule"), href: "#schedule" },
    { name: t("location"), href: "#location" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 py-3`}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative h-10 w-10 overflow-hidden rounded-full transition-transform duration-300 group-hover:scale-105">
             <Image
              src="/images/darkstone_logo.png"
              alt="Darkstone Logo"
              fill
              className="object-cover"
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-stone-900">
            Darkstone<span className="font-light text-stone-600">.cat</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
              aria-label={t("menu_button")}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-4 w-px bg-stone-300"></div>
          <LanguageSwitcher />
        </div>

        {/* Mobile Menu Button */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span
            className={`h-0.5 w-6 block rounded-full bg-stone-800 transition-transform ${
              mobileMenuOpen ? "translate-y-2 rotate-45" : ""
            }`}
          ></span>
          <span
            className={`h-0.5 w-6 block rounded-full bg-stone-800 transition-opacity ${
              mobileMenuOpen ? "opacity-0" : ""
            }`}
          ></span>
          <span
            className={`h-0.5 w-6 block rounded-full bg-stone-800 transition-transform ${
              mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""
            }`}
          ></span>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`absolute top-full left-0 w-full overflow-hidden bg-brand-beige/95 shadow-lg backdrop-blur-md transition-all duration-300 md:hidden ${
          mobileMenuOpen ? "max-h-96 py-6 border-t border-stone-200" : "max-h-0 py-0"
        }`}
      >
        <div className="flex flex-col items-center gap-6 px-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-lg font-medium text-stone-800"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <div className="h-px w-20 bg-stone-300"></div>
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
