import type { MetadataRoute } from "next";
import { getLocalizedUrl } from "@/lib/seo";

const locales = ["ca", "es", "en"] as const;

/**
 * Only indexable pages belong here. Pages served with `robots: noindex`
 * (/legal, /privacy, /cookies, /data-protection, /events/images and the
 * auth/profile/admin pages) are intentionally excluded:
 * listing a noindex URL in the sitemap is a contradictory signal that Search
 * Console reports as "Excluded by 'noindex' tag".
 */
const pages = [
  { path: "", changeFrequency: "monthly" as const, priority: 1.0, lastModified: "2026-03-04" },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.8, lastModified: "2026-03-04" },
  { path: "/ludoteca", changeFrequency: "monthly" as const, priority: 0.8, lastModified: "2026-03-04" },
  { path: "/contact", changeFrequency: "yearly" as const, priority: 0.7, lastModified: "2026-03-04" },
  { path: "/events", changeFrequency: "weekly" as const, priority: 0.8, lastModified: "2026-03-06" },
  { path: "/faq", changeFrequency: "yearly" as const, priority: 0.6, lastModified: "2026-03-06" },
  { path: "/conduct", changeFrequency: "yearly" as const, priority: 0.5, lastModified: "2026-09-14" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // One <url> entry per locale, each carrying the full hreflang cluster, so
  // that /es/* and /en/* are explicitly submitted rather than only discoverable
  // through the alternates of the Catalan entry.
  return pages.flatMap((page) => {
    const languages = {
      ...Object.fromEntries(locales.map((l) => [l, getLocalizedUrl(l, page.path)])),
      "x-default": getLocalizedUrl("ca", page.path),
    };
    return locales.map((locale) => ({
      url: getLocalizedUrl(locale, page.path),
      lastModified: new Date(page.lastModified),
      changeFrequency: page.changeFrequency,
      priority: locale === "ca" ? page.priority : Math.round(page.priority * 0.9 * 10) / 10,
      alternates: { languages },
    }));
  });
}
