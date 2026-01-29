"use client";

import { useTranslations } from "next-intl";
import { useThemeSection } from "@/hooks/useThemeSection";

export default function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();
  const footerRef = useThemeSection("#1c1917", "#FAFAF9", { invertTexture: true });

  return (
    <footer ref={footerRef} className="py-12 text-center">
        <div className="container mx-auto px-6 flex flex-col items-center gap-6">
            <p>&copy; {currentYear} Darkstone Catalunya. {t("rights")}</p>
            <div className="flex gap-4">
                {/* Social Placeholders */}
                <a href="https://instagram.com/darkstone.cat" className="opacity-60 transition-opacity hover:opacity-100">Instagram</a>
                <a href="https://x.com/darkstonecat" className="opacity-60 transition-opacity hover:opacity-100">Twitter</a>
                <a href="https://t.me/darkstonecat" className="opacity-60 transition-opacity hover:opacity-100">Telegram</a>
            </div>
        </div>
    </footer>
  );
}
