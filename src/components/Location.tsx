"use client";

import { useTranslations } from "next-intl";
import React, { useState } from 'react';
import { useThemeSection } from "@/hooks/useThemeSection";

export default function Location() {
  const t = useTranslations("location");
  const t_sched = useTranslations("schedule");
  const [mapLoaded, setMapLoaded] = useState(false);
  const sectionRef = useThemeSection("#1c1917", "#FAFAF9", { invertTexture: true });
  const mapSrc = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d746.2896975282518!2d2.0026901364326446!3d41.56580783124514!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12a493005ac30167%3A0x86e7aad1b1aa8d36!2sDarkstone%20Catalunya!5e0!3m2!1sca!2ses!4v1765521866880!5m2!1sca!2ses";

  return (
    <section ref={sectionRef} id="location" className="relative pt-20">
      <div className="container mx-auto">
        <div className="flex flex-col gap-12 lg:flex-row">
          <div className="flex flex-col justify-center lg:w-1/2">
            <h2 className="mb-8 text-4xl font-bold tracking-tight md:text-5xl">
              {t("title")}
            </h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="mb-2 text-lg font-semibold opacity-50 uppercase tracking-wider">
                  Address
                </h3>
                <p className="text-2xl font-light">{t("address")}</p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold opacity-50 uppercase tracking-wider">
                  Open Hours
                </h3>
                <div className="text-xl font-light space-y-1">
                  <p>{t_sched("friday")}: {t_sched("friday_start")} — {t_sched("friday_end")}</p>
                  <p>{t_sched("saturday")}: {t_sched("saturday_start")} — {t_sched("saturday_end")}</p>
                </div>
              </div>

              <a
                href="https://maps.google.com/?q=Darkstone+Catalunya" 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-fit rounded-full bg-stone-50/10 px-6 py-3 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-stone-50/20"
              >
                Open in Maps →
              </a>
            </div>
          </div>

          <div className="relative h-96 overflow-hidden rounded-3xl lg:h-auto lg:w-1/2">
            {/* Abstract Map Visualization - Placeholder */}
             {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="text-center">
                      <span className="text-6xl">🗺️</span>
                      <p className="mt-4 font-mono text-sm">Map View Loading...</p>
                  </div>
              </div>
             )}
             {/* Actual iframe could go here later */}
             <iframe
                width="100%" 
                height="100%" 
                frameBorder="0" 
                style={{ border: 0 }}
                src={mapSrc}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setMapLoaded(true)}
                className={!mapLoaded ? "invisible" : "visible"}
                title={t("map")}
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  );
}
