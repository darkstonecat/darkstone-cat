const BASE_URL = "https://www.darkstone.cat";

/**
 * Absolute URL for a page in a given locale. The default locale (ca) has no
 * prefix. Trailing slashes are never emitted on prefixed paths (`/es`, not
 * `/es/`) because Next.js redirects them; the bare site root is emitted as
 * `https://www.darkstone.cat/` (Next.js' metadata resolver strips it again
 * for <link rel="canonical">, and search engines treat both forms as one URL).
 */
export function getLocalizedUrl(locale: string, path: string) {
  if (locale === "ca") return `${BASE_URL}${path || "/"}`;
  return `${BASE_URL}/${locale}${path}`;
}

export function getOgImageUrl(locale: string) {
  return locale === "ca"
    ? `${BASE_URL}/opengraph-image/og`
    : `${BASE_URL}/${locale}/opengraph-image/og`;
}

export function getAlternates(locale: string, path: string) {
  return {
    canonical: getLocalizedUrl(locale, path),
    languages: {
      ca: getLocalizedUrl("ca", path),
      es: getLocalizedUrl("es", path),
      en: getLocalizedUrl("en", path),
      "x-default": getLocalizedUrl("ca", path),
    },
  };
}

export function getBreadcrumbJsonLd(
  locale: string,
  items: { name: string; path: string }[],
) {
  const prefix = locale === "ca" ? "" : `/${locale}`;
  const homeName = locale === "ca" ? "Inici" : locale === "es" ? "Inicio" : "Home";

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homeName,
        item: `${BASE_URL}${prefix || "/"}`,
      },
      ...items.map((entry, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: entry.name,
        item: `${BASE_URL}${prefix}${entry.path}`,
      })),
    ],
  };
}

export function getWebPageJsonLd(
  locale: string,
  path: string,
  name: string,
  description: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: getLocalizedUrl(locale, path),
    isPartOf: {
      "@type": "WebSite",
      name: "Darkstone Catalunya",
      url: BASE_URL,
    },
    inLanguage: locale === "ca" ? "ca" : locale === "es" ? "es" : "en",
  };
}
