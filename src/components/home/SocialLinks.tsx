"use client";

import { useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { motion, useAnimate } from "motion/react";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { ArrowRight } from "lucide-react";
import type { IconType } from "react-icons";

interface SocialItem {
  icon: IconType;
  href: string;
  labelKey: string;
  brandColor: string;
  glowColor: string;
  animation: string;
}

const SOCIALS: SocialItem[] = [
  {
    icon: FaFacebook,
    href: "https://www.facebook.com/profile.php?id=61560270602862",
    labelKey: "social_facebook",
    brandColor: "#1877F2",
    glowColor: "rgba(24,119,242,0.4)",
    animation: "social-rock 5s linear infinite",
  },
  {
    icon: FaInstagram,
    href: "https://instagram.com/darkstone.cat",
    labelKey: "social_instagram",
    brandColor: "#E1306C",
    glowColor: "rgba(225,48,108,0.4)",
    animation: "social-squish 6.5s linear 1.5s infinite",
  },
  {
    icon: FaXTwitter,
    href: "https://x.com/darkstonecat",
    labelKey: "social_x",
    brandColor: "#000000",
    glowColor: "rgba(0,0,0,0.3)",
    animation: "social-orbit 8s linear 3s infinite",
  },
];

function SocialIcon({ item }: { item: SocialItem }) {
  const t = useTranslations("join_us");
  const [scope, animate] = useAnimate();
  const iconBoxRef = useRef<HTMLSpanElement>(null);
  const isTouch = useRef(false);

  useEffect(() => {
    isTouch.current = window.matchMedia("(hover: none)").matches;
  }, []);

  const handleHoverStart = useCallback(() => {
    if (isTouch.current) return;
    animate(scope.current, { scale: 1.3 }, { duration: 0 });
    animate(
      scope.current,
      { x: [0, -6, 6, -4, 4, -2, 2, 0] },
      { duration: 0.5, ease: "easeInOut" }
    );
    if (iconBoxRef.current) {
      iconBoxRef.current.style.backgroundColor = item.brandColor;
      iconBoxRef.current.style.boxShadow = `0 8px 24px ${item.glowColor}`;
      iconBoxRef.current.style.animationPlayState = "paused";
    }
  }, [animate, scope, item.brandColor, item.glowColor]);

  const handleHoverEnd = useCallback(() => {
    if (isTouch.current) return;
    animate(
      scope.current,
      { scale: 1, x: 0 },
      { type: "spring", stiffness: 300, damping: 20 }
    );
    if (iconBoxRef.current) {
      iconBoxRef.current.style.backgroundColor = "";
      iconBoxRef.current.style.boxShadow = "";
      iconBoxRef.current.style.animationPlayState = "running";
    }
  }, [animate, scope]);

  const Icon = item.icon;

  return (
    <motion.a
      ref={scope}
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t(item.labelKey)}
      className="group flex flex-col items-center gap-3"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
    >
      <span
        ref={iconBoxRef}
        className="flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-2xl sm:rounded-3xl bg-stone-custom/[0.06] text-stone-custom/70 transition-all duration-300 group-hover:text-white"
        style={{
          animation: item.animation,
          transformOrigin:
            item.labelKey === "social_facebook" ? "bottom center" : "center",
        }}
      >
        <Icon className="size-9 sm:size-12" />
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-stone-custom/50 transition-colors duration-300 group-hover:text-stone-custom/80">
          {Icon === FaFacebook
            ? "Facebook"
            : Icon === FaInstagram
              ? "Instagram"
              : "X"}
        </span>
        <span className="relative flex items-center justify-center">
          <span className="absolute h-5 w-5 scale-0 rounded-full bg-white transition-transform duration-300 group-hover:scale-100" />
          <ArrowRight
            size={14}
            strokeWidth={2.5}
            className="relative z-10 text-stone-custom transition-transform duration-300 group-hover:-rotate-45"
          />
        </span>
      </span>
    </motion.a>
  );
}

export default function SocialLinks() {
  const t = useTranslations("join_us");

  return (
    <div className="mt-16 flex flex-col items-center gap-8">
      <motion.p
        className="text-sm font-semibold uppercase tracking-[0.3em] opacity-40"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.4 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5 }}
      >
        {t("social_title")}
      </motion.p>
      <div className="flex items-center gap-8 sm:gap-16">
        {SOCIALS.map((item) => (
          <SocialIcon key={item.labelKey} item={item} />
        ))}
      </div>
    </div>
  );
}
