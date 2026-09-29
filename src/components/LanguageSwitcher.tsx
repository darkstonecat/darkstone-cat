"use client";

// next/link on purpose: next-intl's <Link locale="ca"> forces a /ca prefix,
// which 308-redirects to the unprefixed URL. getPathname() applies the
// 'as-needed' rule, so every href is the canonical URL of that locale.
import Link from "next/link";
import { getPathname, usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";

interface LanguageSwitcherProps {
  colorOverride?: string;
}

export default function LanguageSwitcher({ colorOverride }: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const color = colorOverride ?? "currentColor";

  const languages = [
    { code: "ca", label: "CAT" },
    { code: "es", label: "ESP" },
    { code: "en", label: "ENG" },
  ] as const;

  // Real <a href> links (not buttons) so crawlers can discover the /es and
  // /en versions of every page from the server-rendered HTML.
  return (
    <div className="flex gap-2 text-sm font-medium" role="group" aria-label="Language">
      {languages.map((lang) => (
        <Link
          key={lang.code}
          href={getPathname({ href: pathname, locale: lang.code })}
          replace
          hrefLang={lang.code}
          style={{ color }}
          aria-current={locale === lang.code ? "page" : undefined}
          aria-label={`Switch to ${lang.label}`}
          className={`rounded-sm transition-opacity duration-200 ${
            locale === lang.code
              ? "opacity-100 underline decoration-2 underline-offset-4"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          {lang.label}
        </Link>
      ))}
    </div>
  );
}
