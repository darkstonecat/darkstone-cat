const BASE_URL = "https://darkstone.cat";

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
