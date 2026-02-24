"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { FaFacebook, FaInstagram, FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Mail, MapPin } from "lucide-react";

const SOCIALS = [
  { href: "https://instagram.com/darkstone.cat", label: "Instagram", icon: FaInstagram },
  { href: "https://www.facebook.com/profile.php?id=61560270602862", label: "Facebook", icon: FaFacebook },
  { href: "https://x.com/darkstonecat", label: "X / Twitter", icon: FaXTwitter },
  { href: "https://t.me/darkstonecat", label: "Telegram", icon: FaTelegram },
] as const;

export default function ContactInfo() {
  const t = useTranslations("contact_page");

  return (
    <motion.div
      className="space-y-10"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {/* Direct email */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-stone-custom/50">
          <Mail className="h-5 w-5" />
          <span className="text-sm font-medium">{t("email_us")}</span>
        </div>
        <a
          href="mailto:darkstone.cat@gmail.com"
          className="text-lg font-semibold text-brand-orange transition-opacity hover:opacity-80"
        >
          darkstone.cat@gmail.com
        </a>
      </div>

      {/* Location */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-stone-custom/50">
          <MapPin className="h-5 w-5" />
          <span className="text-sm font-medium">{t("location_title")}</span>
        </div>
        <p className="text-base font-medium text-stone-custom">
          Centre Cívic Ca N&apos;Aurell
        </p>
        <p className="text-sm text-stone-custom/60">
          Plaça del Tint, 4 · 08224 Terrassa
        </p>
      </div>

      {/* Social links */}
      <div>
        <p className="mb-4 text-sm font-medium text-stone-custom/50">
          {t("social_title")}
        </p>
        <div className="flex gap-4">
          {SOCIALS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-custom/5 text-stone-custom/60 transition-colors hover:bg-stone-custom/10 hover:text-stone-custom"
            >
              <social.icon size={20} />
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
