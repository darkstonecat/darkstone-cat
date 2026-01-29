"use client";

import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 text-center">
        <div className="container mx-auto px-6 flex flex-col items-center gap-6">
            <p>&copy; {currentYear} Darkstone Catalunya. {t("rights")}</p>
            <div className="flex gap-4">
                {/* Social Placeholders */}
                <a href="https://instagram.com/darkstone.cat" className="hover:text-black transition-colors">Instagram</a>
                <a href="https://x.com/darkstonecat" className="hover:text-stone-black transition-colors">Twitter</a>
                <a href="https://t.me/darkstonecat" className="hover:text-stone-black transition-colors">Telegram</a>
            </div>
        </div>
    </footer>
  );
}
