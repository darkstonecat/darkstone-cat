import { notFound } from "next/navigation";

/**
 * Catch-all for unknown paths inside a locale segment. Without it, Next.js
 * renders its built-in 404 (no NavBar, no translations, English title) instead
 * of `src/app/[locale]/not-found.tsx`, because unmatched routes never enter the
 * [locale] segment. See https://next-intl.dev/docs/environments/error-files
 */
export default function CatchAllPage() {
  notFound();
}
