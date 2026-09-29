const INTL_LOCALES: Record<string, string> = {
  ca: "ca-ES",
  es: "es-ES",
  en: "en-GB",
};

/**
 * Formats a calendar date stored as `YYYY-MM-DD` (a SQL `date` column).
 *
 * `new Date("YYYY-MM-DD")` is UTC midnight, so formatting in UTC keeps the stored
 * day in every timezone. Passing the app locale explicitly makes the server and
 * the browser render the same text, avoiding a hydration mismatch.
 */
export function formatCalendarDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALES[locale] ?? locale, {
    timeZone: "UTC",
  }).format(new Date(isoDate));
}
