const BASE_URL = "https://www.darkstone.cat";

export function getAlternates(locale: string, path: string) {
  return {
    canonical:
      locale === "ca" ? `${BASE_URL}${path}` : `${BASE_URL}/${locale}${path}`,
    languages: {
      ca: `${BASE_URL}${path}`,
      es: `${BASE_URL}/es${path}`,
      en: `${BASE_URL}/en${path}`,
      "x-default": `${BASE_URL}${path}`,
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
  const prefix = locale === "ca" ? "" : `/${locale}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url: `${BASE_URL}${prefix}${path}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Darkstone Catalunya",
      url: BASE_URL,
    },
    inLanguage: locale === "ca" ? "ca" : locale === "es" ? "es" : "en",
  };
}
