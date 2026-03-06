import type { MetadataRoute } from "next";

const BASE_URL = "https://www.darkstone.cat";
const locales = ["ca", "es", "en"] as const;

const pages = [
  { path: "", changeFrequency: "monthly" as const, priority: 1.0, lastModified: "2026-03-04" },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.8, lastModified: "2026-03-04" },
  { path: "/ludoteca", changeFrequency: "monthly" as const, priority: 0.8, lastModified: "2026-03-04" },
  { path: "/contact", changeFrequency: "yearly" as const, priority: 0.7, lastModified: "2026-03-04" },
  { path: "/faq", changeFrequency: "yearly" as const, priority: 0.6, lastModified: "2026-03-06" },
  { path: "/conduct", changeFrequency: "yearly" as const, priority: 0.5, lastModified: "2026-03-04" },
  { path: "/legal", changeFrequency: "yearly" as const, priority: 0.3, lastModified: "2026-02-01" },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3, lastModified: "2026-02-01" },
  { path: "/cookies", changeFrequency: "yearly" as const, priority: 0.3, lastModified: "2026-02-01" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: new Date(page.lastModified),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
    alternates: {
      languages: {
        ...Object.fromEntries(
          locales.map((l) => [
            l,
            l === "ca"
              ? `${BASE_URL}${page.path}`
              : `${BASE_URL}/${l}${page.path}`,
          ])
        ),
        "x-default": `${BASE_URL}${page.path}`,
      },
    },
  }));
}
