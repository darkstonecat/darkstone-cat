"use client";

import { useTranslations } from "next-intl";

export default function SkipLink() {
  const t = useTranslations("nav");

  return (
    <a
      href="#main-content"
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-100 focus-visible:rounded-lg focus-visible:bg-brand-orange focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white"
    >
      {t("skip_to_content")}
    </a>
  );
}
