"use client";

import { useTranslations } from "next-intl";
import { FaTelegram } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import { useThemeSection } from "@/hooks/useThemeSection";

export default function JoinUs() {
  const t = useTranslations("join_us");
  const sectionRef = useThemeSection("#FFFFFF", "#1c1917");

  return (
    <section ref={sectionRef} id="join-us" className="py-24">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl mb-6">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-xl opacity-60">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Telegram Section */}
          <div className="flex flex-col items-center text-center space-y-6 p-8 rounded-[2.5rem] bg-white relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="z-10 flex flex-col items-center">
                <div className="bg-[#0088cc] p-4 rounded-full text-white mb-4">
                    <FaTelegram size={48} />
                </div>
                <h3 className="text-2xl font-bold text-stone-900 mb-4">{t("telegram_title")}</h3>
                <p className="text-stone-700 leading-relaxed mb-8">
                {t("telegram_description")}
                </p>
                <Link
                href="https://t.me/darkstonecat"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-[#0088cc] rounded-full hover:bg-[#0077b5] transition-colors"
                >
                {t("join_telegram")}
                </Link>
            </div>
          </div>

          {/* Ludoya Section */}
          <div className="flex flex-col items-center text-center space-y-6 p-8 rounded-[2.5rem] bg-stone-900 text-stone-100 relative overflow-hidden group hover:shadow-lg transition-all">
            <div className="z-10 flex flex-col items-center">
                <div className="bg-white p-4 rounded-full mb-4">
                    <Image
                        src="/images/logos/logo_ludoya.svg"
                        alt="Ludoya Logo"
                        width={48}
                        height={48}
                        className="w-12 h-12"
                    />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{t("ludoya_title")}</h3>
                <p className="text-stone-300 leading-relaxed mb-8">
                {t("ludoya_description")}
                </p>
                {/* User request: "In addition we use Ludoya... and you can sign up and chat about them." */}
                 <Link
                href="https://app.ludoya.com/darkstonecat?inviteCode=link&lang=ca" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-stone-900 bg-brand-beige rounded-full hover:bg-white transition-colors"
                >
                {t("check_ludoya")}
                </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
