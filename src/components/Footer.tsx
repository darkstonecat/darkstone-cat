"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { FaFacebook, FaInstagram, FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const NAV_LINKS = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/ludoteca", key: "ludoteca" },
  { href: "/conduct", key: "conduct" },
  { href: "/contact", key: "contact" },
] as const;

const SOCIALS = [
  {
    href: "https://instagram.com/darkstone.cat",
    label: "Instagram",
    icon: FaInstagram,
  },
  {
    href: "https://www.facebook.com/profile.php?id=61560270602862",
    label: "Facebook",
    icon: FaFacebook,
  },
  {
    href: "https://x.com/darkstonecat",
    label: "X / Twitter",
    icon: FaXTwitter,
  },
  {
    href: "https://t.me/darkstonecat",
    label: "Telegram",
    icon: FaTelegram,
  },
] as const;

const LEGAL_LINKS = [
  { href: "/legal", key: "legal" },
  { href: "/privacy", key: "privacy" },
  { href: "/cookies", key: "cookies" },
] as const;

const MAPS_URL = "https://maps.google.com/?q=Plaça+del+Tint,4,08224+Terrassa";

const columnAnimation = (delay: number) => ({
  initial: { opacity: 0, y: 20 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, margin: "-50px" } as const,
  transition: { duration: 0.5, delay },
});

export default function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tLoc = useTranslations("location");
  const tSch = useTranslations("schedule");
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      {/* ── Upper zone ── */}
      <div className="bg-stone-950 px-6 pt-16 pb-12 lg:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-3">
          {/* Col 1 — Identity (left) */}
          <motion.div {...columnAnimation(0)} className="text-left">
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-full">
                <Image
                  src="/images/darkstone_logo_128px_bg.webp"
                  alt="Darkstone Logo"
                  fill
                  className="object-cover"
                  sizes="36px"
                  quality={60}
                />
              </div>
              <span className="text-lg font-bold tracking-tight text-stone-white-hover">
                Darkstone<span className="font-light opacity-50">.cat</span>
              </span>
            </div>

            <div className="mt-3 space-y-1">
              <p className="max-w-xs text-sm leading-relaxed text-stone-400">
                {t("tagline")}
              </p>
              <p className="max-w-xs pt-1 text-xs leading-relaxed text-stone-500">
                {t("description")}
              </p>
            </div>

            <div className="mt-3 border-t border-stone-800 pt-4">
              <span className="mb-3 block text-xs uppercase tracking-[0.15em] text-stone-500">
                {t("supportedBy")}
              </span>
              <div className="flex items-center gap-10">
              <a
                href="https://www.terrassa.cat/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ajuntament de Terrassa"
              >
                <Image
                  src="/images/icons/logo-terrassa.svg"
                  alt="Ajuntament de Terrassa"
                  width={167}
                  height={33}
                  className="opacity-60 transition-opacity hover:opacity-100"
                />
              </a>
              <a
                href="https://www.diba.cat/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Diputació de Barcelona"
              >
                <Image
                  src="/images/icons/logo_diputaciobarcelona.svg"
                  alt="Diputació de Barcelona"
                  width={99}
                  height={33}
                  className="brightness-0 invert opacity-60 transition-opacity hover:opacity-100"
                />
              </a>
              </div>
            </div>
          </motion.div>

          {/* Col 2 — Navigation (center) */}
          <motion.div {...columnAnimation(0.1)} className="md:text-center md:flex md:flex-col md:items-center">
            <span className="mb-5 block text-xs uppercase tracking-[0.15em] text-stone-500">
              {t("navigation")}
            </span>
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-0.5 text-sm text-stone-400 transition-colors hover:text-stone-white-hover"
                >
                  {tNav(link.key)}
                </Link>
              ))}
            </nav>
          </motion.div>

          {/* Col 3 — Location + Schedule (right) */}
          <motion.div {...columnAnimation(0.2)} className="md:text-right md:flex md:flex-col md:items-end">
            <span className="mb-3 block text-xs uppercase tracking-[0.15em] text-stone-500">
              {t("locationLabel")}
            </span>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group block transition-colors"
            >
              <p className="text-sm text-stone-400 group-hover:text-stone-300">
                {tLoc("centre_name")}
              </p>
              <p className="mt-1 text-sm text-stone-400 group-hover:text-stone-300">
                {t("address_street")}
              </p>
              <p className="text-sm text-stone-400 group-hover:text-stone-300">
                {t("address_city")}
              </p>
            </a>

            <span className="mt-4 mb-2 block text-xs uppercase tracking-[0.15em] text-stone-500">
              {t("scheduleLabel")}
            </span>
            <div className="space-y-1">
              <p className="text-sm text-stone-400">
                {tSch("friday")}: {tSch("friday_start")} — {tSch("friday_end")}
              </p>
              <p className="text-sm text-stone-400">
                {tSch("saturday")}: {tSch("saturday_start")} — {tSch("saturday_end")}
              </p>
            </div>

            <div className="mt-2 border-t border-stone-800 pt-2">
              <a
                href="mailto:darkstone.cat@gmail.com"
                className="text-sm text-stone-300 transition-colors hover:text-brand-orange"
              >
                darkstone.cat@gmail.com
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Lower zone ── */}
      <div className="bg-stone-custom px-6 py-5 lg:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-3">
          {/* Legal links */}
          <div className="flex items-center justify-center gap-4 md:justify-start">
            {LEGAL_LINKS.map((item, i) => (
              <span key={item.key} className="flex items-center gap-4">
                <Link
                  href={item.href}
                  className="text-xs text-stone-400 transition-colors hover:text-stone-300"
                >
                  {t(item.key)}
                </Link>
                {i < LEGAL_LINKS.length - 1 && (
                  <span className="text-stone-700">&middot;</span>
                )}
              </span>
            ))}
          </div>

          {/* Social icons */}
          <div className="flex items-center justify-center gap-4">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="text-stone-500 transition-colors hover:text-stone-300"
              >
                <social.icon size={20} />
              </a>
            ))}
          </div>

          {/* Copyright & dev */}
          <div className="text-center md:text-right md:flex md:flex-col md:items-end">
            <p className="text-xs text-stone-400">
              &copy; {currentYear} Darkstone Catalunya. {t("rights")}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {t("developedBy")}{" "}
              <a
                href="https://www.linkedin.com/in/rubencodina/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-300 underline decoration-stone-600 underline-offset-2 transition-colors hover:text-stone-white-hover hover:decoration-stone-400"
              >
                Rubén Codina
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
