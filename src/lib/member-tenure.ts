/**
 * Years a member has been with Darkstone, for the automatic "X anys amb Darkstone" badge.
 * Counted from the CURRENT sign-up (`members.current_joined_on`): a member who leaves and
 * rejoins starts again from zero. Pure: shared by the member home and the admin member file.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type CalendarDate = { year: number; month: number; day: number };

function parseDate(value: string | null | undefined): CalendarDate | null {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects dates that do not exist, such as 2026-02-30.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Full years between `joinedOn` and `asOf` (both `YYYY-MM-DD`, Madrid calendar days).
 * The count goes up on the anniversary; a 29 February sign-up has its anniversary on
 * 28 February in common years. Never negative. `null` when a date is missing or invalid.
 */
export function tenureYears(joinedOn: string | null | undefined, asOf: string): number | null {
  const joined = parseDate(joinedOn);
  const today = parseDate(asOf);
  if (!joined || !today) return null;

  const anniversaryDay = joined.month === 2 && joined.day === 29 && !isLeapYear(today.year) ? 28 : joined.day;
  const beforeAnniversary = today.month < joined.month || (today.month === joined.month && today.day < anniversaryDay);
  return Math.max(0, today.year - joined.year - (beforeAnniversary ? 1 : 0));
}
