import type { MetadataRoute } from "next";
import { getLocalizedUrl } from "@/lib/seo";

const locales = ["ca", "es", "en"] as const;

/**
 * Only indexable pages belong here. Pages served with `robots: noindex`
 * (/legal, /privacy, /cookies, /data-protection and the
 * auth/profile/admin pages) are intentionally excluded:
 * listing a noindex URL in the sitemap is a contradictory signal that Search
 * Console reports as "Excluded by 'noindex' tag".
 *
 * No `lastModified`: hand-maintained dates went stale, and Google ignores
 * lastmod values it cannot trust. Omitting it is better than a wrong date.
 */
const pages = [
  { path: "", changeFrequency: "monthly" as const, priority: 1.0 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/ludoteca", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly" as const, priority: 0.7 },
  { path: "/events", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/faq", changeFrequency: "yearly" as const, priority: 0.6 },
  { path: "/conduct", changeFrequency: "yearly" as const, priority: 0.5 },
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
      changeFrequency: page.changeFrequency,
      priority: locale === "ca" ? page.priority : Math.round(page.priority * 0.9 * 10) / 10,
      alternates: { languages },
    }));
  });
}
