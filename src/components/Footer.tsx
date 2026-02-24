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
  { href: "/pautes-de-conducta", key: "conduct" },
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

export default function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-stone-custom pt-16 pb-10 text-stone-white-hover">
      <div className="container mx-auto px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 md:grid-cols-3">
          {/* Logo + tagline */}
          <motion.div
            className="flex flex-col items-center md:items-start"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-full">
                <Image
                  src="/images/darkstone_logo.png"
                  alt="Darkstone Logo"
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Darkstone<span className="font-light opacity-50">.cat</span>
              </span>
            </div>
            <p className="mt-3 text-sm opacity-40">
              {t("tagline")}
            </p>
          </motion.div>

          {/* Navigation links */}
          <motion.nav
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm opacity-50 transition-opacity duration-200 hover:opacity-100"
              >
                {tNav(link.key)}
              </Link>
            ))}
          </motion.nav>

          {/* Social icons */}
          <motion.div
            className="flex items-center justify-center gap-5 md:justify-end"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {SOCIALS.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="opacity-50 transition-opacity duration-200 hover:opacity-100"
                whileHover={{ scale: 1.15 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <social.icon size={22} />
              </motion.a>
            ))}
          </motion.div>
        </div>

        {/* Copyright */}
        <p className="mt-14 text-center text-xs opacity-50">
          &copy; {currentYear} Darkstone Catalunya. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
