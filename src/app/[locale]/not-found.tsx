"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import ErrorContent from "@/components/ErrorContent";

export default function NotFound() {
  const t = useTranslations("not_found");

  return (
    <main id="main-content" className="relative min-h-screen font-sans bg-stone-custom selection:bg-stone-300">
      <NavBar />
      <ErrorContent
        code="404"
        title={t("title")}
        description={t("description")}
      >
        <Link
          href="/"
          className="inline-block rounded-full bg-brand-white/10 px-6 py-3 text-sm font-medium text-brand-white transition-colors hover:bg-brand-white/20"
        >
          {t("back_home")}
        </Link>
      </ErrorContent>
    </main>
  );
}
