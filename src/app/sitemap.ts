import type { MetadataRoute } from "next";

const BASE_URL = "https://darkstone.cat";
const locales = ["ca", "es", "en"] as const;

const pages = [
  { path: "", changeFrequency: "weekly" as const, priority: 1.0 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.7 },
  {
    path: "/conduct",
    changeFrequency: "yearly" as const,
    priority: 0.5,
  },
  { path: "/legal", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly" as const, priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      const url =
        locale === "ca"
          ? `${BASE_URL}${page.path}`
          : `${BASE_URL}/${locale}${page.path}`;

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [
              l,
              l === "ca"
                ? `${BASE_URL}${page.path}`
                : `${BASE_URL}/${l}${page.path}`,
            ])
          ),
        },
      });
    }
  }

  return entries;
}
