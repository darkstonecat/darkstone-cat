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
