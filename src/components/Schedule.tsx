"use client";

import { useTranslations } from "next-intl";
import { Clock, Calendar } from "lucide-react";

export default function Schedule() {
  const t = useTranslations("schedule");

  return (
    <section id="schedule" className="py-24">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-stone-900 md:text-5xl mb-6">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-xl text-stone-600">
            {t("general_info")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Friday Card */}
          <div className="group relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-stone-100">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-stone-50 transition-transform duration-500 group-hover:scale-150" />
            
            <div className="relative flex flex-col items-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Calendar className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-2">{t("friday")}</h3>
              <div className="flex items-center gap-2 text-stone-500 mb-4">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Afternoons</span>
              </div>
              <p className="text-3xl font-light text-stone-800">
                {t("friday_hours")}
              </p>
            </div>
          </div>

          {/* Saturday Card */}
          <div className="group relative overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-stone-100">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-stone-50 transition-transform duration-500 group-hover:scale-150" />
            
            <div className="relative flex flex-col items-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Calendar className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold text-stone-900 mb-2">{t("saturday")}</h3>
              <div className="flex items-center gap-2 text-stone-500 mb-4">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Mornings</span>
              </div>
              <p className="text-3xl font-light text-stone-800">
                {t("saturday_hours")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
