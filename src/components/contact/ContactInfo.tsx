"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { FaFacebook, FaInstagram, FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { Clock, Mail, MapPin } from "lucide-react";

const SOCIALS = [
  { href: "https://instagram.com/darkstone.cat", label: "Instagram", icon: FaInstagram },
  { href: "https://www.facebook.com/profile.php?id=61560270602862", label: "Facebook", icon: FaFacebook },
  { href: "https://x.com/darkstonecat", label: "X / Twitter", icon: FaXTwitter },
  { href: "https://t.me/darkstonecat", label: "Telegram", icon: FaTelegram },
] as const;

export default function ContactInfo() {
  const t = useTranslations("contact_page");
  const tSchedule = useTranslations("schedule");

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
          {t("location_name")}
        </p>
        <p className="text-sm text-stone-custom/60">
          {t("address_street")} · {t("address_city")}
        </p>
        <div className="mt-4 flex items-start gap-2 text-sm">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-stone-custom/40" />
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <span className="font-medium text-stone-custom">{tSchedule("friday")}</span>
            <span className="text-stone-custom/60">{tSchedule("friday_start")} – {tSchedule("friday_end")}</span>
            <span className="font-medium text-stone-custom">{tSchedule("saturday")}</span>
            <span className="text-stone-custom/60">{tSchedule("saturday_start")} – {tSchedule("saturday_end")}</span>
          </div>
        </div>
        <a
          href="https://maps.google.com/?q=Plaça+del+Tint,4,Terrassa"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-brand-orange transition-opacity hover:opacity-80"
        >
          {t("maps_link")}
        </a>
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
