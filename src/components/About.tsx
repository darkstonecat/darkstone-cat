"use client";

import { useTranslations } from "next-intl";
import { useThemeSection } from "@/hooks/useThemeSection";

export default function About() {
  const t = useTranslations("about");
  const sectionRef = useThemeSection("#EEE8DC", "#1c1917");

  return (
    <section ref={sectionRef} id="about" className="relative z-10 -mt-[30vh]">

      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-12 md:flex-row md:gap-20">
          <div className="md:w-1/2">
            <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">
              {t("title")}
            </h2>
            <div className="h-1.5 w-20 rounded-full bg-stone-300"></div>
            <p className="mt-8 text-xl leading-relaxed opacity-60">
              {t("text")}
            </p>
          </div>
          <div className="grid gap-6 md:w-1/2 md:grid-cols-2">
            <div className="rounded-3xl bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="mb-3 text-xl font-bold text-stone-800">
                {t("highlight1")}
              </h3>
              <p className="text-stone-600">{t("highlight1_desc")}</p>
            </div>
            <div className="rounded-3xl bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="mb-3 text-xl font-bold text-stone-800">
                {t("highlight2")}
              </h3>
              <p className="text-stone-600">{t("highlight2_desc")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
