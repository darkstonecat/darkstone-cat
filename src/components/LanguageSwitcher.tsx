"use client";

import { usePathname, useRouter } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { useThemeStore } from "@/stores/useThemeStore";

interface LanguageSwitcherProps {
  colorOverride?: string;
}

export default function LanguageSwitcher({ colorOverride }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const textColor = useThemeStore((s) => s.textColor);
  const color = colorOverride ?? textColor;

  const languages = [
    { code: "ca", label: "CAT" },
    { code: "es", label: "ESP" },
    { code: "en", label: "ENG" },
  ] as const;

  const handleLanguageChange = (newLocale: typeof languages[number]["code"]) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-2 text-sm font-medium" role="group" aria-label="Language">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          style={{ color }}
          aria-current={locale === lang.code ? "true" : undefined}
          aria-label={`Switch to ${lang.label}`}
          className={`rounded-sm transition-opacity duration-200 ${
            locale === lang.code
              ? "opacity-100 underline decoration-2 underline-offset-4"
              : "opacity-50 hover:opacity-100"
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
