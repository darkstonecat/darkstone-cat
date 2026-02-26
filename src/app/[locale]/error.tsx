"use client";

import { useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";
import ErrorContent from "@/components/ErrorContent";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("error_page");

  return (
    <main className="relative min-h-screen font-sans bg-stone-custom selection:bg-stone-300">
      <NavBar />
      <ErrorContent
        code="500"
        title={t("title")}
        description={t("description")}
      >
        <button
          onClick={reset}
          className="inline-block rounded-full bg-brand-white/10 px-6 py-3 text-sm font-medium text-brand-white transition-colors hover:bg-brand-white/20"
        >
          {t("retry")}
        </button>
      </ErrorContent>
    </main>
  );
}
