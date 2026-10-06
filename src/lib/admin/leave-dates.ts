/**
 * Date bounds of the A-6 leave dialog (T6 rules: not in the future, not before the current
 * alta, at most 365 days back). Pure; the database validates again.
 */

const DAY_MS = 86_400_000;
const MAX_BACKDATE_DAYS = 365;

/** Today in Madrid as `YYYY-MM-DD` (the association's calendar day, whatever the browser's zone). */
export function madridToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `YYYY-MM-DD` shifted by whole days (UTC arithmetic: no DST drift). */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Allowed range of the leave date: the later of "365 days ago" and the current alta, up to today. */
export function leaveDateBounds(currentJoinedOn: string | null, today: string): { min: string; max: string } {
  const floor = addDays(today, -MAX_BACKDATE_DAYS);
  const joined = currentJoinedOn?.slice(0, 10) ?? "";
  const min = /^\d{4}-\d{2}-\d{2}$/.test(joined) && joined > floor ? joined : floor;
  return { min, max: today };
}
